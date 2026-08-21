import { test, expect } from '@playwright/test';
import { login, unique, createProductViaApi } from './helpers';

const PNG_PIXEL_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function pngBuffer(): Buffer {
  return Buffer.from(PNG_PIXEL_BASE64, 'base64');
}

test.describe('Chat con adjuntos', () => {
  test('cliente y operador intercambian imágenes', async ({ page }) => {
    await login(page);

    const product = await createProductViaApi(page, {
      name: unique('Chat Adjuntos'),
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

    await page.getByRole('button', { name: 'Pedir por WhatsApp' }).click();
    await expect(page.getByText('Finalizar pedido')).toBeVisible();

    await page.fill('input#customerName', 'María López');
    await page.getByRole('button', { name: 'Enviar pedido por WhatsApp' }).click();

    await expect(page.getByText('Pedido creado')).toBeVisible();
    await page.getByRole('button', { name: 'Ir al chat del pedido' }).click();

    await expect(page).toHaveURL(/\/pedido\/\d+\/chat/);
    const clientChatUrl = page.url();

    // Cliente envía una imagen.
    await page.getByTestId('chat-file-input').setInputFiles({
      name: 'cliente.png',
      mimeType: 'image/png',
      buffer: pngBuffer(),
    });
    await page.getByRole('button', { name: 'Enviar mensaje' }).click();

    await expect(page.getByTestId('chat-attachment-image').first()).toBeVisible();

    // Operador: inicia sesión y abre el pedido.
    await login(page);
    await page.goto('/pedidos');

    await expect(page.getByText('María López')).toBeVisible();
    await page.getByRole('link', { name: 'Ver' }).first().click();

    await expect(page.getByText('Chat con el cliente')).toBeVisible();
    await expect(page.getByTestId('chat-attachment-image').first()).toBeVisible();

    // Operador responde con una imagen.
    await page.getByTestId('chat-file-input').setInputFiles({
      name: 'operador.png',
      mimeType: 'image/png',
      buffer: pngBuffer(),
    });
    await page.getByRole('button', { name: 'Enviar mensaje' }).click();

    await expect(page.getByTestId('chat-attachment-image').nth(1)).toBeVisible();

    // Cliente ve la respuesta recargando la URL del chat.
    await page.goto(clientChatUrl);
    await expect(page.getByTestId('chat-attachment-image').nth(1)).toBeVisible();
  });
});
