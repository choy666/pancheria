import { test, expect } from '@playwright/test';
import {
  ensureCashRegisterClosed,
  ensureCashRegisterOpen,
  login,
  unique,
  createProductViaApi,
} from './helpers';

test.describe('Stock, ajustes y movimientos', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('rechaza ajuste negativo excesivo y permite ajustar stock', async ({
    page,
  }) => {
    const producto = await createProductViaApi(page, {
      name: unique('Stock E2E'),
      type: 'critical_supply',
      criticalSupplyType: 'beverage',
      price: 300,
      unit: 'unidad',
      stock: 0,
      minStock: 5,
      isActive: true,
    });

    const stockInicial = await page.request.post('/api/stock/ajustar', {
      data: {
        productId: producto.id,
        quantity: 2,
        reason: 'Stock inicial',
        type: 'restock',
      },
    });
    expect(stockInicial.status()).toBe(200);

    await page.goto('/stock');
    const row = page.locator('tr').filter({ hasText: new RegExp(producto.name) });
    await expect(row).toBeVisible();
    await expect(
      row.locator('td', { hasText: /^2 unidad$/ }).first()
    ).toBeVisible();

    await row.getByRole('button', { name: 'Ajustar' }).first().click();
    await page.fill('input#adjust-quantity', '-10');
    await page.fill('textarea#adjust-reason', 'Ajuste negativo de prueba');
    await page.getByRole('button', { name: 'Guardar ajuste' }).click();

    await expect(page.getByText('en negativo')).toBeVisible({ timeout: 10000 });

    const ajuste = await page.request.post('/api/stock/ajustar', {
      data: {
        productId: producto.id,
        quantity: 4,
        reason: 'Ajuste positivo de prueba',
      },
    });
    expect(ajuste.status()).toBe(200);

    await page.goto('/stock');
    const updatedRow = page.locator('tr').filter({ hasText: new RegExp(producto.name) });
    await expect(updatedRow).toBeVisible();
    await expect(
      updatedRow.locator('td', { hasText: /^6 unidad$/ }).first()
    ).toBeVisible();

    await updatedRow.getByRole('button', { name: 'Historial' }).first().click();
    await expect(page.getByText('Ajuste positivo de prueba')).toBeVisible();
  });

  test('la venta y la anulación generan movimientos del tipo correcto', async ({
    page,
  }) => {
    await ensureCashRegisterOpen(page);

    const bebida = await createProductViaApi(page, {
      name: unique('Bebida movimientos'),
      type: 'critical_supply',
      criticalSupplyType: 'beverage',
      price: 500,
      unit: 'unidad',
      stock: 0,
      minStock: 0,
      isActive: true,
    });

    const stockInicial = await page.request.post('/api/stock/ajustar', {
      data: {
        productId: bebida.id,
        quantity: 5,
        reason: 'Stock inicial',
        type: 'restock',
      },
    });
    expect(stockInicial.status()).toBe(200);

    const venta = await page.request.post('/api/ventas', {
      data: {
        items: [{ productId: bebida.id, quantity: 2 }],
        paymentMethod: 'cash',
        idempotencyKey: `movimientos-${Date.now()}`,
      },
    });
    expect(venta.status()).toBe(201);
    const { id: ventaId } = (await venta.json()) as { id: number };

    const movimientosVenta = await page.request.get(
      `/api/stock/movimientos?productId=${bebida.id}`
    );
    expect(movimientosVenta.status()).toBe(200);
    const movsVenta = (await movimientosVenta.json()) as {
      items: { type: string; quantity: number }[];
    };
    const movVenta = movsVenta.items.find((m) => m.type === 'sale');
    expect(movVenta).toBeTruthy();
    expect(movVenta?.quantity).toBe(-2);

    const anular = await page.request.post(`/api/ventas/${ventaId}/anular`, {
      data: { reason: 'Error de carga' },
    });
    expect(anular.status()).toBe(200);

    const movimientosAnulacion = await page.request.get(
      `/api/stock/movimientos?productId=${bebida.id}`
    );
    expect(movimientosAnulacion.status()).toBe(200);
    const movsAnulacion = (await movimientosAnulacion.json()) as {
      items: { type: string; quantity: number }[];
    };
    const movAnulacion = movsAnulacion.items.find((m) => m.type === 'cancellation');
    expect(movAnulacion).toBeTruthy();
    expect(movAnulacion?.quantity).toBe(2);

    await ensureCashRegisterClosed(page);
  });
});
