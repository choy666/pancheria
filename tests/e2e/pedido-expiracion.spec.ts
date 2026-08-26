import { test, expect } from '@playwright/test';
import {
  login,
  unique,
  createProductViaApi,
  ensureCashRegisterClosed,
  setOrderCreatedAt,
} from './helpers';
import { getOrderExpirationMs } from '../../src/config/orders';

/**
 * Valida que los pedidos pending se cancelen automáticamente cuando superan
 * ORDER_EXPIRATION_MS. La expiración se dispara al consultar el listado de
 * pedidos, que ejecuta orderService.expirePendingOrders(branchId).
 */
test.describe('Expiración automática de pedidos', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await ensureCashRegisterClosed(page);
  });

  test('cancela pedidos pending vencidos y refleja el estado en el chat', async ({
    page,
  }) => {
    const product = await createProductViaApi(page, {
      name: unique('Producto expiración'),
      type: 'service',
      price: 1000,
      unit: 'unidad',
      stock: 0,
      minStock: 0,
      isActive: true,
    });

    // Cliente: arma el pedido desde el catálogo público.
    await page.goto('/pedido');
    await expect(page.getByTestId(`product-card-${product.id}`)).toBeVisible();

    await page.getByTestId(`add-product-${product.id}`).click();
    await expect(page.getByText('Tu pedido', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Hacer pedido' }).click();
    await expect(page.getByText('Finalizar pedido')).toBeVisible();

    const customerName = unique('Cliente expiración');
    await page.getByLabel('Nombre').fill(customerName);
    await page.getByRole('button', { name: 'Confirmar pedido' }).click();

    await expect(page.getByText('Pedido creado')).toBeVisible();

    // Abre el chat para obtener el id y el token del pedido.
    await page.getByRole('button', { name: 'Ir al chat del pedido' }).click();
    await expect(page).toHaveURL(/\/pedido\/\d+\/chat/);

    const chatUrl = page.url();
    const match = chatUrl.match(/\/pedido\/(\d+)\/chat/);
    expect(match).not.toBeNull();
    const orderId = Number(match![1]);

    // Manipula la base de datos para que el pedido tenga una antigüedad
    // superior a ORDER_EXPIRATION_MS sin depender de esperar el tiempo real.
    const expirationMs = getOrderExpirationMs();
    const expiredCreatedAt = new Date(Date.now() - 2 * expirationMs);
    await setOrderCreatedAt(orderId, expiredCreatedAt);

    // Al consultar el listado de pedidos pending se dispara la expiración
    // de los pedidos vencidos (orderService.expirePendingOrders).
    const listRes = await page.request.get(
      `/api/pedidos?branchId=1&status=pending&page=1&limit=10`
    );
    expect(listRes.status()).toBe(200);

    // Verifica vía API que el pedido quedó cancelado por expiración automática.
    const response = await page.request.get(`/api/pedidos/${orderId}`);
    expect(response.status()).toBe(200);

    const data = (await response.json()) as {
      order: {
        status: string;
        cancellationReason: string | null;
      };
    };
    expect(data.order.status).toBe('cancelled');
    expect(data.order.cancellationReason).toMatch(/Expiración automática/);

    // El chat del pedido debe reflejar que ya no está pendiente.
    await page.goto(chatUrl);
    await expect(
      page.getByPlaceholder('El pedido no está pendiente.')
    ).toBeVisible();
  });
});
