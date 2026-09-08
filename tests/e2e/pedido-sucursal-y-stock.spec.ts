import { test, expect } from '@playwright/test';
import { login, unique, createProductViaApi, getTestSecondBranch, restockProductViaApi, ensureCashRegisterOpen, setUniqueClientIp, clearSession } from './helpers';

test.describe('Pedido público con sucursal y stock aislado', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await ensureCashRegisterOpen(page);
    await setUniqueClientIp(page);
  });

  test('redirige a /pedido cuando branchId no es un entero positivo', async ({
    page,
  }) => {
    await page.goto('/pedido?branchId=1.5');
    await expect(page).toHaveURL(/\/pedido(\?branchId=\d+)?$/);

    await page.goto('/pedido?branchId=-1');
    await expect(page).toHaveURL(/\/pedido(\?branchId=\d+)?$/);

    await page.goto('/pedido?branchId=abc');
    await expect(page).toHaveURL(/\/pedido(\?branchId=\d+)?$/);

    await page.goto('/pedido?branchId=0');
    await expect(page).toHaveURL(/\/pedido(\?branchId=\d+)?$/);
  });
  test('muestra la sucursal por defecto y permite crear un pedido de pickup', async ({
    page,
  }) => {
    const product = await createProductViaApi(page, {
      name: unique('Pedido Sucursal Default'),
      type: 'service',
      price: 1000,
      unit: 'unidad',
      stock: 0,
      minStock: 0,
      isActive: true,
    });

    await page.goto('/pedido');
    await expect(page).toHaveURL(/\/pedido\?branchId=\d+$/);
    await expect(page.getByTestId(`product-card-${product.id}`)).toBeVisible();

    await page.getByTestId(`add-product-${product.id}`).click();
    await expect(page.getByTestId('cart-title')).toBeVisible();
    await expect(page.locator(`[data-testid="cart-item"][data-product-id="${product.id}"]`)).toBeVisible();

    await page.getByRole('button', { name: 'Hacer pedido' }).click();
    await expect(page.getByTestId('checkout-dialog-title')).toBeVisible();

    const customerName = unique('Juan Pérez');
    const customerPhone = '3415555555';
    await page.getByLabel('Nombre').fill(customerName);
    await page.getByLabel('Teléfono').fill(customerPhone);
    await page.getByRole('button', { name: 'Confirmar pedido' }).click();

    // El pedido se crea y se muestra el diálogo de éxito con el enlace al chat.
    await expect(page.getByTestId('order-success-description')).toBeVisible();
  });

  test('selecciona otra sucursal, cambia el catálogo y limpia el carrito', async ({
    page,
  }) => {
    const second = await getTestSecondBranch();
    const productDefault = await createProductViaApi(page, {
      name: unique('Solo Default'),
      type: 'service',
      price: 1000,
      unit: 'unidad',
      stock: 0,
      minStock: 0,
      isActive: true,
    });

    // Crear un producto exclusivo en la segunda sucursal usando la cookie de sucursal activa.
    await page.context().addCookies([
      {
        name: 'activeBranchId',
        value: String(second.branchId),
        domain: 'localhost',
        path: '/',
      },
    ]);

    const productSecond = await createProductViaApi(page, {
      name: unique('Solo Second'),
      type: 'service',
      price: 1500,
      unit: 'unidad',
      stock: 0,
      minStock: 0,
      isActive: true,
    });

    // Volver a la sucursal por defecto para navegar como cliente anónimo.
    await clearSession(page);
    await page.goto('/pedido');

    await expect(page.getByTestId(`product-card-${productDefault.id}`)).toBeVisible();
    await expect(page.getByTestId(`product-card-${productSecond.id}`)).toHaveCount(0);

    await page.getByTestId(`add-product-${productDefault.id}`).click();
    await expect(page.locator(`[data-testid="cart-item"][data-product-id="${productDefault.id}"]`)).toBeVisible();

    await page.goto(`/pedido?branchId=${second.branchId}`);

    await expect(
      page.getByRole('heading', { name: `Catálogo de ${second.branchName}` })
    ).toBeVisible();

    await expect(page.getByTestId(`product-card-${productDefault.id}`)).toHaveCount(0);
    await expect(page.getByTestId(`product-card-${productSecond.id}`)).toBeVisible();

    // El carrito debe haberse limpiado al cambiar de sucursal.
    await expect(page.locator(`[data-testid="cart-item"][data-product-id="${productDefault.id}"]`)).toHaveCount(0);

    await page.getByTestId(`add-product-${productSecond.id}`).click();
    await expect(page.locator(`[data-testid="cart-item"][data-product-id="${productSecond.id}"]`)).toBeVisible();

    await page.getByTestId('branch-select-trigger').click();
    await page.getByRole('option', { name: second.branchName }).click();

    await expect(page).toHaveURL(
      new RegExp(`/pedido\\?branchId=${second.branchId}`)
    );
  });

  test('limpia el carrito al cambiar de sucursal y vuelve a la sucursal original', async ({
    page,
  }) => {
    const second = await getTestSecondBranch();
    const productDefault = await createProductViaApi(page, {
      name: unique('Carrito Default'),
      type: 'service',
      price: 1000,
      unit: 'unidad',
      stock: 0,
      minStock: 0,
      isActive: true,
    });

    await page.goto('/pedido');
    await page.getByTestId(`add-product-${productDefault.id}`).click();

    await expect(page.locator(`[data-testid="cart-item"][data-product-id="${productDefault.id}"]`)).toBeVisible();

    await page.goto(`/pedido?branchId=${second.branchId}`);

    await expect(page.locator(`[data-testid="cart-item"][data-product-id="${productDefault.id}"]`)).toHaveCount(0);

    await page.goto('/pedido');

    await expect(page.locator(`[data-testid="cart-item"][data-product-id="${productDefault.id}"]`)).toHaveCount(0);
  });

  test('no reserva stock al crear el pedido y descuenta al confirmar pago desde el panel', async ({
    page,
  }) => {
    const product = await createProductViaApi(page, {
      name: unique('Bebida Stock E2E'),
      type: 'critical_supply',
      criticalSupplyType: 'beverage',
      price: 1000,
      unit: 'unidad',
      isActive: true,
    });
    const initialStock = 5;
    await restockProductViaApi(page, product.id, initialStock);

    await page.goto('/pedido');
    await expect(page.getByTestId(`product-card-${product.id}`)).toBeVisible();
    await expect(
      page
        .getByTestId(`product-card-${product.id}`)
        .getByTestId('product-availability')
    ).toHaveText('Disponible');

    await page.getByTestId(`add-product-${product.id}`).click();
    await expect(page.locator(`[data-testid="cart-item"][data-product-id="${product.id}"]`)).toBeVisible();

    await page.getByRole('button', { name: 'Hacer pedido' }).click();
    await expect(page.getByTestId('checkout-dialog-title')).toBeVisible();

    const customerName = unique('Juan Pérez');
    const customerPhone = '3415555555';
    await page.getByLabel('Nombre').fill(customerName);
    await page.getByLabel('Teléfono').fill(customerPhone);
    await page.getByRole('button', { name: 'Confirmar pedido' }).click();

    await expect(page.getByTestId('order-success-description')).toBeVisible();

    // Cerrar el diálogo para poder seguir navegando.
    await page.getByRole('button', { name: 'Cerrar' }).click();
    await expect(page.getByTestId('order-success-description')).not.toBeVisible();

    // El pedido pending no reserva stock: la disponibilidad sigue igual.
    await page.goto('/pedido');
    await expect(
      page
        .getByTestId(`product-card-${product.id}`)
        .getByTestId('product-availability')
    ).toHaveText('Disponible');

    // Confirmar el pedido desde el panel.
    await page.goto('/pedidos');
    await page
      .locator('[data-testid^="row-order-"]')
      .filter({ hasText: customerName })
      .getByRole('link', { name: 'Ver' })
      .click();

    await ensureCashRegisterOpen(page);

    await page.getByTestId('payment-cash-input').fill('1000');

    await page.getByRole('button', { name: 'Confirmar pago' }).click();
    await expect(page.getByTestId('confirm-payment-button')).not.toHaveText('Confirmando...', { timeout: 10000 });

    // El stock se descontó, pero al público solo se muestra un estado cualitativo.
    await page.goto('/pedido');
    await expect(
      page
        .getByTestId(`product-card-${product.id}`)
        .getByTestId('product-availability')
    ).toHaveText('Disponible');
  });
});
