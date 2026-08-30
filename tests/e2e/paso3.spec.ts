import { test, expect } from '@playwright/test';
import { ensureCashRegisterOpen, login, closeCashRegisterFromUI } from './helpers';

test.describe('Paso 3 - Login y navegacion completa', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('navega por todos los links del menu', async ({ page }) => {
    const menu = [
      { name: 'Ventas', url: '/ventas' },
      { name: 'Productos', url: '/productos' },
      { name: 'Stock', url: '/stock' },
      { name: 'Caja y cierre', url: '/cierre' },
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
    await page.getByLabel('Nombre').fill(baseName);
    await page.getByLabel('Descripción').fill('Descripcion de prueba');
    await page.getByLabel('Stock mínimo').fill('5');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page).toHaveURL('/productos', { timeout: 10000 });

    const row = page.getByRole('row', { name: new RegExp(baseName) });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Editar' }).click();
    await expect(page).toHaveURL(/productos\/\d+\/editar/);

    const editedName = `${baseName} editado`;
    await page.getByLabel('Nombre').fill(editedName);
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page).toHaveURL('/productos', { timeout: 10000 });
    await expect(page.getByText(editedName)).toBeVisible();
  });

  test('registra una venta', async ({ page }) => {
    const productsResponse = await page.request.get('/api/productos');
    const products = (await productsResponse.json()) as {
      id: number;
      name: string;
      type: string;
      price: number;
    }[];
    const promo = products.find(
      (p) => p.type === 'compound' && p.price === 1000
    );
    if (!promo) throw new Error('No se encontró la promo de prueba');

    await ensureCashRegisterOpen(page);
    await page.goto('/ventas');
    await page
      .locator(`[data-testid="product-card"][data-product-name="${promo.name}"]`)
      .click();
    await page.getByTestId('payment-cash-full').click();
    await page.getByRole('button', { name: 'Confirmar venta' }).click();
    await expect(page).toHaveURL('/ventas', { timeout: 10000 });
  });

  test('ajusta stock', async ({ page }) => {
    const productsResponse = await page.request.get(
      '/api/productos?includeAvailability=false'
    );
    const products = (await productsResponse.json()) as {
      id: number;
      name: string;
      type: string;
      criticalSupplyType: string | null;
    }[];
    const pan = products.find(
      (p) => p.type === 'critical_supply' && p.criticalSupplyType === 'bread'
    );
    if (!pan) throw new Error('No se encontró el insumo Pan');

    await page.goto('/stock');
    await page.getByTestId(`adjust-stock-${pan.id}`).click();
    await page.getByLabel(/Cantidad/).fill('10');
    await page.getByLabel('Motivo').fill('Ajuste de prueba');
    await page.getByRole('button', { name: 'Guardar ajuste' }).click();
    await expect(page).toHaveURL('/stock', { timeout: 10000 });
  });

  test('cierra la caja y cierra sesion', async ({ page }) => {
    await ensureCashRegisterOpen(page);
    await page.goto('/cierre');
    await expect(page.getByTestId('cash-register-total')).toBeVisible();

    await closeCashRegisterFromUI(page);

    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL('/login', { timeout: 10000 });
  });
});
