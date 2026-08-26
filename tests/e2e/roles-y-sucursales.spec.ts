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

  test('en /usuarios lista todos los usuarios del sistema', async ({ page }) => {
    const secondBranch = await getTestSecondBranch();
    await page.goto('/usuarios');

    await expect(page.getByRole('heading', { name: 'Usuarios', level: 1 })).toBeVisible();

    const table = page.getByRole('table');
    await expect(table).toBeVisible({ timeout: 10000 });

    const adminUsername = process.env.ADMIN_USERNAME ?? 'admin';
    await expect(page.getByText(adminUsername).first()).toBeVisible();
    await expect(page.getByText(secondBranch.username).first()).toBeVisible();

    const adminRow = page.locator('tr').filter({ hasText: adminUsername });
    await expect(adminRow).toContainText('Todas las sucursales');

    const operatorRow = page.locator('tr').filter({ hasText: secondBranch.username });
    await expect(operatorRow).toContainText(secondBranch.branchName);
  });

  test('puede cambiar de sucursal con el BranchSelector', async ({ page }) => {
    const defaultBranchName = process.env.DEFAULT_BRANCH_NAME ?? 'Sucursal por defecto';
    const secondBranch = await getTestSecondBranch();

    await page.goto('/');

    const selector = page.locator('[aria-label="Sucursal activa"]');
    await expect(selector).toBeVisible();
    await expect(selector).toContainText(defaultBranchName);

    await selector.click();
    const option = page.locator('[data-testid="branch-option"]', {
      hasText: secondBranch.branchName,
    });
    await expect(option).toBeVisible({ timeout: 5000 });
    await option.click();

    // Verificamos que el selector muestre el nombre de la sucursal activa.
    await expect(selector).toContainText(secondBranch.branchName, { timeout: 15000 });

    // El admin no debe ver el span redundante porque el selector ya muestra el nombre.
    await expect(page.getByTestId('active-branch-name')).toHaveCount(0);
  });

  test('en /usuarios no puede editar ni eliminar al administrador inicial', async ({ page }) => {
    const adminUsername = process.env.ADMIN_USERNAME ?? 'admin';
    await page.goto('/usuarios');

    await expect(page.getByRole('heading', { name: 'Usuarios', level: 1 })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });

    const adminRow = page.locator('tr').filter({ hasText: adminUsername });
    await expect(adminRow).toBeVisible();
    await expect(adminRow.getByRole('button', { name: 'Editar' })).toHaveCount(0);
    await expect(adminRow.getByRole('button', { name: 'Eliminar' })).toHaveCount(0);
  });

  test('en /usuarios puede crear, editar y eliminar un usuario operador', async ({ page }) => {
    const defaultBranchName = process.env.DEFAULT_BRANCH_NAME ?? 'Sucursal por defecto';
    const secondBranch = await getTestSecondBranch();
    const operatorUsername = unique('operador-e2e');
    const editedUsername = unique('operador-editado');

    await page.goto('/usuarios');
    await expect(page.getByRole('heading', { name: 'Usuarios', level: 1 })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });

    // Crear un operador en la sucursal por defecto.
    await page.getByLabel('Nombre de usuario').fill(operatorUsername);
    await page.locator('#password').fill('123456');
    await page.locator('#branchId').click();
    await expect(page.locator('[role="listbox"]')).toBeVisible();
    await page
      .locator('[role="option"]', { hasText: defaultBranchName })
      .click();
    await page
      .getByRole('button', { name: /^(Crear usuario|Guardar cambios)$/ })
      .click();

    await expect(page.getByText(operatorUsername).first()).toBeVisible({ timeout: 10000 });

    const operatorRow = page.locator('tr').filter({ hasText: operatorUsername });

    // Editar el operador: cambiar nombre, sucursal y contraseña.
    await operatorRow.getByRole('button', { name: 'Editar' }).click();
    await page.getByLabel('Nombre de usuario').fill(editedUsername);
    await page.locator('#password').fill('nueva1234');
    await page.locator('#branchId').click();
    await expect(page.locator('[role="listbox"]')).toBeVisible();
    await page
      .locator('[role="option"]', { hasText: secondBranch.branchName })
      .click();
    await page
      .getByRole('button', { name: /^(Crear usuario|Guardar cambios)$/ })
      .click();

    await expect(page.getByText(editedUsername).first()).toBeVisible({ timeout: 10000 });
    const editedRow = page.locator('tr').filter({ hasText: editedUsername });
    await expect(editedRow).toContainText(secondBranch.branchName);

    // Eliminar el operador.
    await editedRow.getByRole('button', { name: 'Eliminar' }).click();
    await expect(page.getByRole('dialog', { name: 'Confirmar eliminación' })).toBeVisible();
    await page.getByRole('button', { name: 'Eliminar' }).last().click();
    await expect(editedRow).toHaveCount(0, { timeout: 10000 });
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

  test('ve el nombre de su sucursal asignada en la navbar', async ({ page }) => {
    const defaultBranchName = process.env.DEFAULT_BRANCH_NAME ?? 'Sucursal por defecto';
    await page.goto('/');
    await expect(page.getByTestId('active-branch-name').first()).toHaveText(
      defaultBranchName,
      { timeout: 10000 }
    );
  });

  test('no puede crear productos ni recetas desde las APIs', async ({ page }) => {
    const productRes = await page.request.post('/api/productos', {
      data: {
        name: unique('Producto operator'),
        type: 'manual_supply',
        price: 0,
        unit: 'unidad',
        stock: 0,
        minStock: 0,
        isActive: true,
      },
    });
    expect(productRes.status()).toBe(403);

    const recipeRes = await page.request.post('/api/recetas', {
      data: {
        compoundProductId: 1,
        items: [{ supplyId: 2, quantity: 1, autoDiscount: true }],
      },
    });
    expect(recipeRes.status()).toBe(403);
  });

  test('puede listar productos de su sucursal desde la API', async ({ page }) => {
    const res = await page.request.get('/api/productos?includeAvailability=true');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
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
