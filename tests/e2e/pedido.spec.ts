import { test, expect } from '@playwright/test';
import { login, unique, createProductViaApi, getTestSecondBranch } from './helpers';

test.describe('Pedido público por WhatsApp', () => {
  test('muestra el catálogo, permite armar el carrito y abrir el checkout', async ({
    page,
  }) => {
    await login(page);

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
    await expect(page.getByText('Tu pedido', { exact: true })).toBeVisible();
    await expect(page.getByTestId(`cart-item-${product.id}`)).toBeVisible();

    await page.getByRole('button', { name: 'Pedir por WhatsApp' }).click();
    await expect(page.getByText('Finalizar pedido')).toBeVisible();

    await page.fill('input#customerName', 'Juan Pérez');

    // Sin NEXT_PUBLIC_WHATSAPP_NUMBER configurado, el envío muestra un error
    // claro en lugar de abrir un enlace inválido.
    await page.getByRole('button', { name: 'Enviar pedido por WhatsApp' }).click();
    await expect(
      page.getByText('NEXT_PUBLIC_WHATSAPP_NUMBER no está configurado')
    ).toBeVisible();
  });

  test('crea un pedido en una sucursal no default', async ({
    page,
  }) => {
    const second = await getTestSecondBranch();
    await login(page);

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

    await page.context().clearCookies();
    await page.goto(`/pedido?branchId=${second.branchId}`);

    await expect(page.getByTestId(`product-card-${product.id}`)).toBeVisible();
    await expect(
      page.getByRole('heading', { name: `Catálogo de ${second.branchName}` })
    ).toBeVisible();

    await page.getByTestId(`add-product-${product.id}`).click();
    await expect(page.getByText('Tu pedido', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Pedir por WhatsApp' }).click();
    await page.fill('input#customerName', 'Ana García');

    await page.getByRole('button', { name: 'Enviar pedido por WhatsApp' }).click();
    await expect(
      page.getByText('NEXT_PUBLIC_WHATSAPP_NUMBER no está configurado')
    ).toBeVisible();
  });
});
