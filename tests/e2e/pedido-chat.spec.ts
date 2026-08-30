import { test, expect } from '@playwright/test';
import { login, unique, createProductViaApi, ensureCashRegisterOpen, setUniqueClientIp } from './helpers';

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
    await expect(page.getByText('Tu pedido', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Hacer pedido' }).click();
    await expect(page.getByText('Finalizar pedido')).toBeVisible();

    const customerName = unique('Juan Pérez');
    const customerPhone = '3415555555';
    await page.getByLabel('Nombre').fill(customerName);
    await page.getByLabel('Teléfono').fill(customerPhone);
    await page.getByRole('button', { name: 'Confirmar pedido' }).click();

    await expect(page.getByText('Pedido creado')).toBeVisible();
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

    await expect(page.getByText('Chat con el cliente')).toBeVisible();
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
});
