import { test, expect } from '@playwright/test';
import { login, unique, createProductViaApi, getTestSecondBranch, ensureCashRegisterOpen, setUniqueClientIp, clearSession } from './helpers';

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
    await expect(page.getByText('Tu pedido', { exact: true })).toBeVisible();
    await expect(page.getByTestId(`cart-item-${product.id}`)).toBeVisible();

    await page.getByRole('button', { name: 'Hacer pedido' }).click();
    await expect(page.getByText('Finalizar pedido')).toBeVisible();

    await page.getByLabel('Nombre').fill('Juan Pérez');
    await page.getByLabel('Teléfono').fill('3415555555');
    await page.getByRole('button', { name: 'Confirmar pedido' }).click();

    await expect(page.getByText('Pedido creado')).toBeVisible();
    await page.getByRole('button', { name: 'Ir al chat del pedido' }).click();

    await expect(page).toHaveURL(/\/pedido\/\d+\/chat/);
    await expect(page.getByText('Chat del pedido')).toBeVisible();
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

    await clearSession(page);
    await page.goto(`/pedido?branchId=${second.branchId}`);

    await expect(page.getByTestId(`product-card-${product.id}`)).toBeVisible();
    await expect(
      page.getByRole('heading', { name: `Catálogo de ${second.branchName}` })
    ).toBeVisible();

    await page.getByTestId(`add-product-${product.id}`).click();
    await expect(page.getByText('Tu pedido', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Hacer pedido' }).click();
    await page.getByLabel('Nombre').fill('Ana García');
    await page.getByLabel('Teléfono').fill('3416666666');
    await page.getByRole('button', { name: 'Confirmar pedido' }).click();

    await expect(page.getByText('Pedido creado')).toBeVisible();
    await page.getByRole('button', { name: 'Ir al chat del pedido' }).click();

    await expect(page).toHaveURL(/\/pedido\/\d+\/chat/);
  });
});
