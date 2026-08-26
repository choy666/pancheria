import { test, expect, type Page } from '@playwright/test';
import {
  ensureCashRegisterClosed,
  login,
  unique,
  createProductViaApi,
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

  test('operación típica: productos, receta, venta, cierre y CSV', async ({
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

    await page.getByRole('button', { name: 'Abrir caja' }).click();
    await expect(
      page.getByRole('button', { name: 'Cerrar caja' })
    ).toBeVisible({ timeout: 10000 });

    const cardCombo = page
      .locator('[data-testid="product-card"]')
      .filter({ hasText: combo.name })
      .first();
    const cardBebida = page
      .locator('[data-testid="product-card"]')
      .filter({ hasText: bebida.name })
      .first();

    await cardCombo.click();
    await cardCombo.click();
    await expect(
      page.getByRole('listitem').filter({ hasText: combo.name }).getByText('2', { exact: true })
    ).toBeVisible({ timeout: 10000 });

    await cardBebida.click();

    await page.getByRole('button', { name: 'Transferencia' }).click();
    await page.getByRole('button', { name: 'Confirmar venta' }).click();

    await expect(page.getByText('El carrito está vacío.')).toBeVisible({
      timeout: 10000,
    });

    const resumenVenta = await page.request.get('/api/caja/resumen');
    const caja = (await resumenVenta.json()) as { id: number; status: string };
    expect(caja.status).not.toBe('closed');

    await page.goto('/cierre');

    await page.getByRole('button', { name: 'Cerrar caja' }).first().click();
    await expect(page.getByText('No hay una caja abierta.')).toBeVisible({
      timeout: 10000,
    });

    const cierreDate = new Date().toISOString().split('T')[0];

    await page.getByLabel('Fecha').fill(cierreDate);

    await page.getByRole('button', { name: 'Generar cierre' }).click();

    await expect(page.getByText('Total:').first()).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText(`Total: $${(1500 * 2 + 800).toFixed(2)}`).first()
    ).toBeVisible();
    await expect(page.getByText(combo.name).first()).toBeVisible();
    await expect(page.getByText(bebida.name).first()).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Descargar CSV' }).click(),
    ]);

    expect(download.suggestedFilename()).toContain('cierre-');

    await page.goto('/cierre/historial');
    await expect(page.getByText('Historial de cierres')).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();

    const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const end = new Date().toISOString();
    const cierres = await page.request.get(
      `/api/cierre/historial?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
    );
    expect(cierres.status()).toBe(200);
    const body = (await cierres.json()) as { items: { total: number }[] };
    expect(body.items.some((c) => c.total === 3800)).toBe(true);

    await page.goto(`/ventas/historial/${caja.id}`);
    await expect(page.getByText(combo.name).first()).toBeVisible();
    await expect(page.getByText(bebida.name).first()).toBeVisible();

    await ensureCashRegisterClosed(page);
  });
});
