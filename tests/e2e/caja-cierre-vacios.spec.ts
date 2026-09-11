import { test, expect } from '@playwright/test';
import { ensureCashRegisterClosed, login } from './helpers';

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
      page.getByTestId('cash-register-empty-message')
    ).toBeVisible();
    await expect(page.getByTestId('open-cash-register')).toBeVisible();
  });

  test('la página de cierre muestra la caja actual sin caja abierta', async ({
    page,
  }) => {
    await page.goto('/cierre');

    await expect(page.getByRole('heading', { name: 'Caja actual' })).toBeVisible();
    await expect(
      page.getByTestId('cash-register-empty-message')
    ).toBeVisible();
  });

  test('la caja abierta sin ventas muestra totales en cero y todos los insumos críticos activos', async ({
    page,
  }) => {
    const productsResponse = await page.request.get('/api/productos');
    expect(productsResponse.status()).toBe(200);
    const allProducts = (await productsResponse.json()) as {
      id: number;
      name: string;
      type: string;
      isActive: boolean;
      deletedAt: string | null;
    }[];
    const criticalSupplies = allProducts.filter(
      (p) => p.type === 'critical_supply' && p.isActive && !p.deletedAt
    );
    expect(criticalSupplies.length).toBeGreaterThan(0);

    const resumen = await page.request.post('/api/caja/abrir');
    expect(resumen.status()).toBe(201);

    await page.goto('/cierre');

    await expect(page.getByTestId('cash-register-total')).toHaveText('Total: $ 0', { timeout: 10000 });
    await expect(page.getByTestId('cash-register-sales-count')).toHaveText('0');

    const suppliesSection = page.locator('[data-testid="critical-supplies-card"]');
    await expect(suppliesSection).toBeVisible();

    for (const supply of criticalSupplies) {
      const row = suppliesSection.locator(
        `[data-testid="cash-register-supply-item"][data-product-name="${supply.name}"]`
      );
      await expect(row).toBeVisible();
      await expect(row).toContainText('0');
    }
  });
});
