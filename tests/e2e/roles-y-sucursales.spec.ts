import { test, expect } from '@playwright/test';
import { db } from '../../src/db';
import { products } from '../../src/db/schema';
import {
  loginAs,
  loginAsAdmin,
  loginAsOperator,
  getTestSecondBranch,
  getDefaultBranchId,
  unique,
} from './helpers';

test.describe('Rol administrador', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('puede acceder a todas las rutas del panel administrativo', async ({ page }) => {
    const rutasAdmin = [
      { path: '/', heading: 'Panel de control' },
      { path: '/ventas', heading: 'Ventas' },
      { path: '/productos', heading: 'Productos y promos' },
      { path: '/stock', heading: 'Stock' },
      { path: '/cierre', heading: 'Cierre de caja' },
      { path: '/sucursales', heading: 'Sucursales' },
      { path: '/usuarios', heading: 'Usuarios' },
      { path: '/ventas/historial', heading: 'Historial de cajas' },
      { path: '/ventas/historial/eliminadas', heading: 'Cajas eliminadas' },
    ];

    for (const { path, heading } of rutasAdmin) {
      await page.goto(path);
      await expect(page).toHaveURL(path, { timeout: 15000 });
      await expect(
        page.getByRole('heading', { name: heading, level: 1 })
      ).toBeVisible({ timeout: 10000 });
    }

    // El navbar de admin muestra todas las secciones.
    const nav = page.locator('nav[data-tour="main-nav"]');
    for (const label of ['Panel', 'Ventas', 'Historial', 'Productos', 'Stock', 'Caja', 'Sucursales', 'Usuarios']) {
      await expect(nav).toContainText(label);
    }
  });

  test('puede cambiar de sucursal con el BranchSelector', async ({ page }) => {
    const defaultBranchName = process.env.DEFAULT_BRANCH_NAME ?? 'Sucursal por defecto';
    const secondBranch = await getTestSecondBranch();

    await page.goto('/');

    const selector = page.locator('[aria-label="Sucursal activa"]');
    await expect(selector).toBeVisible();
    await expect(selector).toHaveText(defaultBranchName);

    await selector.click();
    const option = page.locator('[data-testid="branch-option"]', {
      hasText: secondBranch.branchName,
    });
    await expect(option).toBeVisible({ timeout: 5000 });
    await option.click();

    // Verificamos que el selector y el nombre de la sucursal activa se actualicen.
    await expect(selector).toHaveText(secondBranch.branchName, { timeout: 15000 });
    await expect(page.getByTestId('active-branch-name').first()).toHaveText(
      secondBranch.branchName,
      { timeout: 15000 }
    );
  });
});

test.describe('Rol operador', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOperator(page);
  });

  test('puede acceder a las secciones permitidas', async ({ page }) => {
    const rutasPermitidas = [
      { path: '/', heading: 'Panel de control' },
      { path: '/ventas', heading: 'Ventas' },
      { path: '/ventas/historial', heading: 'Historial de cajas' },
      { path: '/stock', heading: 'Stock' },
      { path: '/cierre', heading: 'Cierre de caja' },
    ];

    for (const { path, heading } of rutasPermitidas) {
      await page.goto(path);
      await expect(page).toHaveURL(path, { timeout: 15000 });
      await expect(
        page.getByRole('heading', { name: heading, level: 1 })
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test('no puede acceder a rutas de administración ni ver su navegación', async ({ page }) => {
    const nav = page.locator('nav[data-tour="main-nav"]');

    // El navbar del operador solo muestra sus secciones permitidas.
    for (const label of ['Panel', 'Ventas', 'Historial', 'Stock', 'Caja']) {
      await expect(nav).toContainText(label);
    }
    for (const label of ['Productos', 'Sucursales', 'Usuarios']) {
      await expect(nav).not.toContainText(label);
    }

    // Al ingresar directamente a rutas protegidas, se redirige al panel.
    const rutasProtegidas = [
      { path: '/productos', heading: 'Productos y promos' },
      { path: '/sucursales', heading: 'Sucursales' },
      { path: '/usuarios', heading: 'Usuarios' },
    ];

    for (const { path, heading } of rutasProtegidas) {
      await page.goto(path);
      await expect(page).toHaveURL('/', { timeout: 15000 });
      await expect(page.getByRole('heading', { name: 'Panel de control' })).toBeVisible();
      await expect(page.getByRole('heading', { name: heading })).not.toBeVisible();
    }
  });

  test('no ve el selector de sucursal', async ({ page }) => {
    await expect(page.locator('[aria-label="Sucursal activa"]')).toHaveCount(0);
  });
});

test.describe('Aislamiento de datos por sucursal', () => {
  test.beforeEach(async ({ page }) => {
    const secondBranch = await getTestSecondBranch();
    await loginAs(page, secondBranch.username, secondBranch.password);
  });

  test('el operador ve solo los productos de su sucursal asignada', async ({ page }) => {
    const secondBranch = await getTestSecondBranch();
    const defaultBranchId = await getDefaultBranchId();

    const ownProduct = unique('Producto propio');
    const otherProduct = unique('Producto otra sucursal');

    await db.insert(products).values({
      name: ownProduct,
      branchId: secondBranch.branchId,
      type: 'manual_supply',
      price: 0,
      unit: 'unidad',
      stock: 0,
      minStock: 0,
      isActive: true,
      criticalSupplyType: null,
      description: null,
    });

    await db.insert(products).values({
      name: otherProduct,
      branchId: defaultBranchId,
      type: 'manual_supply',
      price: 0,
      unit: 'unidad',
      stock: 0,
      minStock: 0,
      isActive: true,
      criticalSupplyType: null,
      description: null,
    });

    await page.goto('/stock');
    await expect(page.getByRole('heading', { name: 'Stock' })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });

    await expect(page.getByText(ownProduct, { exact: true })).toBeVisible();
    await expect(page.getByText(otherProduct, { exact: true })).toHaveCount(0);
  });
});
