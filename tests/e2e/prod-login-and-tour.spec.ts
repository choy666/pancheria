import { test, expect } from '@playwright/test';

const baseURL = process.env.BASE_URL;

function isProduction() {
  return !!baseURL && !baseURL.includes('localhost');
}

test.describe('Smoke de login y tour en producción', () => {
  test('login exitoso y tour visible en desktop', async ({ page }) => {
    const username = process.env.ADMIN_USERNAME;
    const password = process.env.ADMIN_PASSWORD;

    if (!username || !password) {
      test.skip(!isProduction(), 'Sin credenciales de administrador.');
    }

    await page.goto('/login');
    await page.fill('input[name="username"]', username!);
    await page.fill('input[name="password"]', password!);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/', { timeout: 15000 });
    await page.getByRole('button', { name: 'Guía' }).click();

    const popover = page.locator('.driver-popover');
    await expect(popover).toBeVisible();
    await expect(popover.locator('.driver-popover-title')).toContainText(
      'Bienvenido a Panchería'
    );
  });

  test('login y tour visible en móvil', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const username = process.env.ADMIN_USERNAME;
    const password = process.env.ADMIN_PASSWORD;

    if (!username || !password) {
      test.skip(!isProduction(), 'Sin credenciales de administrador.');
    }

    await page.goto('/login');
    await page.fill('input[name="username"]', username!);
    await page.fill('input[name="password"]', password!);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/', { timeout: 15000 });

    const menuButton = page.getByRole('button', {
      name: /abrir menú|cerrar menú/i,
    });
    await menuButton.click();

    const mobileNav = page.locator('[data-tour="mobile-nav"]');
    const guideButton = mobileNav.getByRole('button', { name: 'Guía' });
    await expect(guideButton).toBeVisible();
    await guideButton.click();

    await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.driver-popover')).toBeVisible();
  });
});
