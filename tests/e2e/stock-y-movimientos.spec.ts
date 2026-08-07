import { test, expect, type Page } from '@playwright/test';
import { ensureCashRegisterClosed, ensureCashRegisterOpen } from './helpers';

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

test.describe('Stock, ajustes y movimientos', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('muestra alerta de stock bajo y rechaza ajuste negativo excesivo', async ({
    page,
  }) => {
    const producto = await createProductViaApi(page, {
      name: unique('Stock bajo E2E'),
      type: 'critical_supply',
      criticalSupplyType: 'beverage',
      price: 300,
      unit: 'unidad',
      stock: 2,
      minStock: 5,
      isActive: true,
    });

    await page.goto('/stock');
    const row = page.locator('tr').filter({ hasText: new RegExp(producto.name) });
    await expect(row.getByText('Stock bajo', { exact: true })).toBeVisible();

    await row.getByRole('button', { name: 'Ajustar' }).first().click();
    await page.fill('input#adjust-quantity', '-10');
    await page.fill('textarea#adjust-reason', 'Ajuste negativo de prueba');
    await page.getByRole('button', { name: 'Guardar ajuste' }).click();

    await expect(page.getByText('en negativo')).toBeVisible({ timeout: 10000 });

    const ajuste = await page.request.post('/api/stock/ajustar', {
      data: {
        productId: producto.id,
        quantity: 4,
        reason: 'Ajuste positivo de prueba',
      },
    });
    expect(ajuste.status()).toBe(200);

    await page.goto('/stock');
    const updatedRow = page.locator('tr').filter({ hasText: new RegExp(producto.name) });
    await expect(updatedRow.getByText('OK', { exact: true })).toBeVisible();

    await updatedRow.getByRole('button', { name: 'Historial' }).first().click();
    await expect(page.getByText('Ajuste positivo de prueba')).toBeVisible();
  });

  test('la venta y la anulación generan movimientos del tipo correcto', async ({
    page,
  }) => {
    await ensureCashRegisterOpen(page);

    const bebida = await createProductViaApi(page, {
      name: unique('Bebida movimientos'),
      type: 'critical_supply',
      criticalSupplyType: 'beverage',
      price: 500,
      unit: 'unidad',
      stock: 5,
      minStock: 0,
      isActive: true,
    });

    const venta = await page.request.post('/api/ventas', {
      data: {
        items: [{ productId: bebida.id, quantity: 2 }],
        paymentMethod: 'cash',
        idempotencyKey: `movimientos-${Date.now()}`,
      },
    });
    expect(venta.status()).toBe(201);
    const { id: ventaId } = (await venta.json()) as { id: number };

    const movimientosVenta = await page.request.get(
      `/api/stock/movimientos?productId=${bebida.id}`
    );
    expect(movimientosVenta.status()).toBe(200);
    const movsVenta = (await movimientosVenta.json()) as {
      type: string;
      quantity: number;
    }[];
    const movVenta = movsVenta.find((m) => m.type === 'sale');
    expect(movVenta).toBeTruthy();
    expect(movVenta?.quantity).toBe(-2);

    const anular = await page.request.post(`/api/ventas/${ventaId}/anular`, {
      data: { reason: 'Error de carga' },
    });
    expect(anular.status()).toBe(200);

    const movimientosAnulacion = await page.request.get(
      `/api/stock/movimientos?productId=${bebida.id}`
    );
    expect(movimientosAnulacion.status()).toBe(200);
    const movsAnulacion = (await movimientosAnulacion.json()) as {
      type: string;
      quantity: number;
    }[];
    const movAnulacion = movsAnulacion.find((m) => m.type === 'cancellation');
    expect(movAnulacion).toBeTruthy();
    expect(movAnulacion?.quantity).toBe(2);

    await ensureCashRegisterClosed(page);
  });
});
