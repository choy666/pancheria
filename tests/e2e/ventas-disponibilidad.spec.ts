import { test, expect } from '@playwright/test';
import {
  ensureCashRegisterClosed,
  ensureCashRegisterOpen,
  login,
  unique,
  createProductViaApi,
  restockProductViaApi,
} from './helpers';

test.describe('Disponibilidad en el terminal de ventas', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await ensureCashRegisterClosed(page);
  });

  test('actualiza la disponibilidad tras la venta y respeta el stock máximo', async ({
    page,
  }) => {
    await ensureCashRegisterOpen(page);

    const bebida = await createProductViaApi(page, {
      name: unique('Bebida disponibilidad'),
      type: 'critical_supply',
      criticalSupplyType: 'beverage',
      price: 300,
      unit: 'unidad',
      minStock: 0,
      isActive: true,
    });

    await restockProductViaApi(page, bebida.id, 2);

    await page.goto('/ventas');

    const card = page
      .locator('[data-testid="product-card"][data-product-name="' + bebida.name + '"]');

    await expect(card.getByText('Disponible: 2 unidad')).toBeVisible({
      timeout: 10000,
    });

    // El carrito no permite agregar más unidades de las disponibles.
    await card.click();
    await card.click();
    await card.click();

    const cartItem = page.locator('[data-testid="cart-item"][data-product-name="' + bebida.name + '"]');

    await expect(
      cartItem.getByText('2', { exact: true })
    ).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Confirmar venta' }).click();
    await expect(page.getByText('El carrito está vacío.')).toBeVisible({
      timeout: 10000,
    });

    await expect(card.getByText('Disponible: 0 unidad')).toBeVisible({
      timeout: 10000,
    });
    await expect(card).toHaveClass(/opacity-50/);

    await ensureCashRegisterClosed(page);
  });

  test('un servicio se vende sin límite de stock y sin afectar el inventario', async ({
    page,
  }) => {
    await ensureCashRegisterOpen(page);

    const servicio = await createProductViaApi(page, {
      name: unique('Extra E2E'),
      type: 'service',
      price: 250,
      unit: 'unidad',
      stock: 0,
      minStock: 0,
      isActive: true,
    });

    await page.goto('/ventas');

    const card = page
      .locator('[data-testid="product-card"][data-product-name="' + servicio.name + '"]');

    await expect(card.getByText('Disponible: sin límite')).toBeVisible({
      timeout: 10000,
    });

    await card.click();
    await card.click();
    await card.click();

    const cartItem = page.locator('[data-testid="cart-item"][data-product-name="' + servicio.name + '"]');

    await expect(
      cartItem.getByText('3', { exact: true })
    ).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Confirmar venta' }).click();
    await expect(page.getByText('El carrito está vacío.')).toBeVisible({
      timeout: 10000,
    });

    await page.goto('/stock');
    await expect(page.getByRole('row', { name: new RegExp(servicio.name) })).toHaveCount(0, { timeout: 10000 });

    await ensureCashRegisterClosed(page);
  });

  test('una promo con Super Pancho descuenta Pan y Salchichas al vender', async ({
    page,
  }) => {
    await ensureCashRegisterOpen(page);

    const pan = await createProductViaApi(page, {
      name: unique('Pan promo'),
      type: 'critical_supply',
      criticalSupplyType: 'bread',
      price: 0,
      unit: 'unidad',
      minStock: 2,
      isActive: true,
    });

    await restockProductViaApi(page, pan.id, 10);

    const salchicha = await createProductViaApi(page, {
      name: unique('Salchicha promo'),
      type: 'critical_supply',
      criticalSupplyType: 'sausage',
      price: 0,
      unit: 'unidad',
      minStock: 2,
      isActive: true,
    });

    await restockProductViaApi(page, salchicha.id, 8);

    const promo = await createProductViaApi(page, {
      name: unique('Promo Super'),
      type: 'compound',
      price: 1500,
      unit: 'unidad',
      stock: 0,
      minStock: 0,
      isActive: true,
    });

    const recipeRes = await page.request.post('/api/recetas', {
      data: {
        compoundProductId: promo.id,
        items: [
          { supplyId: pan.id, quantity: 1, autoDiscount: true },
          { supplyId: salchicha.id, quantity: 2, autoDiscount: true },
        ],
      },
    });
    expect(recipeRes.status()).toBe(201);

    await page.goto('/ventas');

    const card = page
      .locator('[data-testid="product-card"][data-product-name="' + promo.name + '"]');

    await expect(card.getByText('Disponible: 4 unidad')).toBeVisible({
      timeout: 10000,
    });

    await card.click();

    await page.getByRole('button', { name: 'Confirmar venta' }).click();
    await expect(page.getByText('El carrito está vacío.')).toBeVisible({
      timeout: 10000,
    });

    const panRes = await page.request.get(`/api/productos/${pan.id}`);
    const salchichaRes = await page.request.get(`/api/productos/${salchicha.id}`);

    expect((await panRes.json()).stock).toBe(9);
    expect((await salchichaRes.json()).stock).toBe(6);

    await ensureCashRegisterClosed(page);
  });

  test('bloquea Confirmar venta mientras se calcula la disponibilidad', async ({
    page,
  }) => {
    await ensureCashRegisterOpen(page);

    const pan = await createProductViaApi(page, {
      name: unique('Pan promo'),
      type: 'critical_supply',
      criticalSupplyType: 'bread',
      price: 0,
      unit: 'unidad',
      minStock: 0,
      isActive: true,
    });

    await restockProductViaApi(page, pan.id, 1);

    const promo = await createProductViaApi(page, {
      name: unique('Promo Limitada'),
      type: 'compound',
      price: 1500,
      unit: 'unidad',
      stock: 0,
      minStock: 0,
      isActive: true,
    });

    const recipeRes = await page.request.post('/api/recetas', {
      data: {
        compoundProductId: promo.id,
        items: [{ supplyId: pan.id, quantity: 1, autoDiscount: true }],
      },
    });
    expect(recipeRes.status()).toBe(201);

    await page.route('/api/ventas/disponibilidad', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });

    await page.goto('/ventas');

    const card = page
      .locator('[data-testid="product-card"][data-product-name="' + promo.name + '"]');

    await expect(card.getByText('Disponible: 1 unidad')).toBeVisible({
      timeout: 10000,
    });

    await card.click();

    const button = page.getByRole('button', {
      name: /Confirmar venta|Calculando disponibilidad/,
    });

    await expect(button).toBeDisabled({ timeout: 5000 });
    await expect(button).toHaveText('Calculando disponibilidad...', {
      timeout: 5000,
    });

    await expect(button).toBeEnabled({ timeout: 10000 });

    await button.click();
    await expect(page.getByText('El carrito está vacío.')).toBeVisible({
      timeout: 10000,
    });

    await ensureCashRegisterClosed(page);
  });
});
