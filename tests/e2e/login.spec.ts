import { test, expect } from '@playwright/test';

test('login fallido muestra error', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'admin');
  await page.fill('input[name="password"]', 'incorrecta');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/login');
});
