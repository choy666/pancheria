import { test, expect } from '@playwright/test';
import { login, unique, createProductViaApi } from './helpers';

/**
 * Confirma y cancela pedidos desde el panel de operador.
 */
test.describe('Confirmación y cancelación de pedidos desde el panel', () => {
  test('confirma un pedido público como venta desde el panel', async ({ page }) => {
    await login(page);

    const product = await createProductViaApi(page, {
      name: unique('Producto confirmable'),
      type: 'service',
      price: 1000,
      unit: 'unidad',
      stock: 0,
      minStock: 0,
      isActive: true,
    });

    await page.goto('/pedido');
    await page.getByTestId(`add-product-${product.id}`).click();
    await page.getByRole('button', { name: 'Hacer pedido' }).click();

    const customerName = unique('Cliente confirmable');
    await page.getByLabel('Nombre').fill(customerName);
    await page.getByRole('button', { name: 'Confirmar pedido' }).click();
    await expect(page.getByText(/se creó correctamente/)).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar' }).click();

    await page.goto('/pedidos');
    await expect(page.getByText(customerName)).toBeVisible({ timeout: 10000 });
    const row = page.locator('[data-testid^="row-order-"]').filter({ hasText: customerName });
    await row.getByRole('link', { name: 'Ver' }).click();

    await page.getByLabel('Medio de pago').click();
    await page.getByRole('option', { name: 'Efectivo' }).click();
    await page.getByRole('button', { name: 'Confirmar como venta' }).click();

    await expect(page.getByText('Confirmando...')).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Confirmado')).toBeVisible({ timeout: 10000 });
  });

  test('cancela un pedido público desde el panel', async ({ page }) => {
    await login(page);

    const product = await createProductViaApi(page, {
      name: unique('Producto cancelable'),
      type: 'service',
      price: 1000,
      unit: 'unidad',
      stock: 0,
      minStock: 0,
      isActive: true,
    });

    await page.goto('/pedido');
    await page.getByTestId(`add-product-${product.id}`).click();
    await page.getByRole('button', { name: 'Hacer pedido' }).click();

    const customerName = unique('Cliente cancelable');
    await page.getByLabel('Nombre').fill(customerName);
    await page.getByRole('button', { name: 'Confirmar pedido' }).click();
    await expect(page.getByText(/se creó correctamente/)).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar' }).click();

    await page.goto('/pedidos');
    await expect(page.getByText(customerName)).toBeVisible({ timeout: 10000 });
    const row = page.locator('[data-testid^="row-order-"]').filter({ hasText: customerName });
    await row.getByRole('link', { name: 'Ver' }).click();

    await page.getByLabel('Motivo de cancelación').fill('Cancelado desde el panel');
    await page.getByRole('button', { name: 'Cancelar pedido' }).click();

    await expect(page.getByText('Cancelando...')).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Cancelado')).toBeVisible({ timeout: 10000 });
  });
});
