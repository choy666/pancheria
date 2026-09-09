import { test, expect } from '@playwright/test';
import {
  login,
  unique,
  createProductViaApi,
  getTestSecondBranch,
  ensureCashRegisterOpen,
  setUniqueClientIp,
  clearSession,
  createPromoWithRecipeViaApi,
} from './helpers';

test.describe('Pedido público con chat', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await ensureCashRegisterOpen(page);
    await setUniqueClientIp(page);
  });

  test('muestra el catálogo, permite armar el carrito y abrir el chat del pedido', async ({
    page,
  }) => {
    const product = await createProductViaApi(page, {
      name: unique('Pedido E2E'),
      type: 'service',
      price: 1000,
      unit: 'unidad',
      stock: 0,
      minStock: 0,
      isActive: true,
    });

    await page.goto('/pedido');
    await expect(page.getByTestId(`product-card-${product.id}`)).toBeVisible();

    await page.getByTestId(`add-product-${product.id}`).click();
    await expect(page.getByTestId('cart-title')).toBeVisible();
    await expect(page.locator(`[data-product-id="${product.id}"]`)).toBeVisible();

    await page.getByRole('button', { name: 'Hacer pedido' }).click();
    await expect(page.getByTestId('checkout-dialog-title')).toBeVisible();

    await page.getByLabel('Nombre').fill('Juan Pérez');
    await page.getByLabel('Teléfono').fill('3415555555');
    await page.getByRole('button', { name: 'Confirmar pedido' }).click();

    await expect(page.getByTestId('order-success-title')).toBeVisible();
    await page.getByRole('button', { name: 'Ir al chat del pedido' }).click();

    await expect(page).toHaveURL(/\/pedido\/\d+\/chat/);
    await expect(page.getByTestId('chat-title')).toHaveText('Chat del pedido');
  });

  test('agrega dos variantes del mismo producto con personalizaciones distintas', async ({
    page,
  }) => {
    const { promo, manual: cebolla } = await createPromoWithRecipeViaApi(page, {
      baseName: 'Promo multilinea',
    });

    await page.goto('/pedido');
    await expect(page.getByTestId(`product-card-${promo.id}`)).toBeVisible();

    // Agregar la primera variante: con cebolla.
    await page.getByTestId(`add-product-${promo.id}`).click();
    await expect(
      page.getByRole('heading', { name: promo.name })
    ).toBeVisible({ timeout: 5000 });
    await page
      .getByLabel(new RegExp(`Incluir ${cebolla.name} en ${promo.name}`))
      .check();
    await page.getByRole('button', { name: 'Agregar al pedido' }).click();

    await expect(page.locator(`[data-product-id="${promo.id}"]`)).toHaveCount(
      1,
      { timeout: 5000 }
    );

    // Agregar la segunda variante: sin cebolla.
    await page.getByTestId(`add-product-${promo.id}`).click();
    await expect(
      page.getByRole('heading', { name: promo.name })
    ).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Agregar al pedido' }).click();

    await expect(page.locator(`[data-product-id="${promo.id}"]`)).toHaveCount(
      2,
      { timeout: 5000 }
    );

    // El checkout muestra ambas líneas.
    await page.getByRole('button', { name: 'Hacer pedido' }).click();
    await expect(page.getByTestId('checkout-dialog-title')).toBeVisible();
    await expect(
      page.locator('[data-testid="checkout-item"][data-product-id="' + promo.id + '"]')
    ).toHaveCount(2);

    await page.getByLabel('Nombre').fill('Juan Pérez');
    await page.getByLabel('Teléfono').fill('3415555555');
    await page.getByRole('button', { name: 'Confirmar pedido' }).click();

    await expect(page.getByTestId('order-success-title')).toBeVisible({
      timeout: 10000,
    });
  });

  test('edita la personalización de una línea sin fusionarla con otra idéntica', async ({
    page,
  }) => {
    const { promo, manual: cebolla } = await createPromoWithRecipeViaApi(page, {
      baseName: 'Promo edicion',
    });

    await page.goto('/pedido');
    await expect(page.getByTestId(`product-card-${promo.id}`)).toBeVisible();

    // Agregar variante con cebolla.
    await page.getByTestId(`add-product-${promo.id}`).click();
    await expect(
      page.getByRole('heading', { name: promo.name })
    ).toBeVisible({ timeout: 5000 });
    await page
      .getByLabel(new RegExp(`Incluir ${cebolla.name} en ${promo.name}`))
      .check();
    await page.getByRole('button', { name: 'Agregar al pedido' }).click();

    // Agregar variante sin cebolla.
    await page.getByTestId(`add-product-${promo.id}`).click();
    await expect(
      page.getByRole('heading', { name: promo.name })
    ).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Agregar al pedido' }).click();

    await expect(page.locator(`[data-product-id="${promo.id}"]`)).toHaveCount(
      2,
      { timeout: 5000 }
    );

    // Editar la segunda línea para que quede igual a la primera.
    const secondLine = page
      .locator(`[data-product-id="${promo.id}"]`)
      .nth(1);
    await secondLine
      .getByRole('button', { name: `Editar personalización de ${promo.name}` })
      .click();

    await expect(
      page.getByRole('heading', { name: promo.name })
    ).toBeVisible({ timeout: 5000 });
    await page
      .getByLabel(new RegExp(`Incluir ${cebolla.name} en ${promo.name}`))
      .check();
    await page.getByRole('button', { name: 'Guardar cambios' }).click();

    // Las líneas personalizables nunca se fusionan: quedan dos líneas y
    // ambas muestran la cebolla como incluida.
    await expect(page.locator(`[data-product-id="${promo.id}"]`)).toHaveCount(
      2,
      { timeout: 5000 }
    );
    await expect(
      page
        .locator(`[data-product-id="${promo.id}"]`)
        .filter({ hasText: new RegExp(`Incluye:.*${cebolla.name}`) })
    ).toHaveCount(2);
  });

  test('crea un pedido en una sucursal no default y abre el chat', async ({
    page,
  }) => {
    const second = await getTestSecondBranch();

    await page.context().addCookies([
      {
        name: 'activeBranchId',
        value: String(second.branchId),
        domain: 'localhost',
        path: '/',
      },
    ]);

    const product = await createProductViaApi(page, {
      name: unique('Pedido Sucursal Second'),
      type: 'service',
      price: 1000,
      unit: 'unidad',
      stock: 0,
      minStock: 0,
      isActive: true,
    });

    // Asegurar que haya una caja abierta en la sucursal objetivo.
    await ensureCashRegisterOpen(page);

    await clearSession(page);
    await page.goto(`/pedido?branchId=${second.branchId}`);

    await expect(page.getByTestId(`product-card-${product.id}`)).toBeVisible();
    await expect(
      page.getByRole('heading', { name: `Catálogo de ${second.branchName}` })
    ).toBeVisible();

    await page.getByTestId(`add-product-${product.id}`).click();
    await expect(page.getByTestId('cart-title')).toBeVisible();

    await page.getByRole('button', { name: 'Hacer pedido' }).click();
    await page.getByLabel('Nombre').fill('Ana García');
    await page.getByLabel('Teléfono').fill('3416666666');
    await page.getByRole('button', { name: 'Confirmar pedido' }).click();

    await expect(page.getByTestId('order-success-title')).toBeVisible();
    await page.getByRole('button', { name: 'Ir al chat del pedido' }).click();

    await expect(page).toHaveURL(/\/pedido\/\d+\/chat/);
  });

  test('mantiene líneas separadas en panel y chat con detalle de preparación', async ({
    page,
  }) => {
    const { promo, manual: cebolla } = await createPromoWithRecipeViaApi(page, {
      baseName: 'Promo panel',
    });

    await page.goto('/pedido');
    await expect(page.getByTestId(`product-card-${promo.id}`)).toBeVisible();

    // Agregar variante con cebolla.
    await page.getByTestId(`add-product-${promo.id}`).click();
    await expect(
      page.getByRole('heading', { name: promo.name })
    ).toBeVisible({ timeout: 5000 });
    await page
      .getByLabel(new RegExp(`Incluir ${cebolla.name} en ${promo.name}`))
      .check();
    await page.getByRole('button', { name: 'Agregar al pedido' }).click();

    // Agregar variante sin cebolla.
    await page.getByTestId(`add-product-${promo.id}`).click();
    await expect(
      page.getByRole('heading', { name: promo.name })
    ).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Agregar al pedido' }).click();

    await expect(page.locator(`[data-product-id="${promo.id}"]`)).toHaveCount(
      2,
      { timeout: 5000 }
    );

    // Confirmar el pedido y abrir el chat para capturar el orderId.
    await page.getByRole('button', { name: 'Hacer pedido' }).click();
    await expect(page.getByTestId('checkout-dialog-title')).toBeVisible();

    const customerName = unique('Cliente Panel');
    await page.getByLabel('Nombre').fill(customerName);
    await page.getByLabel('Teléfono').fill('3415555555');
    await page.getByRole('button', { name: 'Confirmar pedido' }).click();

    await expect(page.getByTestId('order-success-title')).toBeVisible({
      timeout: 10000,
    });
    await page.getByRole('button', { name: 'Ir al chat del pedido' }).click();

    await expect(page).toHaveURL(/\/pedido\/\d+\/chat/);
    const orderIdMatch = page.url().match(/\/pedido\/(\d+)\/chat/);
    const orderId = orderIdMatch ? orderIdMatch[1] : null;
    expect(orderId).not.toBeNull();

    // Operador: revisar panel de pedidos.
    await login(page);
    await page.goto('/pedidos');

    const orderRow = page
      .locator(`[data-testid^="row-order-"]`)
      .filter({ hasText: customerName });
    await expect(orderRow).toBeVisible({ timeout: 10000 });
    await orderRow.getByRole('link', { name: 'Ver' }).click();

    // Verificar dos líneas del mismo producto.
    const productRows = page.locator('table tbody tr').filter({ hasText: promo.name });
    await expect(productRows).toHaveCount(2);

    // Cada línea muestra un resumen de receta distinto.
    const detailRows = page.locator('table tbody tr').filter({ hasText: promo.name });
    await expect(detailRows.filter({ hasText: /Incluye:/ })).toHaveCount(2);
    await expect(
      detailRows.filter({ hasText: new RegExp(`Sin:.*${cebolla.name}`) })
    ).toHaveCount(1);

    // El chat del operador contiene el mensaje de preparación con ambas configuraciones.
    const prepMessage = page
      .getByTestId('chat-message-text')
      .filter({ hasText: 'Detalle de preparación' });
    await expect(prepMessage).toBeVisible({ timeout: 10000 });
    await expect(prepMessage).toContainText(`${promo.name} x1`);
    await expect(prepMessage).toContainText(/Incluye:/);
    await expect(prepMessage).toContainText(/Sin:/);
  });

  test('mantiene el botón Hacer pedido visible con muchas líneas en el carrito', async ({
    page,
  }) => {
    const { promo } = await createPromoWithRecipeViaApi(page, {
      baseName: 'Promo scroll',
      price: 1000,
      restock: 30,
    });

    await page.goto('/pedido');
    await expect(page.getByTestId(`product-card-${promo.id}`)).toBeVisible();

    for (let i = 0; i < 15; i += 1) {
      await page.getByTestId(`add-product-${promo.id}`).click();
      await expect(
        page.getByRole('heading', { name: promo.name })
      ).toBeVisible({ timeout: 5000 });
      await page.getByRole('button', { name: 'Agregar al pedido' }).click();
    }

    await expect(page.locator('[data-testid="cart-item"]')).toHaveCount(15, {
      timeout: 5000,
    });
    await expect(page.getByTestId('checkout-button')).toBeInViewport();
  });
});
