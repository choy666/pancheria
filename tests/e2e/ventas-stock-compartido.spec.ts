import { test, expect } from '@playwright/test';
import {
  ensureCashRegisterClosed,
  ensureCashRegisterOpen,
  login,
  unique,
  createProductViaApi,
  restockProductViaApi,
} from './helpers';

test.describe('Venta con stock compartido entre promos', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await ensureCashRegisterClosed(page);
  });

  test('bloquea agregar promo B cuando el insumo compartido ya fue consumido por promo A', async ({
    page,
  }) => {
    await ensureCashRegisterOpen(page);

    const insumo = await createProductViaApi(page, {
      name: unique('Insumo compartido'),
      type: 'critical_supply',
      criticalSupplyType: 'sausage',
      price: 0,
      unit: 'unidad',
      minStock: 0,
      isActive: true,
    });

    await restockProductViaApi(page, insumo.id, 6);

    const promoA = await createProductViaApi(page, {
      name: unique('Promo A'),
      type: 'compound',
      price: 1500,
      unit: 'unidad',
      stock: 0,
      minStock: 0,
      isActive: true,
    });

    const promoB = await createProductViaApi(page, {
      name: unique('Promo B'),
      type: 'compound',
      price: 1500,
      unit: 'unidad',
      stock: 0,
      minStock: 0,
      isActive: true,
    });

    const recipeA = await page.request.post('/api/recetas', {
      data: {
        compoundProductId: promoA.id,
        items: [
          { supplyId: insumo.id, quantity: 1, autoDiscount: true },
        ],
      },
    });
    expect(recipeA.status()).toBe(201);

    const recipeB = await page.request.post('/api/recetas', {
      data: {
        compoundProductId: promoB.id,
        items: [
          { supplyId: insumo.id, quantity: 1, autoDiscount: true },
        ],
      },
    });
    expect(recipeB.status()).toBe(201);

    await page.goto('/ventas');

    const cardA = page
      .locator('[data-slot="card"]')
      .filter({ hasText: promoA.name })
      .first();
    const cardB = page
      .locator('[data-slot="card"]')
      .filter({ hasText: promoB.name })
      .first();

    await expect(cardA.getByText('Disponible: 6 unidad')).toBeVisible({
      timeout: 10000,
    });
    await expect(cardB.getByText('Disponible: 6 unidad')).toBeVisible({
      timeout: 10000,
    });

    for (let i = 0; i < 5; i++) {
      await cardA.click();
      await page.waitForTimeout(100);
    }

    await expect(cardB.getByText('En este pedido: 1 más')).toBeVisible({
      timeout: 10000,
    });

    const cartItemA = page
      .getByRole('listitem')
      .filter({ hasText: promoA.name })
      .first();
    const cartItemB = page
      .getByRole('listitem')
      .filter({ hasText: promoB.name })
      .first();

    await cardB.click();
    await page.waitForTimeout(400);

    await expect(cartItemB.getByText('1', { exact: true })).toBeVisible({
      timeout: 10000,
    });

    await expect(cardB.getByText('En este pedido: 0 más')).toBeVisible({
      timeout: 10000,
    });

    await cardB.click();
    await page.waitForTimeout(400);

    await expect(cartItemB.getByText('1', { exact: true })).toBeVisible({
      timeout: 10000,
    });

    await expect(cartItemA.getByText('5', { exact: true })).toBeVisible({
      timeout: 10000,
    });
    await expect(cartItemB.getByText('1', { exact: true })).toBeVisible({
      timeout: 10000,
    });

    await page.getByRole('button', { name: 'Confirmar venta' }).click();
    await expect(page.getByText('El carrito está vacío.')).toBeVisible({
      timeout: 10000,
    });

    const insumoRes = await page.request.get(`/api/productos/${insumo.id}`);
    expect(insumoRes.status()).toBe(200);
    const insumoData = (await insumoRes.json()) as { stock: number };
    expect(insumoData.stock).toBe(0);

    await ensureCashRegisterClosed(page);
  });
});
