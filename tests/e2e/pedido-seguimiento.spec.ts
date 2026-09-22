import { test, expect, type Page } from '@playwright/test';
import {
  login,
  unique,
  createProductViaApi,
  ensureCashRegisterOpen,
  setUniqueClientIp,
  getTestSecondBranch,
  waitForHydratedInput,
} from './helpers';

/**
 * Flujo público de seguimiento de pedidos (`/pedido/seguimiento`).
 *
 * El cliente ingresa el número de pedido más su nombre o teléfono; el
 * servidor resuelve con `trackOrder` filtrando por sucursal. Cubre también
 * la cancelación pública con `cancellationToken` y que la numeración de un
 * pedido no se resuelva bajo otra sucursal.
 */

type CreatedPublicOrder = {
  id: number;
  orderNumber: string;
  status: string;
  total: number;
  customerName: string;
  customerPhone: string;
  cancellationToken: string;
};

// `page.request` nace antes del `setUniqueClientIp` de `beforeEach`, así que
// no hereda el X-Forwarded-For del contexto: cada request API necesita su
// propia IP para no compartir el bucket del rate limit público (máx 2/min).
function randomClientIp() {
  const octet = () => Math.floor(Math.random() * 253) + 1;
  return `10.${octet()}.${octet()}.${octet()}`;
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

async function createPublicOrder(
  page: Page,
  productId: number,
  customerName: string,
  customerPhone = '3415551234'
): Promise<CreatedPublicOrder> {
  const response = await page.request.post('/api/public/pedido', {
    headers: { 'x-forwarded-for': randomClientIp() },
    data: {
      items: [{ productId, quantity: 1 }],
      customerName,
      customerPhone,
      deliveryType: 'pickup',
      idempotencyKey: `seguimiento-${customerName}-${Date.now()}`,
    },
  });
  expect(response.status()).toBe(201);
  const body = (await response.json()) as { order: CreatedPublicOrder };
  return body.order;
}

test.describe('Seguimiento público de pedidos', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await ensureCashRegisterOpen(page);
    await setUniqueClientIp(page);
  });

  test('busca un pedido por número y nombre, muestra su estado y permite ir al chat', async ({
    page,
  }) => {
    const product = await createServiceProduct(page, 'Servicio seguimiento');
    const customerName = unique('Cliente Seguimiento');
    const order = await createPublicOrder(page, product.id, customerName);

    await page.goto('/pedido/seguimiento');
    // En WebKit la hidratación puede demorar: un fill previo deja el valor
    // en el DOM pero no en el estado controlado y se pierde al re-render.
    await waitForHydratedInput(page, '#orderNumber');
    await page.getByLabel('Número de pedido').fill(order.orderNumber);
    await page.getByLabel('Tu nombre').fill(customerName);
    await page.getByRole('button', { name: 'Buscar pedido' }).click();

    // La tarjeta del pedido muestra el estado actual y el progreso
    // (CardTitle renderiza un div, no un heading).
    await expect(
      page.getByText(`Pedido #${order.orderNumber}`)
    ).toBeVisible();
    const progress = page.getByTestId('order-progress');
    await expect(progress).toBeVisible();
    await expect(progress.getByText('Pendiente')).toBeVisible();
    await expect(page.getByText(customerName)).toBeVisible();

    // Un pedido pending expone el token: el link lleva al chat público.
    await page.getByRole('link', { name: 'Ir al chat del pedido' }).click();
    await expect(page).toHaveURL(
      new RegExp(`/pedido/${order.id}/chat\\?token=`)
    );
  });

  test('no encuentra el pedido cuando los datos del cliente no coinciden', async ({
    page,
  }) => {
    const product = await createServiceProduct(page, 'Servicio seguimiento');
    const order = await createPublicOrder(
      page,
      product.id,
      unique('Cliente Seguimiento')
    );

    await page.goto('/pedido/seguimiento');
    await waitForHydratedInput(page, '#orderNumber');
    await page.getByLabel('Número de pedido').fill(order.orderNumber);
    await page.getByLabel('Tu nombre').fill('Otro Nombre Que No Coincide');
    await page.getByRole('button', { name: 'Buscar pedido' }).click();

    await expect(page.getByText(/No se encontró el pedido/)).toBeVisible();
    await expect(page.getByText(/Pedido #/)).not.toBeVisible();
  });

  test('muestra el pedido cancelado tras la cancelación pública con token', async ({
    page,
  }) => {
    const product = await createServiceProduct(page, 'Servicio seguimiento');
    const customerName = unique('Cliente Seguimiento');
    const order = await createPublicOrder(page, product.id, customerName);

    const cancelResponse = await page.request.post(
      `/api/public/pedido/${order.id}/cancelar`,
      {
        headers: { 'x-forwarded-for': randomClientIp() },
        data: {
          reason: 'Cancelación del cliente desde seguimiento',
          token: order.cancellationToken,
        },
      }
    );
    expect(cancelResponse.status()).toBe(200);

    await page.goto('/pedido/seguimiento');
    await waitForHydratedInput(page, '#orderNumber');
    await page.getByLabel('Número de pedido').fill(order.orderNumber);
    await page.getByLabel('Teléfono').fill(order.customerPhone);
    await page.getByRole('button', { name: 'Buscar pedido' }).click();

    await expect(
      page.getByText(`Pedido #${order.orderNumber}`)
    ).toBeVisible();
    await expect(page.getByText('Este pedido fue cancelado.')).toBeVisible();
    // Sin token en la respuesta de un pedido cancelado: no hay link al chat.
    await expect(
      page.getByRole('link', { name: 'Ir al chat del pedido' })
    ).not.toBeVisible();
  });

  test('la cancelación con token inválido es rechazada', async ({ page }) => {
    const product = await createServiceProduct(page, 'Servicio seguimiento');
    const order = await createPublicOrder(
      page,
      product.id,
      unique('Cliente Seguimiento')
    );

    const cancelResponse = await page.request.post(
      `/api/public/pedido/${order.id}/cancelar`,
      {
        headers: { 'x-forwarded-for': randomClientIp() },
        data: {
          reason: 'Intento con token ajeno',
          token: 'token-invalido-123',
        },
      }
    );
    expect(cancelResponse.status()).toBe(400);
  });

  test('un pedido no se resuelve bajo otra sucursal aunque coincida el número', async ({
    page,
  }) => {
    const second = await getTestSecondBranch();
    const product = await createServiceProduct(page, 'Servicio seguimiento');
    const customerName = unique('Cliente Seguimiento');
    const order = await createPublicOrder(page, product.id, customerName);

    // Mismo orderNumber + datos del cliente, pero branchId de otra sucursal:
    // orderNumber es único por sucursal, así que el lookup no debe resolverlo.
    const response = await page.request.post('/api/public/pedido/seguimiento', {
      headers: { 'x-forwarded-for': randomClientIp() },
      data: {
        orderNumber: order.orderNumber,
        customerName,
        branchId: second.branchId,
      },
    });
    expect(response.status()).toBe(404);
  });
});
