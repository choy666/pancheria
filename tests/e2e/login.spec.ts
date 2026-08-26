import { test, expect } from '@playwright/test';

test('login fallido muestra error', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Usuario').fill('admin');
  await page.getByLabel('Contraseña').fill('incorrecta');
  await page.getByRole('button', { name: 'Ingresar' }).click();

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
  await page.getByLabel('Usuario').fill(username!);
  await page.getByLabel('Contraseña').fill(password!);
  await page.getByRole('button', { name: 'Ingresar' }).click();

  await expect(page).toHaveURL('/', { timeout: 30_000 });
});
