import { test, expect } from '@playwright/test';
import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db';
import { users } from '../../src/db/schema';
import { loginAsAdmin } from './helpers';

const adminUsername = process.env.ADMIN_USERNAME ?? '';
const adminPassword = process.env.ADMIN_PASSWORD ?? '';

const NEW_PASSWORD = 'NuevaContrasenaE2e123';

test.describe('Cambio de contraseña desde el perfil', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test.afterEach(async () => {
    if (adminUsername && adminPassword) {
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      await db
        .update(users)
        .set({ passwordHash })
        .where(eq(users.username, adminUsername));
    }
  });

  test('el usuario puede cambiar su contraseña desde /perfil', async ({ page }) => {
    await page.getByTestId('profile-link').click();
    await expect(page).toHaveURL('/perfil', { timeout: 15000 });
    await expect(
      page.getByRole('heading', { name: 'Mi perfil', level: 1 })
    ).toBeVisible();

    await expect(page.getByTestId('profile-username')).toBeVisible();

    await page.getByTestId('current-password').fill(adminPassword);
    await page.getByTestId('new-password').fill(NEW_PASSWORD);
    await page.getByTestId('confirm-password').fill(NEW_PASSWORD);
    await page.getByTestId('change-password-button').click();

    await expect(
      page.getByTestId('change-password-success')
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Contraseña actualizada correctamente.')).toBeVisible();

    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL('/login', { timeout: 15000 });

    await page.goto('/login');
    await page.getByLabel('Usuario').fill(adminUsername);
    await page.getByLabel('Contraseña').fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page).toHaveURL('/', { timeout: 15000 });
  });
});
