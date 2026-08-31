import { test, expect, type Page } from '@playwright/test';
import {
  ensureCashRegisterClosed,
  login,
  unique,
  createProductViaApi,
  openCashRegisterFromUI,
  closeCashRegisterFromUI,
} from './helpers';

async function createRecipe(
  page: Page,
  compoundProductId: number,
  items: { supplyId: number; quantity: number; autoDiscount: boolean }[]
) {
  const response = await page.request.post('/api/recetas', {
    data: { compoundProductId, items },
  });
  expect(response.status()).toBe(201);
  return response.json();
}

async function adjustStock(
  page: Page,
  productId: number,
  quantity: number,
  reason: string,
  type = 'manual_adjustment'
) {
  const response = await page.request.post('/api/stock/ajustar', {
    data: { productId, quantity, reason, type },
  });
  expect(response.status()).toBe(200);
  return response.json();
}

test.describe('Flujo completo de un día de operación', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await ensureCashRegisterClosed(page);
  });

  test('operación típica: productos, receta, venta y cierre de caja', async ({
    page,
  }) => {
    const pan = await createProductViaApi(page, {
      name: unique('Pan de flujo'),
      type: 'critical_supply',
      criticalSupplyType: 'bread',
      price: 500,
      unit: 'unidad',
      stock: 0,
      minStock: 5,
      isActive: true,
    });

    const salchicha = await createProductViaApi(page, {
      name: unique('Salchicha de flujo'),
      type: 'critical_supply',
      criticalSupplyType: 'sausage',
      price: 600,
      unit: 'unidad',
      stock: 0,
      minStock: 5,
      isActive: true,
    });

    const bebida = await createProductViaApi(page, {
      name: unique('Gaseosa de flujo'),
      type: 'critical_supply',
      criticalSupplyType: 'beverage',
      price: 800,
      unit: 'unidad',
      stock: 0,
      minStock: 3,
      isActive: true,
    });

    const combo = await createProductViaApi(page, {
      name: unique('Combo de flujo'),
      type: 'compound',
      price: 1500,
      unit: 'unidad',
      stock: 0,
      minStock: 0,
      isActive: true,
    });

    await createRecipe(page, combo.id, [
      { supplyId: pan.id, quantity: 1, autoDiscount: true },
      { supplyId: salchicha.id, quantity: 1, autoDiscount: true },
    ]);

    await adjustStock(page, pan.id, 10, 'Stock inicial de pan para flujo', 'restock');
    await adjustStock(page, salchicha.id, 8, 'Stock inicial de salchicha para flujo', 'restock');
    await adjustStock(page, bebida.id, 5, 'Stock inicial de bebida para flujo', 'restock');

    await page.goto('/ventas');
    await expect(page.getByText('No hay una caja abierta.')).toBeVisible();

    await openCashRegisterFromUI(page);

    const cardCombo = page
      .locator('[data-testid="product-card"][data-product-name="' + combo.name + '"]');
    const cardBebida = page
      .locator('[data-testid="product-card"][data-product-name="' + bebida.name + '"]');

    await cardCombo.click();
    await cardCombo.click();
    await expect(
      page.locator('[data-testid="cart-item"][data-product-name="' + combo.name + '"]').getByText('2', { exact: true })
    ).toBeVisible({ timeout: 10000 });

    await cardBebida.click();

    await page.getByTestId('payment-transfer-full').click();
    await page.getByRole('button', { name: 'Confirmar venta' }).click();

    await expect(page.getByText('El carrito está vacío.')).toBeVisible({
      timeout: 10000,
    });

    const resumenVenta = await page.request.get('/api/caja/resumen');
    const caja = (await resumenVenta.json()) as { id: number; status: string };
    expect(caja.status).not.toBe('closed');

    await page.goto('/cierre');

    await closeCashRegisterFromUI(page);

    await page.goto(`/ventas/historial/${caja.id}`);
    await expect(
      page
        .getByTestId('cash-register-product-item')
        .filter({ hasText: combo.name })
    ).toBeVisible();
    await expect(
      page
        .getByTestId('cash-register-supply-item')
        .filter({ hasText: bebida.name })
    ).toBeVisible();

    await ensureCashRegisterClosed(page);
  });
});
