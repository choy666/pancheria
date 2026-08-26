import { test, expect } from '@playwright/test';
import {
  loginAs,
  loginAsAdmin,
  getTestSecondBranch,
  unique,
  createProductViaApi,
} from './helpers';

test.describe('Trazabilidad de caja por sucursal y operador', () => {
  test('el operador ve su nombre al abrir caja y en el historial', async ({
    page,
  }) => {
    const secondBranch = await getTestSecondBranch();
    await loginAs(page, secondBranch.username, secondBranch.password);

    await page.goto('/cierre');
    await expect(
      page.getByRole('heading', { name: 'Cierre de caja' })
    ).toBeVisible();

    const openButton = page.getByRole('button', { name: 'Abrir caja' });
    await expect(openButton).toBeVisible();
    await openButton.click();

    await expect(page.getByText(`Abierta por: ${secondBranch.username}`)).toBeVisible();

    await page.goto('/ventas/historial');
    await expect(
      page.getByRole('heading', { name: 'Historial de cajas' })
    ).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });
    await expect(
      page
        .locator('[data-testid^="cash-register-row-"]')
        .filter({ hasText: secondBranch.username })
    ).toBeVisible();
  });

  test('un operador no puede acceder a la caja de otra sucursal', async ({
    page,
  }) => {
    const secondBranch = await getTestSecondBranch();

    await loginAsAdmin(page);

    await page.goto('/cierre');
    await page.getByRole('button', { name: 'Abrir caja' }).click();
    await expect(page.getByText('Abierta por:')).toBeVisible();

    const heading = page.getByRole('heading', { name: /Caja #\d+/ });
    const headingText = await heading.textContent();
    const cashRegisterId = headingText?.match(/Caja #(\d+)/)?.[1];
    expect(cashRegisterId).toBeDefined();

    await page.context().clearCookies();

    await loginAs(page, secondBranch.username, secondBranch.password);

    await page.goto(`/ventas/historial/${cashRegisterId}`);
    await expect(
      page.getByRole('heading', { name: /Caja #/ })
    ).not.toBeVisible();
    await expect(page.getByText('Esta página no se pudo encontrar')).toBeVisible();
  });

  test('el admin cambia de sucursal y el catálogo/historial se aíslan', async ({
    page,
  }) => {
    const secondBranch = await getTestSecondBranch();

    await loginAsAdmin(page);
    await page.goto('/productos');
    await expect(
      page.getByRole('heading', { name: 'Productos y promos' })
    ).toBeVisible();

    const productName = unique('Producto admin');
    await createProductViaApi(page, {
      name: productName,
      type: 'manual_supply',
      price: 0,
      unit: 'unidad',
      isActive: true,
    });

    await page.goto('/productos');
    await expect(page.getByText(productName)).toBeVisible();

    const selector = page.locator('[aria-label="Sucursal activa"]');
    await expect(selector).toBeVisible();
    await selector.click();
    const option = page.locator('[data-testid="branch-option"]', {
      hasText: secondBranch.branchName,
    });
    await option.click();
    await expect(selector).toContainText(secondBranch.branchName, { timeout: 15000 });

    await page.goto('/productos');
    await expect(page.getByText(productName)).toHaveCount(0);

    await page.goto('/ventas/historial');
    await expect(
      page.getByRole('heading', { name: 'Historial de cajas' })
    ).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator('th').filter({ hasText: 'Sucursal' })
    ).toBeVisible();
  });
});
