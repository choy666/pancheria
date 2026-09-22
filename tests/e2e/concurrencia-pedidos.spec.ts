import { test, expect, type Page } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db';
import { orders } from '../../src/db/schema';
import {
  login,
  unique,
  createProductViaApi,
  restockProductViaApi,
  ensureCashRegisterOpen,
  setUniqueClientIp,
  countStockMovements,
  countOrderReservations,
} from './helpers';

/**
 * Concurrencia sobre pedidos públicos (C2.2, C2.3, C2.6, C2.7, C2.8 del plan).
 *
 * `pending` no reserva stock: la contienda real entre clientes es al
 * recibir (`receiveOrder` compite por el último insumo bajo lock). La
 * idempotencia del servidor se verifica con la misma clave en paralelo y
 * en reintento secuencial; el doble envío de chat se documenta tal cual
 * (los mensajes no tienen clave de idempotencia por diseño, R9).
 */

type CreatedPublicOrder = {
  id: number;
  orderNumber: string;
  status: string;
  total: number;
  customerName: string;
  cancellationToken: string;
};

function randomClientIp() {
  const octet = () => Math.floor(Math.random() * 253) + 1;
  return `10.${octet()}.${octet()}.${octet()}`;
}

async function createPublicOrder(
  page: Page,
  productId: number,
  options: { customerName?: string; idempotencyKey?: string } = {}
): Promise<CreatedPublicOrder> {
  const customerName = options.customerName ?? unique('Cliente Concurrencia');
  const response = await page.request.post('/api/public/pedido', {
    headers: { 'x-forwarded-for': randomClientIp() },
    data: {
      items: [{ productId, quantity: 1 }],
      customerName,
      customerPhone: '3415551234',
      deliveryType: 'pickup',
      idempotencyKey: options.idempotencyKey ?? `conc-${customerName}`,
    },
  });
  expect(response.status()).toBe(201);
  const body = (await response.json()) as { order: CreatedPublicOrder };
  return body.order;
}

async function createBeverage(
  page: Page,
  name: string,
  stock: number
): Promise<{ id: number }> {
  const product = await createProductViaApi(page, {
    name: unique(name),
    type: 'critical_supply',
    criticalSupplyType: 'beverage',
    price: 500,
    unit: 'unidad',
    isActive: true,
  });
  await restockProductViaApi(page, product.id, stock);
  return product;
}

async function countOrdersByCustomer(customerName: string): Promise<number> {
  const rows = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.customerName, customerName));
  return rows.length;
}

test.describe('Concurrencia sobre pedidos públicos', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await ensureCashRegisterOpen(page);
    await setUniqueClientIp(page);
  });

  test('tres pendientes por el último insumo: solo una recepción gana', async ({
    page,
  }) => {
    const bebida = await createBeverage(page, 'Bebida último insumo', 1);

    // Tres clientes distintos crean pending sobre el mismo ítem con stock
    // 1. El nombre/clave llevan índice: `unique()` usa Date.now() y llamadas
    // en el mismo milisegundo deduplicarían al mismo pedido.
    const pedidos = await Promise.all(
      [1, 2, 3].map((i) =>
        createPublicOrder(page, bebida.id, {
          customerName: `${unique('Cliente Concurrencia')} ${i}`,
          idempotencyKey: `ultimo-insumo-${i}-${Date.now()}`,
        })
      )
    );

    const resultados = await Promise.all(
      pedidos.map((pedido) =>
        page.request.post(`/api/pedidos/${pedido.id}/recibir`)
      )
    );

    const statuses = resultados.map((r) => r.status());
    // Solo una recepción puede reservar el último insumo; las demás se
    // rechazan por insuficiencia/validación, nunca con error de servidor.
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    for (const status of statuses) {
      expect(status).toBeLessThan(500);
    }

    // Invariantes SQL: exactamente una reserva y un movimiento 'reserve'
    // entre los tres pedidos; disponibilidad en 0.
    const reservas = await Promise.all(
      pedidos.map((pedido) => countOrderReservations(pedido.id))
    );
    expect(reservas.reduce((a, b) => a + b, 0)).toBe(1);
    expect(
      await countStockMovements({ productId: bebida.id, type: 'reserve' })
    ).toBe(1);
  });

  test('doble submit público con la misma clave en paralelo crea un solo pedido', async ({
    page,
  }) => {
    const bebida = await createBeverage(page, 'Bebida idempotente', 5);
    const customerName = unique('Cliente Duplicado');
    const key = `doble-submit-${Date.now()}`;
    const ip = randomClientIp();

    const [a, b] = await Promise.all([
      page.request.post('/api/public/pedido', {
        headers: { 'x-forwarded-for': ip },
        data: {
          items: [{ productId: bebida.id, quantity: 1 }],
          customerName,
          customerPhone: '3415551234',
          deliveryType: 'pickup',
          idempotencyKey: key,
        },
      }),
      page.request.post('/api/public/pedido', {
        headers: { 'x-forwarded-for': ip },
        data: {
          items: [{ productId: bebida.id, quantity: 1 }],
          customerName,
          customerPhone: '3415551234',
          deliveryType: 'pickup',
          idempotencyKey: key,
        },
      }),
    ]);

    // La deduplicación es transparente: ambos requests responden 201 con
    // el mismo pedido (ON CONFLICT devuelve la fila existente).
    expect(a.status()).toBe(201);
    expect(b.status()).toBe(201);

    const orderA = (await a.json()) as { order: { id: number } };
    const orderB = (await b.json()) as { order: { id: number } };
    expect(orderA.order.id).toBe(orderB.order.id);

    // Invariante: una sola fila de pedido para la misma operación lógica.
    expect(await countOrdersByCustomer(customerName)).toBe(1);
  });

  test('el reintento del mismo POST con la misma clave devuelve el mismo pedido', async ({
    page,
  }) => {
    const bebida = await createBeverage(page, 'Bebida reintento', 5);
    const customerName = unique('Cliente Reintento');
    const ip = randomClientIp();
    const payload = {
      items: [{ productId: bebida.id, quantity: 1 }],
      customerName,
      customerPhone: '3415551234',
      deliveryType: 'pickup',
      idempotencyKey: `retry-${Date.now()}`,
    };

    const primero = await page.request.post('/api/public/pedido', {
      headers: { 'x-forwarded-for': ip },
      data: payload,
    });
    expect(primero.status()).toBe(201);

    // Simula el reintento de red del cliente con el MISMO body y clave:
    // el servidor deduplica y devuelve el pedido original.
    const reintento = await page.request.post('/api/public/pedido', {
      headers: { 'x-forwarded-for': ip },
      data: payload,
    });
    expect(reintento.status()).toBeLessThan(500);

    const order1 = (await primero.json()) as { order: { id: number } };
    const order2 = (await reintento.json()) as { order: { id: number } };
    expect(order2.order.id).toBe(order1.order.id);
    expect(await countOrdersByCustomer(customerName)).toBe(1);
  });

  test('doble envío del mismo mensaje de chat crea dos mensajes (sin dedupe)', async ({
    page,
  }) => {
    const bebida = await createBeverage(page, 'Bebida chat', 5);
    const pedido = await createPublicOrder(page, bebida.id);
    const content = `mismo texto ${Date.now()}`;

    const [a, b] = await Promise.all([
      page.request.post(
        `/api/public/pedido/${pedido.id}/chat?token=${pedido.cancellationToken}`,
        { data: { content } }
      ),
      page.request.post(
        `/api/public/pedido/${pedido.id}/chat?token=${pedido.cancellationToken}`,
        { data: { content } }
      ),
    ]);

    // R9 documentado: `order_messages` no tiene clave de idempotencia, así
    // que el doble envío (doble click / retry de red) persiste dos filas.
    // No es un bug de seguridad — se documenta el comportamiento real.
    expect(a.status()).toBe(201);
    expect(b.status()).toBe(201);

    const chat = await page.request.get(
      `/api/public/pedido/${pedido.id}/chat?token=${pedido.cancellationToken}`
    );
    expect(chat.status()).toBe(200);
    const body = (await chat.json()) as {
      messages: { content: string }[];
    };
    const duplicados = body.messages.filter((m) => m.content === content);
    expect(duplicados).toHaveLength(2);
  });

  test('el rate limit frena el abuso de creación desde una misma IP', async ({
    page,
  }) => {
    const bebida = await createBeverage(page, 'Bebida rate limit', 10);
    const customerName = unique('Cliente Abuso');
    const ip = randomClientIp();

    // PUBLIC_ORDER_RATE_LIMIT_MAX_REQUESTS=2 en .env.e2e: el tercer POST
    // consecutivo desde la misma IP debe ser rechazado.
    const resultados = [];
    for (let i = 0; i < 3; i++) {
      resultados.push(
        await page.request.post('/api/public/pedido', {
          headers: { 'x-forwarded-for': ip },
          data: {
            items: [{ productId: bebida.id, quantity: 1 }],
            customerName,
            customerPhone: '3415551234',
            deliveryType: 'pickup',
            idempotencyKey: `abuso-${i}-${Date.now()}`,
          },
        })
      );
    }

    expect(resultados[0].status()).toBe(201);
    expect(resultados[1].status()).toBe(201);
    expect(resultados[2].status()).toBe(429);
    expect(await countOrdersByCustomer(customerName)).toBe(2);
  });
});
