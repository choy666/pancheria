import { test, expect, type Page } from '@playwright/test';
import {
  login,
  unique,
  createProductViaApi,
  restockProductViaApi,
  ensureCashRegisterOpen,
  setUniqueClientIp,
} from './helpers';

/**
 * Tests de concurrencia real contra el servidor E2E (base descartable).
 *
 * No dependen de timing fino: la protección está en los locks de la base
 * (`findByIdForUpdate`, `lockForUpdate`) y en las transiciones de estado
 * idempotentes. Los requests se disparan en paralelo con `Promise.all`.
 */

type CreatedOrder = {
  id: number;
  status: string;
};

async function createPublicOrderViaApi(
  page: Page,
  productId: number,
  customerName: string
): Promise<CreatedOrder> {
  const customerPhone = `3415${Math.floor(100000 + Math.random() * 899999)}`;
  const clientIp = `10.0.0.${Math.floor(Math.random() * 1000000) % 254}`;

  const response = await page.request.post('/api/public/pedido', {
    data: {
      items: [{ productId, quantity: 1 }],
      customerName,
      customerPhone,
      deliveryType: 'pickup',
      idempotencyKey: `${customerName}-${Date.now()}-${Math.random()}`,
    },
    headers: { 'X-Forwarded-For': clientIp },
  });

  expect(response.status()).toBe(201);
  const body = (await response.json()) as { order: CreatedOrder };
  return body.order;
}

async function getProductStock(page: Page, productId: number): Promise<number> {
  const response = await page.request.get(`/api/productos/${productId}`);
  expect(response.status()).toBe(200);
  const product = (await response.json()) as { stock: number };
  return product.stock;
}

async function getOrderStatus(page: Page, orderId: number): Promise<string> {
  const response = await page.request.get(`/api/pedidos/${orderId}`);
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { order: { status: string } };
  return body.order.status;
}

test.describe('Concurrencia sobre stock y pedidos', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await ensureCashRegisterOpen(page);
    await setUniqueClientIp(page);
  });

  test('no permite oversell: ventas paralelas con stock acotado', async ({
    page,
  }) => {
    const STOCK = 4;
    const INTENTOS = 8;

    const bebida = await createProductViaApi(page, {
      name: unique('Bebida oversell'),
      type: 'critical_supply',
      criticalSupplyType: 'beverage',
      price: 500,
      unit: 'unidad',
      isActive: true,
    });
    await restockProductViaApi(page, bebida.id, STOCK);

    const resultados = await Promise.all(
      Array.from({ length: INTENTOS }, (_, i) =>
        page.request.post('/api/ventas', {
          data: {
            items: [{ productId: bebida.id, quantity: 1 }],
            payments: [{ method: 'cash', amount: 500 }],
            idempotencyKey: `oversell-${bebida.id}-${i}-${Date.now()}`,
          },
        })
      )
    );

    const statuses = resultados.map((r) => r.status());
    const exitosas = statuses.filter((s) => s === 201).length;

    // Solo `STOCK` ventas pueden ganar; el resto es rechazado por
    // insuficiencia (409) o validación (400), nunca 5xx.
    expect(exitosas).toBe(STOCK);
    for (const status of statuses) {
      expect(status).toBeLessThan(500);
    }

    // El stock físico nunca queda negativo.
    expect(await getProductStock(page, bebida.id)).toBe(0);
  });

  test('recibir duplicado en paralelo reserva una sola vez', async ({
    page,
  }) => {
    const STOCK = 10;

    // Bebida: `critical_supply` vendible por el canal público (los demás
    // insumos críticos no se venden directamente y el POST devuelve 400).
    const pan = await createProductViaApi(page, {
      name: unique('Insumo reserva'),
      type: 'critical_supply',
      criticalSupplyType: 'beverage',
      price: 0,
      unit: 'unidad',
      isActive: true,
    });
    await restockProductViaApi(page, pan.id, STOCK);

    const order = await createPublicOrderViaApi(
      page,
      pan.id,
      unique('Cliente reserva')
    );

    const resultados = await Promise.all([
      page.request.post(`/api/pedidos/${order.id}/recibir`),
      page.request.post(`/api/pedidos/${order.id}/recibir`),
    ]);

    // `receiveOrder` es idempotente sobre `in_process`: ambos requests
    // pueden responder 200, pero la reserva debe aplicarse una sola vez.
    for (const response of resultados) {
      expect(response.status()).toBe(200);
    }
    expect(await getOrderStatus(page, order.id)).toBe('in_process');

    // La disponibilidad descuenta la reserva una sola vez: queda STOCK-1.
    // Se consulta el endpoint público: `/api/ventas/disponibilidad` usa
    // `validateCartAvailability`, que solo descuenta reservas dentro de una
    // transacción (el preview del terminal no las resta).
    const disponibilidad = await page.request.post(
      '/api/public/disponibilidad',
      { data: { items: [], productIds: [pan.id] } }
    );
    expect(disponibilidad.status()).toBe(200);
    const body = (await disponibilidad.json()) as {
      availabilityByProduct: Record<number, number>;
    };
    expect(body.availabilityByProduct[pan.id]).toBe(STOCK - 1);
  });

  test('carrera recibir/cancelar deja el pedido en estado terminal consistente', async ({
    page,
  }) => {
    const STOCK = 5;

    const pan = await createProductViaApi(page, {
      name: unique('Insumo carrera'),
      type: 'critical_supply',
      criticalSupplyType: 'beverage',
      price: 0,
      unit: 'unidad',
      isActive: true,
    });
    await restockProductViaApi(page, pan.id, STOCK);

    const order = await createPublicOrderViaApi(
      page,
      pan.id,
      unique('Cliente carrera')
    );

    const [recibir, cancelar] = await Promise.all([
      page.request.post(`/api/pedidos/${order.id}/recibir`),
      page.request.post(`/api/pedidos/${order.id}/cancelar`, {
        data: { reason: 'Cancelación en carrera con recepción' },
      }),
    ]);

    // Sin errores de servidor: la carrera se resuelve por el lock de la fila.
    expect(recibir.status()).toBeLessThan(500);
    expect(cancelar.status()).toBeLessThan(500);

    // `cancelar` siempre gana al final (cancela `pending` y también libera
    // reservas de `in_process`), así que el estado terminal es `cancelled`
    // independientemente del orden en que corrió cada transacción.
    expect(await getOrderStatus(page, order.id)).toBe('cancelled');

    // Un `recibir` tardío sobre el pedido cancelado es rechazado.
    const tardio = await page.request.post(
      `/api/pedidos/${order.id}/recibir`
    );
    expect(tardio.status()).toBe(400);

    // Sin fuga de reservas: la disponibilidad vuelve al stock completo
    // (mismo endpoint público que descuenta reservas activas).
    const disponibilidad = await page.request.post(
      '/api/public/disponibilidad',
      { data: { items: [], productIds: [pan.id] } }
    );
    const body = (await disponibilidad.json()) as {
      availabilityByProduct: Record<number, number>;
    };
    expect(body.availabilityByProduct[pan.id]).toBe(STOCK);
  });
});
