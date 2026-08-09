import { test, expect, type Page } from '@playwright/test';

const adminUsername = process.env.ADMIN_USERNAME || '';
const adminPassword = process.env.ADMIN_PASSWORD || '';

function unique(prefix: string) {
  return `${prefix} ${Date.now()}`;
}

async function login(page: Page) {
  await page.goto('/login');
  await page.fill('input[name="username"]', adminUsername);
  await page.fill('input[name="password"]', adminPassword);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/', { timeout: 15000 });
}

async function createProductViaApi(page: Page, data: Record<string, unknown>) {
  const response = await page.request.post('/api/productos', { data });
  expect(response.status()).toBe(201);
  return (await response.json()) as { id: number; name: string };
}

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
      stock: 20,
      minStock: 5,
      isActive: true,
    });

    const manual = await createProductViaApi(page, {
      name: unique('Aderezo E2E'),
      type: 'manual_supply',
      price: 0,
      unit: 'unidad',
      stock: 30,
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
    await expect(compoundRow.getByRole('link', { name: 'Receta' })).toBeVisible();

    await page.goto(`/recetas/${compound.id}/editar`);
    await expect(page.getByText('Guardar receta')).toBeVisible();

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
    await expect(updatedRow.getByText('Inactivo')).toBeVisible();
  });

  test('crea una promo desde la UI con Súper Pancho y bebida', async ({
    page,
  }) => {
    await login(page);

    await page.goto('/productos');
    await page.getByRole('link', { name: 'Nueva promo' }).click();
    await expect(page).toHaveURL('/productos/nuevo?tab=promo');

    const promoName = unique('Promo UI');
    await page.getByLabel('Nombre de la promo').waitFor();
    await page.getByLabel('Nombre de la promo').fill(promoName);
    await page.fill('#promo-price', '2500');
    await page.fill('#promo-super-panchos', '2');
    await page.check('#promo-includes-beverage');

    await page.click('#promo-beverage');
    await page.getByText('Coca de 1L (botella)').click();
    await page.fill('#promo-beverage-quantity', '1');

    await expect(page.locator('#promo-name')).toHaveValue(promoName);
    await page.getByRole('button', { name: 'Guardar promo' }).click();
    await expect(page).toHaveURL('/productos', { timeout: 10000 });

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
      stock: 10,
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
        stock: 10,
        minStock: 2,
        isActive: true,
      },
    });

    expect(response.status()).toBe(400);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toContain('Los insumos manuales no pueden tener precio.');
  });
});
