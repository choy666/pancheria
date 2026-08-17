import { test, expect } from '@playwright/test';
import { login, unique, createProductViaApi, getTestSecondBranch } from './helpers';

test.describe('Pedido público con sucursal y stock aislado', () => {
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
    await expect(page.getByText(product.name)).toBeVisible();

    await page.getByRole('button', { name: 'Agregar' }).first().click();
    await expect(page.getByText('Tu pedido', { exact: true })).toBeVisible();
    await expect(page.getByText(product.name)).toBeVisible();

    await page.getByRole('button', { name: 'Pedir por WhatsApp' }).click();
    await expect(page.getByText('Finalizar pedido')).toBeVisible();

    await page.fill('input#customerName', 'Juan Pérez');
    await page.getByRole('button', { name: 'Reservar y abrir WhatsApp' }).click();

    await expect(
      page.getByText('NEXT_PUBLIC_WHATSAPP_NUMBER no está configurado')
    ).toBeVisible();
  });

  test('selecciona otra sucursal, cambia el catálogo y conserva el aislamiento de stock', async ({
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

    await page.goto(`/pedido?branchId=${second.branchId}`);

    await expect(
      page.getByRole('heading', { name: `Catálogo de ${second.branchName}` })
    ).toBeVisible();

    await page.getByLabel('Sucursal').click();
    await page.getByRole('option', { name: second.branchName }).click();

    await expect(page).toHaveURL(new RegExp(`/pedido\\?branchId=${second.branchId}`));

    await expect(page.getByText(productDefault.name)).not.toBeVisible();
  });
});
