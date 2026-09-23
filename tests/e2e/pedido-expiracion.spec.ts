import { test, expect, type Page } from '@playwright/test';
import {
  login,
  unique,
  createProductViaApi,
  ensureCashRegisterOpen,
  setUniqueClientIp,
  expireOrderById,
  getOrderRowFromDb,
  countOrderReservations,
  countStockMovements,
  getDefaultBranchId,
  insertOrderReservation,
  restockProductViaApi,
} from './helpers';

/**
 * Expiración de pedidos `pending` (C2.1 del plan de auditoría).
 *
 * La expiración es lazy: `expireStalePendingOrders` corre en lecturas
 * (`getOrders`, `getPendingOrders`, `trackOrder`) y el cron `expire-orders`.
 * Acá se backdatea `created_at` directo en la base —mismo patrón que los
 * helpers que mutan `branches`/`cash_registers`— para simular un pedido que
 * venció y todavía no fue barrido por ninguna lectura ni por el cron.
 *
 * La pregunta de dominio: ¿las mutaciones (`recibir`, `confirmar`) respetan
 * la ventana de expiración o solo el estado almacenado?
 *
 * Hallazgo QA-2026-09-21-01 (corregido): `receiveOrder` y
 * `convertOrderToSale` validaban `status` pero nunca
 * `createdAt + ORDER_EXPIRATION_MS`. Un `pending` vencido todavía no barrido
 * podía recibirse (reserva stock) y confirmarse (crea la venta y el
 * movimiento de caja). Ahora ambas mutaciones verifican la expiración bajo
 * el lock de la fila, confirman la cancelación en una transacción propia
 * (un throw adentro haría rollback también de la cancelación) y responden
 * 409.
 */

type CreatedPublicOrder = {
  id: number;
  orderNumber: string;
  status: string;
  total: number;
  customerName: string;
};

function randomClientIp() {
  const octet = () => Math.floor(Math.random() * 253) + 1;
  return `10.${octet()}.${octet()}.${octet()}`;
}

async function createPublicOrder(
  page: Page,
  productId: number,
  customerName: string
): Promise<CreatedPublicOrder> {
  const response = await page.request.post('/api/public/pedido', {
    headers: { 'x-forwarded-for': randomClientIp() },
    data: {
      items: [{ productId, quantity: 1 }],
      customerName,
      customerPhone: '3415551234',
      deliveryType: 'pickup',
      idempotencyKey: `expiracion-${customerName}-${Date.now()}`,
    },
  });
  expect(response.status()).toBe(201);
  const body = (await response.json()) as { order: CreatedPublicOrder };
  return body.order;
}

async function createServiceProduct(page: Page, name: string) {
  return createProductViaApi(page, {
    name: unique(name),
    type: 'service',
    price: 1500,
    unit: 'unidad',
    isActive: true,
  });
}

test.describe('Expiración de pedidos pending', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await ensureCashRegisterOpen(page);
    await setUniqueClientIp(page);
  });

  test('un pedido pending vencido no puede recibirse', async ({ page }) => {
    const product = await createServiceProduct(page, 'Servicio expirado');
    const order = await createPublicOrder(
      page,
      product.id,
      unique('Cliente Expira')
    );
    // Backdatea created_at más allá de ORDER_EXPIRATION_MS.
    await expireOrderById(order.id);

    const recibir = await page.request.post(
      `/api/pedidos/${order.id}/recibir`
    );

    // La mutación rechaza con 409 y cancela el pedido en la misma
    // transacción, bajo el lock de la fila.
    expect(recibir.status()).toBe(409);
    const row = await getOrderRowFromDb(order.id);
    expect(row?.status).toBe('cancelled');
    expect(await countOrderReservations(order.id)).toBe(0);
  });

  test('un pedido pending vencido no puede confirmarse como venta', async ({
    page,
  }) => {
    const product = await createServiceProduct(page, 'Servicio expirado');
    const order = await createPublicOrder(
      page,
      product.id,
      unique('Cliente Expira')
    );
    await expireOrderById(order.id);

    const confirmar = await page.request.post(
      `/api/pedidos/${order.id}/confirmar`,
      {
        data: {
          payments: [{ method: 'cash', amount: order.total }],
          idempotencyKey: `confirmar-expirado-${order.id}-${Date.now()}`,
        },
      }
    );

    expect(confirmar.status()).toBe(409);
    const row = await getOrderRowFromDb(order.id);
    expect(row?.status).toBe('cancelled');
    expect(row?.convertedSaleId).toBeNull();
  });

  test('con la lista abierta el pedido vencido sigue mostrando Confirmar pago y el click no debe crear venta', async ({
    page,
  }) => {
    const product = await createServiceProduct(page, 'Servicio expirado');
    const order = await createPublicOrder(
      page,
      product.id,
      unique('Cliente Expira')
    );

    // El operador abre la lista mientras el pedido sigue vigente.
    await page.goto('/pedidos');
    const confirmButton = page.getByTestId(`confirm-order-${order.id}`);
    await expect(confirmButton).toBeVisible();

    // El pedido vence por detrás: ninguna lectura nueva lo barre porque
    // la pantalla ya estaba cargada.
    await expireOrderById(order.id);

    // La fila quedó stale: el botón sigue visible pese al vencimiento.
    await expect(confirmButton).toBeVisible();
    await confirmButton.click();

    // El operador ve el rechazo: antes el error quedaba como una
    // promesa rechazada sin handler y la fila stale no informaba nada.
    await expect(page.getByTestId('pedidos-action-error')).toBeVisible();

    // La mutación debe rechazar el pedido vencido y cancelarlo en la
    // misma transacción. Se verifica directo en la base para no disparar
    // el barrido lazy con una lectura por API.
    await expect
      .poll(async () => (await getOrderRowFromDb(order.id))?.status)
      .toBe('cancelled');
    const row = await getOrderRowFromDb(order.id);
    expect(row?.convertedSaleId).toBeNull();
    expect(await countOrderReservations(order.id)).toBe(0);
  });

  test('un pedido in_process más viejo que la ventana de expiración puede confirmarse', async ({
    page,
  }) => {
    const product = await createServiceProduct(page, 'Servicio vigente');
    const order = await createPublicOrder(
      page,
      product.id,
      unique('Cliente Vigente')
    );

    // El operador lo recibe: pasa a in_process, estado que no vence.
    const recibir = await page.request.post(
      `/api/pedidos/${order.id}/recibir`
    );
    expect(recibir.status()).toBe(200);

    // El pedido supera ORDER_EXPIRATION_MS en antigüedad pero ya fue
    // aceptado: la expiración solo aplica a `pending`.
    await expireOrderById(order.id);

    const confirmar = await page.request.post(
      `/api/pedidos/${order.id}/confirmar`,
      {
        data: {
          payments: [{ method: 'cash', amount: order.total }],
          idempotencyKey: `confirmar-inprocess-${order.id}-${Date.now()}`,
        },
      }
    );

    expect(confirmar.status()).toBe(201);
    const row = await getOrderRowFromDb(order.id);
    expect(row?.status).toBe('paid');
    expect(row?.convertedSaleId).not.toBeNull();
  });

  test('carrera recibir + confirmar + barrido sobre un pedido vencido: se cancela una sola vez y la reserva legada se libera una sola vez', async ({
    page,
  }) => {
    // Insumo vendible por el canal público con stock, para la reserva.
    const insumo = await createProductViaApi(page, {
      name: unique('Insumo carrera'),
      type: 'critical_supply',
      criticalSupplyType: 'beverage',
      price: 0,
      unit: 'unidad',
      isActive: true,
    });
    await restockProductViaApi(page, insumo.id, 10);

    const product = await createServiceProduct(page, 'Servicio expirado');
    const order = await createPublicOrder(
      page,
      product.id,
      unique('Cliente Expira')
    );

    // Reserva legada sobre un pedido pending: el flujo actual no reserva
    // en pending, pero la cancelación por expiración libera reservas si
    // quedaron (datos heredados).
    const branchId = await getDefaultBranchId();
    await insertOrderReservation({
      branchId,
      orderId: order.id,
      productId: insumo.id,
      quantity: 2,
    });

    await expireOrderById(order.id);

    const [recibir, confirmar, listado] = await Promise.all([
      page.request.post(`/api/pedidos/${order.id}/recibir`),
      page.request.post(`/api/pedidos/${order.id}/confirmar`, {
        data: {
          payments: [{ method: 'cash', amount: order.total }],
          idempotencyKey: `confirmar-carrera-${order.id}-${Date.now()}`,
        },
      }),
      // Una lectura del listado dispara el barrido lazy de expiración.
      page.request.get('/api/pedidos'),
    ]);

    // Ninguna mutación puede tener éxito sobre el pedido vencido: el
    // rechazo es 409 (detectó la expiración bajo lock) o 400 (el barrido
    // ganó la carrera y ya estaba cancelado).
    for (const response of [recibir, confirmar]) {
      expect(response.status()).toBeGreaterThanOrEqual(400);
      expect(response.status()).toBeLessThan(500);
    }
    expect(listado.status()).toBe(200);

    const row = await getOrderRowFromDb(order.id);
    expect(row?.status).toBe('cancelled');
    expect(row?.convertedSaleId).toBeNull();

    // La reserva legada se liberó exactamente una vez: sin reservas
    // activas y un único movimiento reserve_release para el pedido.
    expect(await countOrderReservations(order.id)).toBe(0);
    expect(
      await countStockMovements({
        productId: insumo.id,
        type: 'reserve_release',
        orderId: order.id,
      })
    ).toBe(1);

    // Sin venta ni descuento de stock huérfano para el insumo.
    expect(
      await countStockMovements({ productId: insumo.id, type: 'sale' })
    ).toBe(0);
  });
});
