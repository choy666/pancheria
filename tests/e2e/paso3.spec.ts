import { test, expect } from '@playwright/test';
import { ensureCashRegisterOpen, login } from './helpers';

test.describe('Paso 3 - Login y navegacion completa', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('navega por todos los links del menu', async ({ page }) => {
    const menu = [
      { name: 'Ventas', url: '/ventas' },
      { name: 'Productos', url: '/productos' },
      { name: 'Stock', url: '/stock' },
      { name: 'Caja', url: '/cierre' },
      { name: 'Panel', url: '/' },
    ];

    for (const item of menu) {
      const nav = page.locator('nav');
      await nav.getByRole('link', { name: item.name }).click();
      await expect(page).toHaveURL(item.url);
    }
  });

  test('crea y edita un producto manual', async ({ page }) => {
    const baseName = `Producto test E2E ${Date.now()}`;
    await page.goto('/productos/nuevo');
    await page.fill('input#name', baseName);
    await page.fill('textarea#description', 'Descripcion de prueba');
    await page.fill('input#minStock', '5');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page).toHaveURL('/productos', { timeout: 10000 });

    const row = page.getByRole('row', { name: new RegExp(baseName) });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Editar' }).click();
    await expect(page).toHaveURL(/productos\/\d+\/editar/);

    const editedName = `${baseName} editado`;
    await page.fill('input#name', editedName);
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page).toHaveURL('/productos', { timeout: 10000 });
    await expect(page.getByText(editedName)).toBeVisible();
  });

  test('registra una venta', async ({ page }) => {
    await ensureCashRegisterOpen(page);
    await page.goto('/ventas');
    await page.getByText('Promo 1').click();
    await page.getByRole('button', { name: 'Confirmar venta' }).click();
    await expect(page).toHaveURL('/ventas', { timeout: 10000 });
  });

  test('ajusta stock', async ({ page }) => {
    await page.goto('/stock');
    const row = page.getByRole('row', { name: /Pan/ });
    await row.getByRole('button', { name: 'Ajustar' }).first().click();
    await page.fill('input#adjust-quantity', '10');
    await page.fill('textarea#adjust-reason', 'Ajuste de prueba');
    await page.getByRole('button', { name: 'Guardar ajuste' }).click();
    await expect(page).toHaveURL('/stock', { timeout: 10000 });
  });

  test('cierra la caja y cierra sesion', async ({ page }) => {
    await ensureCashRegisterOpen(page);
    await page.goto('/cierre');
    await expect(page.getByText('Total:').first()).toBeVisible();

    await page.getByRole('button', { name: 'Cerrar caja' }).click();
    await expect(page.getByText('No hay una caja abierta.')).toBeVisible();

    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL('/login', { timeout: 10000 });
  });
});
