import { test, expect, type Page } from '@playwright/test';
import { ensureCashRegisterClosed } from './helpers';

const adminUsername = process.env.ADMIN_USERNAME || '';
const adminPassword = process.env.ADMIN_PASSWORD || '';

async function login(page: Page) {
  await page.goto('/login');
  await page.fill('input[name="username"]', adminUsername);
  await page.fill('input[name="password"]', adminPassword);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/', { timeout: 15000 });
}

test.describe('Caja y cierre con estados vacíos', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await ensureCashRegisterClosed(page);
  });

  test('la página de ventas informa que no hay caja abierta y permite abrir', async ({
    page,
  }) => {
    await page.goto('/ventas');

    await expect(
      page.getByText('No hay una caja abierta. Abrí una caja para comenzar a vender.')
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Abrir caja' }).first()
    ).toBeVisible();
  });

  test('la página de cierre distingue caja actual y cierre diario sin caja abierta', async ({
    page,
  }) => {
    await page.goto('/cierre');

    await expect(page.getByRole('heading', { name: 'Caja actual' })).toBeVisible();
    await expect(
      page.getByText('No hay una caja abierta. Abrí una caja para comenzar a vender.')
    ).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Cierre diario' })).toBeVisible();
    await expect(
      page.getByText('No hay cierre generado para la fecha seleccionada.')
    ).toBeVisible();
  });

  test('la caja abierta sin ventas muestra totales en cero y productos vacíos', async ({
    page,
  }) => {
    const resumen = await page.request.post('/api/caja/abrir');
    expect(resumen.status()).toBe(201);

    await page.goto('/cierre');

    await expect(page.getByText('Total: $0.00')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Ventas: 0')).toBeVisible();
  });
});
