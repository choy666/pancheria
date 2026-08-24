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
      page.getByText('No hay una caja abierta. Abrí una caja para comenzar a vender.')
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Abrir caja' }).first()
    ).toBeVisible();
  });

  test('la página de cierre muestra la caja actual sin caja abierta', async ({
    page,
  }) => {
    await page.goto('/cierre');

    await expect(page.getByRole('heading', { name: 'Caja actual' })).toBeVisible();
    await expect(
      page.getByText('No hay una caja abierta. Abrí una caja para comenzar a vender.')
    ).toBeVisible();

    await expect(
      page.getByRole('heading', { name: 'Cierre diario' })
    ).not.toBeVisible();
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

    await expect(page.getByText('Total: $0.00')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Ventas: 0')).toBeVisible();

    const suppliesSection = page
      .locator('[data-slot="card"]')
      .filter({ hasText: 'Consumo de insumos críticos' });
    await expect(suppliesSection).toBeVisible();

    for (const supply of criticalSupplies) {
      const row = suppliesSection
        .getByRole('listitem')
        .filter({ hasText: supply.name })
        .first();
      await expect(row).toBeVisible();
      await expect(row).toContainText('0');
    }
  });
});
