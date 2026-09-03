import { test, expect } from '@playwright/test';
import {
  login,
  unique,
  createProductViaApi,
  ensureCashRegisterClosed,
  setUniqueClientIp,
} from './helpers';

test.describe('Bloqueo de pedido con sucursal cerrada', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await ensureCashRegisterClosed(page);
    await setUniqueClientIp(page);
  });

  test('permite armar el carrito pero bloquea el envío y muestra el horario de atención', async ({
    page,
  }) => {
    const product = await createProductViaApi(page, {
      name: unique('Sucursal cerrada'),
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
    await expect(page.getByText('Tu pedido', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Hacer pedido' }).click();
    await expect(page.getByText('Finalizar pedido')).toBeVisible();

    await page.getByLabel('Nombre').fill('Juan Pérez');
    await page.getByLabel('Teléfono').fill('3415555555');
    await page.getByRole('button', { name: 'Confirmar pedido' }).click();

    const errorMessage = page.getByText(
      'En este momento no podemos recibir pedidos.'
    );
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('Horario de atención');
  });
});
