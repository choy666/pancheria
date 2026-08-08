import { test, expect, type Page } from '@playwright/test';
import { ensureCashRegisterClosed, ensureCashRegisterOpen } from './helpers';

const adminUsername = process.env.ADMIN_USERNAME || '';
const adminPassword = process.env.ADMIN_PASSWORD || '';

function unique(prefix: string) {
  return `${prefix} ${Date.now()}`;
}

async function login(page: Page) {
  await page.goto('/login');
  await page.fill('input[name="username"]', adminUsername);
  await page.fill('input[name="password"]', adminPassword);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/', { timeout: 15000 });
}

async function createProductViaApi(page: Page, data: Record<string, unknown>) {
  const response = await page.request.post('/api/productos', { data });
  expect(response.status()).toBe(201);
  return (await response.json()) as { id: number; name: string };
}

test.describe('Disponibilidad en el terminal de ventas', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await ensureCashRegisterClosed(page);
  });

  test('actualiza la disponibilidad luego de cada venta', async ({ page }) => {
    await ensureCashRegisterOpen(page);

    const bebida = await createProductViaApi(page, {
      name: unique('Bebida disponibilidad'),
      type: 'critical_supply',
      criticalSupplyType: 'beverage',
      price: 300,
      unit: 'unidad',
      stock: 2,
      minStock: 0,
      isActive: true,
    });

    await page.goto('/ventas');

    const card = page
      .locator('[data-slot="card"]')
      .filter({ hasText: bebida.name })
      .first();

    await expect(card.getByText(/Disponible: 2/)).toBeVisible({ timeout: 10000 });

    await card.click();
    await expect(page.getByText(/Disponible: 1/)).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Confirmar venta' }).click();
    await expect(page.getByText('El carrito está vacío.')).toBeVisible({
      timeout: 10000,
    });

    await expect(card.getByText(/Disponible: 1/)).toBeVisible({ timeout: 10000 });

    await card.click();
    await page.getByRole('button', { name: 'Confirmar venta' }).click();

    await expect(card.getByText(/Disponible: 0/)).toBeVisible({ timeout: 10000 });
    await expect(card).toHaveClass(/opacity-50/);

    await ensureCashRegisterClosed(page);
  });
});
