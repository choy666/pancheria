import { test, expect } from '@playwright/test';
import {
  login,
  unique,
  createProductViaApi,
  ensureCashRegisterOpen,
  setUniqueClientIp,
  getDefaultBranchId,
  setBranchLocation,
} from './helpers';

test.describe('Chat anclado a pedidos', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await ensureCashRegisterOpen(page);
    await setUniqueClientIp(page);
  });

  test('cliente y operador intercambian mensajes', async ({ page }) => {
    const product = await createProductViaApi(page, {
      name: unique('Chat E2E'),
      type: 'service',
      price: 1000,
      unit: 'unidad',
      stock: 0,
      minStock: 0,
      isActive: true,
    });

    // Cliente: arma pedido público.
    await page.goto('/pedido');
    await expect(page.getByTestId(`product-card-${product.id}`)).toBeVisible();

    await page.getByTestId(`add-product-${product.id}`).click();
    await expect(page.getByTestId('cart-title')).toBeVisible();

    await page.getByRole('button', { name: 'Hacer pedido' }).click();
    await expect(page.getByTestId('checkout-dialog-title')).toBeVisible();

    const customerName = unique('Juan Pérez');
    const customerPhone = '3415555555';
    await page.getByLabel('Nombre').fill(customerName);
    await page.getByLabel('Teléfono').fill(customerPhone);
    await page.getByRole('button', { name: 'Confirmar pedido' }).click();

    await expect(page.getByTestId('order-success-title')).toBeVisible();
    await page.getByRole('button', { name: 'Ir al chat del pedido' }).click();

    await expect(page).toHaveURL(/\/pedido\/\d+\/chat/);
    const clientChatUrl = page.url();

    // Cliente envía mensaje.
    const clientMessage = '¿Cuándo llega?';
    await page.getByPlaceholder('Escribí un mensaje...').fill(clientMessage);
    await page.getByRole('button', { name: 'Enviar mensaje' }).click();

    await expect(page.getByPlaceholder('Escribí un mensaje...')).toHaveValue('');
    await expect(
      page.getByTestId('chat-message-text').filter({ hasText: clientMessage })
    ).toBeVisible();

    // Operador: inicia sesión y abre el pedido.
    await login(page);
    await page.goto('/pedidos');

    const orderRow = page
      .locator('[data-testid^="row-order-"]')
      .filter({ hasText: customerName });
    await expect(orderRow).toBeVisible({ timeout: 10000 });
    await orderRow.getByRole('link', { name: 'Ver' }).click();

    await expect(page.getByTestId('chat-title')).toHaveText(
      'Chat con el cliente'
    );
    await expect(
      page.getByTestId('chat-message-text').filter({ hasText: clientMessage })
    ).toBeVisible({ timeout: 15000 });

    const operatorMessage = 'En 20 minutos.';
    await page.getByPlaceholder('Escribí un mensaje...').fill(operatorMessage);
    await page.getByRole('button', { name: 'Enviar mensaje' }).click();

    await expect(page.getByPlaceholder('Escribí un mensaje...')).toHaveValue('');
    await expect(
      page.getByTestId('chat-message-text').filter({ hasText: operatorMessage })
    ).toBeVisible({ timeout: 10000 });

    // Cliente ve la respuesta recargando la URL del chat.
    await page.goto(clientChatUrl);
    await expect(
      page.getByTestId('chat-message-text').filter({ hasText: operatorMessage })
    ).toBeVisible({ timeout: 15000 });
  });

  test('cliente comparte su ubicación en un pedido delivery', async ({ page, context }) => {
    const product = await createProductViaApi(page, {
      name: unique('Chat Delivery E2E'),
      type: 'service',
      price: 1000,
      unit: 'unidad',
      stock: 0,
      minStock: 0,
      isActive: true,
    });

    await page.goto('/pedido');
    await expect(page.getByTestId(`product-card-${product.id}`)).toBeVisible();

    await page.getByTestId(`add-product-${product.id}`).click();
    await expect(page.getByTestId('cart-title')).toBeVisible();

    await page.getByRole('button', { name: 'Hacer pedido' }).click();
    await expect(page.getByTestId('checkout-dialog-title')).toBeVisible();

    const customerName = unique('Cliente Delivery');
    const customerPhone = '3415555555';
    const address = 'Av. Pellegrini 1234, Rosario';

    await page.getByLabel('Nombre').fill(customerName);
    await page.getByLabel('Teléfono').fill(customerPhone);
    await page.locator('[id="deliveryType"]').click();
    await page.getByRole('option', { name: 'Envío a domicilio' }).click();
    await page.getByLabel('Dirección').fill(address);
    await page.getByRole('button', { name: 'Confirmar pedido' }).click();

    await expect(page.getByTestId('order-success-title')).toBeVisible();
    await page.getByRole('button', { name: 'Ir al chat del pedido' }).click();

    await expect(page).toHaveURL(/\/pedido\/\d+\/chat/);

    await context.setGeolocation({ latitude: -34.6037, longitude: -58.3816 });
    await context.grantPermissions(['geolocation']);

    const clientLocationButton = page.getByTestId('chat-client-location-button');
    await expect(clientLocationButton).toHaveAttribute(
      'aria-label',
      'Compartir ubicación'
    );
    await expect(clientLocationButton).toHaveAttribute(
      'title',
      'Compartir ubicación'
    );

    await clientLocationButton.click();

    await expect(page.getByPlaceholder('Escribí un mensaje...')).toHaveValue(
      /openstreetmap\.org/,
      { timeout: 10000 }
    );

    await page.getByRole('button', { name: 'Enviar mensaje' }).click();

    const clientChatLink = page
      .getByTestId('chat-location-link')
      .filter({ hasText: 'Ver ubicación' });
    await expect(clientChatLink).toBeVisible({ timeout: 15000 });
    await expect(clientChatLink).toHaveAttribute('target', '_blank');
    await expect(clientChatLink).toHaveAttribute('rel', 'noopener noreferrer');

    await login(page);
    await page.goto('/pedidos');

    const orderRow = page
      .locator('[data-testid^="row-order-"]')
      .filter({ hasText: customerName });
    await expect(orderRow).toBeVisible({ timeout: 10000 });
    await orderRow.getByRole('link', { name: 'Ver' }).click();

    await expect(
      page.getByTestId('chat-location-link').filter({ hasText: 'Ver ubicación' })
    ).toBeVisible({ timeout: 15000 });
  });

  test('operador comparte la ubicación de la sucursal en un pedido pickup', async ({ page }) => {
    const defaultBranchId = await getDefaultBranchId();
    await setBranchLocation(
      defaultBranchId,
      'https://www.openstreetmap.org/?mlat=-34.6&mlon=-58.3'
    );

    const product = await createProductViaApi(page, {
      name: unique('Chat Pickup E2E'),
      type: 'service',
      price: 1000,
      unit: 'unidad',
      stock: 0,
      minStock: 0,
      isActive: true,
    });

    await page.goto('/pedido');
    await expect(page.getByTestId(`product-card-${product.id}`)).toBeVisible();

    await page.getByTestId(`add-product-${product.id}`).click();
    await expect(page.getByTestId('cart-title')).toBeVisible();

    await page.getByRole('button', { name: 'Hacer pedido' }).click();
    await expect(page.getByTestId('checkout-dialog-title')).toBeVisible();

    const customerName = unique('Cliente Pickup');
    const customerPhone = '3415555555';

    await page.getByLabel('Nombre').fill(customerName);
    await page.getByLabel('Teléfono').fill(customerPhone);
    await page.getByRole('button', { name: 'Confirmar pedido' }).click();

    await expect(page.getByTestId('order-success-title')).toBeVisible();
    await page.getByRole('button', { name: 'Ir al chat del pedido' }).click();

    await expect(page).toHaveURL(/\/pedido\/\d+\/chat/);
    const clientChatUrl = page.url();

    await login(page);
    await page.goto('/pedidos');

    const orderRow = page
      .locator('[data-testid^="row-order-"]')
      .filter({ hasText: customerName });
    await expect(orderRow).toBeVisible({ timeout: 10000 });
    await orderRow.getByRole('link', { name: 'Ver' }).click();

    await expect(page.getByTestId('chat-title')).toHaveText(
      'Chat con el cliente'
    );

    const branchLocationButton = page.getByTestId('chat-branch-location-button');
    await expect(branchLocationButton).toHaveAttribute(
      'aria-label',
      'Enviar ubicación de la sucursal'
    );
    await expect(branchLocationButton).toHaveAttribute(
      'title',
      'Enviar ubicación de la sucursal'
    );

    await branchLocationButton.click();

    const branchChatLink = page
      .getByTestId('chat-location-link')
      .filter({ hasText: 'Ver ubicación' });
    await expect(branchChatLink).toBeVisible({ timeout: 15000 });
    await expect(branchChatLink).toHaveAttribute('target', '_blank');
    await expect(branchChatLink).toHaveAttribute('rel', 'noopener noreferrer');

    await page.goto(clientChatUrl);
    await expect(
      page.getByTestId('chat-location-link').filter({ hasText: 'Ver ubicación' })
    ).toBeVisible({ timeout: 15000 });
  });

  test('el botón de ubicación del cliente no es visible en pedidos pickup', async ({
    page,
  }) => {
    const product = await createProductViaApi(page, {
      name: unique('Chat Pickup Cliente'),
      type: 'service',
      price: 1000,
      unit: 'unidad',
      stock: 0,
      minStock: 0,
      isActive: true,
    });

    await page.goto('/pedido');
    await expect(page.getByTestId(`product-card-${product.id}`)).toBeVisible();

    await page.getByTestId(`add-product-${product.id}`).click();
    await expect(page.getByTestId('cart-title')).toBeVisible();

    await page.getByRole('button', { name: 'Hacer pedido' }).click();
    await expect(page.getByTestId('checkout-dialog-title')).toBeVisible();

    const customerName = unique('Cliente Pickup Sin Ubicación');
    await page.getByLabel('Nombre').fill(customerName);
    await page.getByLabel('Teléfono').fill('3415555555');
    await page.getByRole('button', { name: 'Confirmar pedido' }).click();

    await expect(page.getByTestId('order-success-title')).toBeVisible();
    await page.getByRole('button', { name: 'Ir al chat del pedido' }).click();

    await expect(page).toHaveURL(/\/pedido\/\d+\/chat/);
    await expect(
      page.getByTestId('chat-client-location-button')
    ).toHaveCount(0);
  });

  test('el botón de ubicación de la sucursal no es visible sin branchLocation', async ({
    page,
  }) => {
    const defaultBranchId = await getDefaultBranchId();
    await setBranchLocation(defaultBranchId, '');

    const product = await createProductViaApi(page, {
      name: unique('Chat Pickup Sin BranchLocation'),
      type: 'service',
      price: 1000,
      unit: 'unidad',
      stock: 0,
      minStock: 0,
      isActive: true,
    });

    await page.goto('/pedido');
    await expect(page.getByTestId(`product-card-${product.id}`)).toBeVisible();

    await page.getByTestId(`add-product-${product.id}`).click();
    await expect(page.getByTestId('cart-title')).toBeVisible();

    await page.getByRole('button', { name: 'Hacer pedido' }).click();
    await expect(page.getByTestId('checkout-dialog-title')).toBeVisible();

    const customerName = unique('Cliente Pickup Sin Loc Sucursal');
    await page.getByLabel('Nombre').fill(customerName);
    await page.getByLabel('Teléfono').fill('3415555555');
    await page.getByRole('button', { name: 'Confirmar pedido' }).click();

    await expect(page.getByTestId('order-success-title')).toBeVisible();

    await login(page);
    await page.goto('/pedidos');

    const orderRow = page
      .locator('[data-testid^="row-order-"]')
      .filter({ hasText: customerName });
    await expect(orderRow).toBeVisible({ timeout: 10000 });
    await orderRow.getByRole('link', { name: 'Ver' }).click();

    await expect(page.getByTestId('chat-title')).toHaveText(
      'Chat con el cliente'
    );
    await expect(
      page.getByTestId('chat-branch-location-button')
    ).toHaveCount(0);
  });

  test('vista móvil: los botones de ubicación no rompen el layout', async ({
    page,
  }) => {
    const defaultBranchId = await getDefaultBranchId();
    await setBranchLocation(
      defaultBranchId,
      'https://www.openstreetmap.org/?mlat=-34.6&mlon=-58.3'
    );

    const product = await createProductViaApi(page, {
      name: unique('Chat Mobile Pickup'),
      type: 'service',
      price: 1000,
      unit: 'unidad',
      stock: 0,
      minStock: 0,
      isActive: true,
    });

    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/pedido');
    await expect(page.getByTestId(`product-card-${product.id}`)).toBeVisible();

    await page.getByTestId(`add-product-${product.id}`).click();
    await expect(page.getByTestId('cart-title')).toBeVisible();

    await page.getByRole('button', { name: 'Hacer pedido' }).click();
    await expect(page.getByTestId('checkout-dialog-title')).toBeVisible();

    const customerName = unique('Cliente Mobile Pickup');
    await page.getByLabel('Nombre').fill(customerName);
    await page.getByLabel('Teléfono').fill('3415555555');
    await page.getByRole('button', { name: 'Confirmar pedido' }).click();

    await expect(page.getByTestId('order-success-title')).toBeVisible();

    await login(page);
    await page.goto('/pedidos');

    const orderRow = page
      .locator('[data-testid^="row-order-"]')
      .filter({ hasText: customerName });
    await expect(orderRow).toBeVisible({ timeout: 10000 });
    await orderRow.getByRole('link', { name: 'Ver' }).click();

    await expect(page.getByTestId('chat-title')).toHaveText(
      'Chat con el cliente'
    );

    const branchButton = page.getByTestId('chat-branch-location-button');
    await expect(branchButton).toBeVisible();

    await branchButton.click();

    const locationLink = page
      .getByTestId('chat-location-link')
      .filter({ hasText: 'Ver ubicación' });
    await expect(locationLink).toBeVisible({ timeout: 15000 });

    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth
    );
    expect(scrollWidth).toBeLessThanOrEqual(375);
  });
});
