import { test, expect } from '@playwright/test';

test('login fallido muestra error', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'admin');
  await page.fill('input[name="password"]', 'incorrecta');
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL('/login');
  await expect(
    page.getByText('Usuario o contraseña incorrectos.')
  ).toBeVisible();
});

test('login exitoso redirige al dashboard', async ({ page }) => {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    test.skip();
  }

  await page.goto('/login');
  await page.fill('input[name="username"]', username!);
  await page.fill('input[name="password"]', password!);
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL('/');
});
