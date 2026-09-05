import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'crypto';
import {
  login,
  unique,
  createProductViaApi,
  restockProductViaApi,
  openCashRegisterFromUI,
  closeCashRegisterFromUI,
  ensureCashRegisterClosed,
} from './helpers';

async function createSaleViaApi(
  page: Page,
  items: { productId: number; quantity: number }[],
  payments: { method: 'cash' | 'transfer'; amount: number }[]
) {
  const response = await page.request.post('/api/ventas', {
    data: {
      items,
      payments,
      idempotencyKey: randomUUID(),
    },
  });
  if (response.status() !== 201) {
    const text = await response.text();
    throw new Error(`POST /api/ventas devolvió ${response.status()}: ${text.slice(0, 500)}`);
  }
  return response.json();
}

test.describe('Cierre diario', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await ensureCashRegisterClosed(page);
  });

  test('refleja en el resumen de caja las ventas del día con pagos mixtos', async ({
    page,
  }) => {
    const bebida = await createProductViaApi(page, {
      name: unique('Bebida cierre'),
      type: 'critical_supply',
      criticalSupplyType: 'beverage',
      price: 1000,
      unit: 'unidad',
      isActive: true,
    });
    const bebida2 = await createProductViaApi(page, {
      name: unique('Gaseosa cierre'),
      type: 'critical_supply',
      criticalSupplyType: 'beverage',
      price: 500,
      unit: 'unidad',
      isActive: true,
    });

    await restockProductViaApi(page, bebida.id, 10);
    await restockProductViaApi(page, bebida2.id, 10);

    await page.goto('/cierre');
    await openCashRegisterFromUI(page);

    await createSaleViaApi(page, [{ productId: bebida.id, quantity: 2 }], [
      { method: 'cash', amount: 2000 },
    ]);

    await createSaleViaApi(page, [{ productId: bebida2.id, quantity: 3 }], [
      { method: 'transfer', amount: 1500 },
    ]);

    await page.goto('/cierre');
    await expect(page.getByTestId('cash-register-total')).toHaveText(
      'Total: $ 3.500',
      { timeout: 10000 }
    );
    await expect(page.getByText('Efectivo en ventas: $ 2.000')).toBeVisible();
    await expect(page.getByText('Transferencia: $ 1.500')).toBeVisible();
    await expect(page.getByText('Ventas: 2')).toBeVisible();

    const resumen = await page.request.get('/api/caja/resumen');
    expect(resumen.status()).toBe(200);
    const { id } = (await resumen.json()) as { id: number };

    const cerrar = await page.request.post('/api/caja/cerrar', {
      data: { id },
    });
    expect(cerrar.status()).toBe(200);

    await closeCashRegisterFromUI(page);

    await page.goto(`/ventas/historial/${id}`);
    const saleRows = page.locator('[data-testid^="row-sale-"]');
    await expect(saleRows).toHaveCount(2, { timeout: 10000 });

    const saleProducts = page.locator('[data-testid="sale-products"]');
    await expect(saleProducts.filter({ hasText: bebida.name })).toBeVisible();
    await expect(saleProducts.filter({ hasText: bebida2.name })).toBeVisible();

    const salePayments = page.locator('[data-testid="sale-payments"]');
    await expect(salePayments.filter({ hasText: 'Efectivo $ 2.000' })).toBeVisible();
    await expect(salePayments.filter({ hasText: 'Transferencia $ 1.500' })).toBeVisible();
  });
});
