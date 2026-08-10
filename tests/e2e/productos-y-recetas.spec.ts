import { test, expect } from '@playwright/test';
import { login, unique, createProductViaApi } from './helpers';

test.describe('Ciclo de vida de productos y recetas', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('crea un producto crítico, compuesto y manual, y edita el manual', async ({
    page,
  }) => {
    const pan = await createProductViaApi(page, {
      name: unique('Pan E2E'),
      type: 'critical_supply',
      criticalSupplyType: 'bread',
      price: 400,
      unit: 'unidad',
      stock: 0,
      minStock: 5,
      isActive: true,
    });

    const manual = await createProductViaApi(page, {
      name: unique('Aderezo E2E'),
      type: 'manual_supply',
      price: 0,
      unit: 'unidad',
      stock: 0,
      minStock: 5,
      isActive: true,
    });

    const compound = await createProductViaApi(page, {
      name: unique('Panchuque E2E'),
      type: 'compound',
      price: 1200,
      unit: 'unidad',
      stock: 0,
      minStock: 0,
      isActive: true,
    });

    const recipeRes = await page.request.post('/api/recetas', {
      data: {
        compoundProductId: compound.id,
        items: [
          { supplyId: pan.id, quantity: 1, autoDiscount: true },
        ],
      },
    });
    expect(recipeRes.status()).toBe(201);

    await page.goto('/productos');
    await expect(page.getByText('Productos y promos')).toBeVisible();

    const panRow = page.locator('tr').filter({ hasText: new RegExp(pan.name) });
    await expect(panRow).toBeVisible();
    await expect(panRow.getByText('Insumo crítico - Pan')).toBeVisible();

    const compoundRow = page.locator('tr').filter({ hasText: new RegExp(compound.name) });
    await expect(compoundRow).toBeVisible();
    await expect(compoundRow.getByRole('button', { name: 'Editar' })).toBeVisible();
    await expect(compoundRow.getByRole('link', { name: 'Receta' })).not.toBeVisible();

    await page.goto(`/productos/${compound.id}/editar`);
    await expect(page.getByRole('button', { name: 'Actualizar promo' })).toBeVisible();

    await page.goto('/productos');
    await expect(page.getByText('Productos y promos')).toBeVisible();

    const manualRow = page.locator('tr').filter({ hasText: new RegExp(manual.name) });
    await expect(manualRow).toBeVisible({ timeout: 10000 });
    await manualRow.getByRole('button', { name: 'Editar' }).click();
    await expect(page).toHaveURL(/productos\/\d+\/editar/);

    await page.uncheck('#isActive');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page).toHaveURL('/productos', { timeout: 10000 });

    const updatedRow = page.locator('tr').filter({ hasText: new RegExp(manual.name) });
    await expect(updatedRow.locator('td:nth-child(5) [data-slot="badge"]')).toHaveText('X');

    const productRes = await page.request.get(`/api/productos/${manual.id}`);
    expect(productRes.status()).toBe(200);
    const productData = (await productRes.json()) as { isActive: boolean };
    expect(productData.isActive).toBe(false);
  });

  test('crea una promo desde la UI con insumos críticos', async ({
    page,
  }) => {
    await login(page);

    const supplies = (await page.request.get('/api/productos?includeAvailability=false')).json() as Promise<{ id: number; name: string; type: string }[]>;
    const all = await supplies;
    const pan = all.find((p) => p.name === 'Pan');
    const salchicha = all.find((p) => p.name === 'Salchichas');
    const bebida = all.find((p) => p.name === 'Coca de 1L');
    if (!pan || !salchicha || !bebida) throw new Error('Insumos de seed no encontrados');

    const promoName = unique('Promo UI');
    const promo = await createProductViaApi(page, {
      name: promoName,
      type: 'compound',
      price: 2500,
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
          { supplyId: bebida.id, quantity: 1, autoDiscount: true },
        ],
      },
    });
    expect(recipeRes.status()).toBe(201);

    await page.goto('/productos');
    const row = page.locator('tr').filter({ hasText: new RegExp(promoName) });
    await expect(row).toBeVisible();
    await expect(
      row.locator('td:nth-child(2) [data-slot="badge"]')
    ).toHaveText('Promo');
  });

  test('rechaza receta sin insumo crítico con descuento automático', async ({
    page,
  }) => {
    const pan = await createProductViaApi(page, {
      name: unique('Pan sin auto'),
      type: 'critical_supply',
      criticalSupplyType: 'bread',
      price: 400,
      unit: 'unidad',
      stock: 0,
      minStock: 2,
      isActive: true,
    });

    const compound = await createProductViaApi(page, {
      name: unique('Producto sin auto'),
      type: 'compound',
      price: 1000,
      unit: 'unidad',
      stock: 0,
      minStock: 0,
      isActive: true,
    });

    const recipeRes = await page.request.post('/api/recetas', {
      data: {
        compoundProductId: compound.id,
        items: [
          { supplyId: pan.id, quantity: 1, autoDiscount: false },
        ],
      },
    });
    expect(recipeRes.status()).toBe(400);
    const body = (await recipeRes.json()) as { error?: string };
    expect(body.error).toContain('al menos un insumo crítico con descuento automático');
  });

  test('rechaza un insumo manual con precio por API', async ({ page }) => {
    const response = await page.request.post('/api/productos', {
      data: {
        name: unique('Aderezo con precio'),
        type: 'manual_supply',
        price: 150,
        unit: 'unidad',
        stock: 0,
        minStock: 2,
        isActive: true,
      },
    });

    expect(response.status()).toBe(400);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toContain('Los insumos manuales no pueden tener precio.');
  });
});
