import { test, expect } from '@playwright/test';
import { login, unique, clearSession } from './helpers';

test.describe('Eliminación de sucursal', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('elimina una sucursal, la quita del listado y bloquea el login de sus usuarios', async ({
    page,
  }) => {
    const branchName = unique('Sucursal Archivo');
    const operatorUsername = unique('op-archivo');

    await page.goto('/sucursales');
    await expect(page.getByRole('heading', { name: 'Sucursales' })).toBeVisible();

    await page.getByLabel('Nombre de la sucursal').fill(branchName);
    await page.getByRole('button', { name: 'Crear sucursal' }).click();

    const row = page.locator('[data-testid="branch-row"]', {
      hasText: branchName,
    });
    await expect(row).toBeVisible({ timeout: 10000 });
    const branchId = await row.getAttribute('data-branch-id');
    expect(branchId).not.toBeNull();

    await page.goto('/usuarios');
    await expect(page.getByRole('heading', { name: 'Usuarios' })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });

    await page.getByLabel('Nombre de usuario').fill(operatorUsername);
    await page.locator('#password').fill('123456');
    await page.locator('#branchId').click();
    await expect(page.locator('[role="listbox"]')).toBeVisible();
    await page.locator('[role="option"]', { hasText: branchName }).click();
    await page.getByRole('button', { name: 'Crear usuario' }).click();

    await expect(
      page.getByTestId('user-username').filter({ hasText: operatorUsername })
    ).toBeVisible({ timeout: 10000 });

    await page.goto('/sucursales');
    await expect(row).toBeVisible();

    await page.getByTestId(`delete-branch-${branchId}`).click();
    await expect(
      page.getByRole('dialog', { name: 'Confirmar eliminación' })
    ).toBeVisible();

    const dialog = page.getByRole('dialog', { name: 'Confirmar eliminación' });
    await dialog.getByPlaceholder('Escribí').fill(branchName);
    await dialog.getByRole('button', { name: /Eliminar/ }).click();

    await expect(row).toHaveCount(0, { timeout: 10000 });
    await expect(
      page.locator('[data-testid="branch-row"]', { hasText: branchName })
    ).toHaveCount(0);

    await clearSession(page);
    await page.goto('/login');
    await page.getByLabel('Usuario').fill(operatorUsername);
    await page.getByLabel('Contraseña').fill('123456');
    await page.getByRole('button', { name: 'Ingresar' }).click();

    await expect(
      page.getByText('Usuario o contraseña incorrectos.')
    ).toBeVisible({ timeout: 10000 });
  });

  test('rechaza crear pedidos en una sucursal eliminada', async ({ page }) => {
    const branchName = unique('Sucursal Eliminada API');

    await page.goto('/sucursales');
    await page.getByLabel('Nombre de la sucursal').fill(branchName);
    await page.getByRole('button', { name: 'Crear sucursal' }).click();

    const row = page.locator('[data-testid="branch-row"]', {
      hasText: branchName,
    });
    await expect(row).toBeVisible({ timeout: 10000 });
    const branchId = await row.getAttribute('data-branch-id');

    await page.getByTestId(`delete-branch-${branchId}`).click();
    const dialog = page.getByRole('dialog', { name: 'Confirmar eliminación' });
    await dialog.getByPlaceholder('Escribí').fill(branchName);
    await dialog.getByRole('button', { name: /Eliminar/ }).click();
    await expect(row).toHaveCount(0, { timeout: 10000 });

    const orderRes = await page.request.post('/api/public/pedido', {
      data: {
        items: [{ productId: 1, quantity: 1 }],
        customerName: 'Test Archivo',
        customerPhone: '3415555555',
        deliveryType: 'pickup',
        idempotencyKey: unique('idempotency-archivo'),
      },
      params: { branchId: Number(branchId) },
    });
    expect(orderRes.status()).toBe(404);
  });
});
