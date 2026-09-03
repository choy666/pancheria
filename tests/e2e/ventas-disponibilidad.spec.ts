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

    const cartItem = page.locator('[data-testid="cart-item"][data-product-name="' + bebida.name + '"]');

    await expect(
      cartItem.getByText('2', { exact: true })
    ).toBeVisible({ timeout: 10000 });

    // La tarjeta se deshabilita al quedar sin stock.
    await expect(card).toHaveAttribute('data-out-of-stock', 'true');
    await expect(card).toHaveAttribute('aria-disabled', 'true');

    await page.getByTestId('payment-cash-full').click();
    await page.getByRole('button', { name: 'Confirmar venta' }).click();
    await expect(page.getByText('El carrito está vacío.')).toBeVisible({
      timeout: 10000,
    });

    // La bebida quedó agotada y se oculta por defecto; mostrarla para validar.
    await page.getByTestId('toggle-show-out-of-stock').click();

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

    await page.getByTestId('payment-cash-full').click();
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

    await page.getByTestId('payment-cash-full').click();
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

    await page.getByTestId('payment-cash-full').click();
    await button.click();
    await expect(page.getByText('El carrito está vacío.')).toBeVisible({
      timeout: 10000,
    });

    await ensureCashRegisterClosed(page);
  });

  test('permite vender dos variantes del mismo producto con personalizaciones distintas', async ({
    page,
  }) => {
    await ensureCashRegisterOpen(page);

    const pan = await createProductViaApi(page, {
      name: unique('Pan multilinea'),
      type: 'critical_supply',
      criticalSupplyType: 'bread',
      price: 0,
      unit: 'unidad',
      minStock: 0,
      isActive: true,
    });
    await restockProductViaApi(page, pan.id, 10);

    const cebolla = await createProductViaApi(page, {
      name: unique('Cebolla multilinea'),
      type: 'manual_supply',
      price: 0,
      unit: 'unidad',
      minStock: 0,
      isActive: true,
    });

    const promo = await createProductViaApi(page, {
      name: unique('Promo multilinea'),
      type: 'compound',
      price: 1500,
      unit: 'unidad',
      minStock: 0,
      isActive: true,
    });

    const recipeRes = await page.request.post('/api/recetas', {
      data: {
        compoundProductId: promo.id,
        items: [
          {
            supplyId: pan.id,
            quantity: 1,
            autoDiscount: true,
            isOptional: false,
            supplyType: 'critical_supply',
          },
          {
            supplyId: cebolla.id,
            quantity: 1,
            autoDiscount: false,
            isOptional: true,
            selectedByDefault: false,
            supplyType: 'manual_supply',
          },
        ],
      },
    });
    expect(recipeRes.status()).toBe(201);

    await page.goto('/ventas');

    const card = page.locator(
      '[data-testid="product-card"][data-product-name="' + promo.name + '"]'
    );
    await expect(card).toBeVisible({ timeout: 10000 });

    // Agregar variante con cebolla.
    await card.click();
    await expect(page.getByRole('heading', { name: promo.name })).toBeVisible({
      timeout: 5000,
    });
    await page
      .getByLabel(new RegExp(`Incluir ${cebolla.name} en ${promo.name}`))
      .check();
    await page.getByRole('button', { name: 'Agregar al pedido' }).click();

    await expect(
      page.locator('[data-testid="cart-item"][data-product-name="' + promo.name + '"]')
    ).toHaveCount(1, { timeout: 5000 });

    // Agregar variante sin cebolla.
    await card.click();
    await expect(page.getByRole('heading', { name: promo.name })).toBeVisible({
      timeout: 5000,
    });
    await page.getByRole('button', { name: 'Agregar al pedido' }).click();

    await expect(
      page.locator('[data-testid="cart-item"][data-product-name="' + promo.name + '"]')
    ).toHaveCount(2, { timeout: 5000 });

    await page.getByTestId('payment-cash-full').click();
    await page.getByRole('button', { name: 'Confirmar venta' }).click();

    await expect(page.getByText('El carrito está vacío.')).toBeVisible({
      timeout: 10000,
    });

    const panRes = await page.request.get(`/api/productos/${pan.id}`);
    expect((await panRes.json()).stock).toBe(8);

    await ensureCashRegisterClosed(page);
  });
});
