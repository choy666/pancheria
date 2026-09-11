import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  login,
  ensureCashRegisterOpen,
  createProductViaApi,
  unique,
} from './helpers';

/**
 * Suite de accesibilidad con axe-core.
 *
 * Recorre páginas públicas y del panel para detectar violaciones de WCAG
 * automáticamente. Se ejecuta como parte del suite de Playwright y, por lo
 * tanto, también en CI.
 */
test.describe('Accesibilidad (axe-core)', () => {
  test('páginas públicas cumplen WCAG 2.1 AA', async ({ page }) => {
    const publicPaths = ['/login', '/pedido?branchId=1', '/pedido/seguimiento'];

    for (const path of publicPaths) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag21aa'])
        .analyze();

      expect(
        results.violations,
        `Violaciones de accesibilidad en ${path}: ${JSON.stringify(results.violations, null, 2)}`
      ).toEqual([]);
    }
  });

  test('páginas del panel cumplen WCAG 2.1 AA', async ({ page }) => {
    await login(page);

    const panelPaths = [
      '/',
      '/ventas',
      '/productos',
      '/stock',
      '/cierre',
      '/pedidos',
      '/sucursales',
      '/usuarios',
      '/videos',
    ];

    for (const path of panelPaths) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag21aa'])
        .analyze();

      expect(
        results.violations,
        `Violaciones de accesibilidad en ${path}: ${JSON.stringify(results.violations, null, 2)}`
      ).toEqual([]);
    }
  });

  test('la página de chat del pedido cumple WCAG 2.1 AA', async ({ page }) => {
    await login(page);
    await ensureCashRegisterOpen(page);

    const product = await createProductViaApi(page, {
      name: unique('Accesibilidad Chat'),
      type: 'service',
      price: 1000,
      unit: 'unidad',
      stock: 0,
      minStock: 0,
      isActive: true,
    });

    await page.goto('/pedido');
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId(`product-card-${product.id}`)).toBeVisible();

    await page.getByTestId(`add-product-${product.id}`).click();
    await expect(page.getByTestId('cart-title')).toBeVisible();

    await page.getByRole('button', { name: 'Hacer pedido' }).click();
    await expect(page.getByTestId('checkout-dialog-title')).toBeVisible();

    await page.getByLabel('Nombre').fill(unique('Cliente Accesibilidad'));
    await page.getByLabel('Teléfono').fill('3415555555');
    await page.getByRole('button', { name: 'Confirmar pedido' }).click();

    await expect(page.getByTestId('order-success-title')).toBeVisible();
    await page.getByRole('button', { name: 'Ir al chat del pedido' }).click();

    await expect(page).toHaveURL(/\/pedido\/\d+\/chat/);
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag21aa'])
      .analyze();

    expect(
      results.violations,
      `Violaciones de accesibilidad en chat del pedido: ${JSON.stringify(results.violations, null, 2)}`
    ).toEqual([]);
  });
});
