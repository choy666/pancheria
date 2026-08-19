import { test, expect } from '@playwright/test';
import { login, unique, createProductViaApi, getTestSecondBranch } from './helpers';

test.describe('Pedido público con sucursal y stock aislado', () => {
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
    await login(page);

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
    await expect(page.getByText('Tu pedido', { exact: true })).toBeVisible();
    await expect(page.getByTestId(`cart-item-${product.id}`)).toBeVisible();

    await page.getByRole('button', { name: 'Pedir por WhatsApp' }).click();
    await expect(page.getByText('Finalizar pedido')).toBeVisible();

    await page.fill('input#customerName', 'Juan Pérez');
    await page.getByRole('button', { name: 'Enviar pedido por WhatsApp' }).click();

    const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.trim() ?? '';

    if (whatsappNumber) {
      // Si el número de WhatsApp está configurado, el pedido se crea y se muestra el diálogo de éxito.
      await expect(page.getByText('El pedido se reservó correctamente')).toBeVisible();
    } else {
      // Si no hay número configurado, la API devuelve el error de configuración antes de crear el pedido.
      await expect(
        page.getByText('NEXT_PUBLIC_WHATSAPP_NUMBER no está configurado')
      ).toBeVisible();
    }
  });

  test('selecciona otra sucursal, cambia el catálogo y limpia el carrito', async ({
    page,
  }) => {
    const second = await getTestSecondBranch();
    await login(page);

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
    await page.context().clearCookies();
    await page.goto('/pedido');

    await expect(page.getByTestId(`product-card-${productDefault.id}`)).toBeVisible();
    await expect(page.getByTestId(`product-card-${productSecond.id}`)).toHaveCount(0);

    await page.getByTestId(`add-product-${productDefault.id}`).click();
    await expect(page.getByTestId(`cart-item-${productDefault.id}`)).toBeVisible();

    await page.goto(`/pedido?branchId=${second.branchId}`);

    await expect(
      page.getByRole('heading', { name: `Catálogo de ${second.branchName}` })
    ).toBeVisible();

    await expect(page.getByTestId(`product-card-${productDefault.id}`)).toHaveCount(0);
    await expect(page.getByTestId(`product-card-${productSecond.id}`)).toBeVisible();

    // El carrito debe haberse limpiado al cambiar de sucursal.
    await expect(page.getByTestId(`cart-item-${productDefault.id}`)).toHaveCount(0);

    await page.getByTestId(`add-product-${productSecond.id}`).click();
    await expect(page.getByTestId(`cart-item-${productSecond.id}`)).toBeVisible();

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
    await login(page);

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

    await expect(page.getByTestId(`cart-item-${productDefault.id}`)).toBeVisible();

    await page.goto(`/pedido?branchId=${second.branchId}`);

    await expect(page.getByTestId(`cart-item-${productDefault.id}`)).toHaveCount(0);

    await page.goto('/pedido');

    await expect(page.getByTestId(`cart-item-${productDefault.id}`)).toHaveCount(0);
  });
});
