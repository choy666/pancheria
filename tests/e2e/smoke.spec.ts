import { test, expect } from '@playwright/test';
import { ensureLoggedIn } from './helpers';

test.describe('Smoke de producción', () => {
  test('inicia sesión y cargan las páginas protegidas', async ({ page }) => {
    await ensureLoggedIn(page);
    await expect(page).toHaveURL('/');

    const protectedRoutes = ['/ventas', '/stock', '/productos', '/cierre'];

    for (const route of protectedRoutes) {
      await page.goto(route);
      await expect(page).toHaveURL(route);
    }
  });
});
