import { test, expect } from '@playwright/test';
import { login, unique, createProductViaApi } from './helpers';

test.describe('Chat anclado a pedidos', () => {
  test('cliente y operador intercambian mensajes', async ({ page }) => {
    await login(page);

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

    await page.getByLabel('Nombre').fill('Juan Pérez');
    await page.getByRole('button', { name: 'Confirmar pedido' }).click();

    await expect(page.getByText('Pedido creado')).toBeVisible();
    await page.getByRole('button', { name: 'Ir al chat del pedido' }).click();

    await expect(page).toHaveURL(/\/pedido\/\d+\/chat/);
    const clientChatUrl = page.url();

    // Cliente envía mensaje.
    const clientMessage = '¿Cuándo llega?';
    await page.getByPlaceholder('Escribí un mensaje...').fill(clientMessage);
    await page.getByRole('button', { name: 'Enviar mensaje' }).click();
    await expect(page.getByText(clientMessage)).toBeVisible();

    // Operador: inicia sesión y abre el pedido.
    await login(page);
    await page.goto('/pedidos');

    await expect(page.getByText('Juan Pérez')).toBeVisible();
    await page.getByRole('link', { name: 'Ver' }).first().click();

    await expect(page.getByText('Chat con el cliente')).toBeVisible();
    await expect(page.getByText(clientMessage)).toBeVisible();

    const operatorMessage = 'En 20 minutos.';
    await page.getByPlaceholder('Escribí un mensaje...').fill(operatorMessage);
    await page.getByRole('button', { name: 'Enviar mensaje' }).click();

    await expect(page.getByText(operatorMessage)).toBeVisible();

    // Cliente ve la respuesta recargando la URL del chat.
    await page.goto(clientChatUrl);
    await expect(page.getByText(operatorMessage)).toBeVisible();
  });
});
