import { test, expect } from '@playwright/test';
import { login, unique, createProductViaApi } from './helpers';

test.describe('Pedido público por WhatsApp', () => {
  test('muestra el catálogo, permite armar el carrito y abrir el checkout', async ({
    page,
  }) => {
    await login(page);

    const product = await createProductViaApi(page, {
      name: unique('Pedido E2E'),
      type: 'service',
      price: 1000,
      unit: 'unidad',
      stock: 0,
      minStock: 0,
      isActive: true,
    });

    await page.goto('/pedido');
    await expect(page.getByText(product.name)).toBeVisible();

    await page.getByRole('button', { name: 'Agregar' }).first().click();
    await expect(page.getByText('Tu pedido')).toBeVisible();
    await expect(page.getByText(product.name)).toBeVisible();

    await page.getByRole('button', { name: 'Pedir por WhatsApp' }).click();
    await expect(page.getByText('Finalizar pedido')).toBeVisible();

    await page.fill('input#customerName', 'Juan Pérez');

    // Sin NEXT_PUBLIC_WHATSAPP_NUMBER configurado, el envío muestra un error
    // claro en lugar de abrir un enlace inválido.
    await page.getByRole('button', { name: 'Reservar y abrir WhatsApp' }).click();
    await expect(
      page.getByText('NEXT_PUBLIC_WHATSAPP_NUMBER no está configurado')
    ).toBeVisible();
  });
});
