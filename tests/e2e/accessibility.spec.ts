import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { login } from './helpers';

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
});
