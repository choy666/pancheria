import { test, expect } from '@playwright/test';
import { ensureCashRegisterOpen, login } from './helpers';

test.describe('Paso 4 - Flujos avanzados', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('anula una venta y verifica reintegro de stock', async ({ page }) => {
    await ensureCashRegisterOpen(page);

    const productsResponse = await page.request.get('/api/productos');
    const products = (await productsResponse.json()) as {
      id: number;
      name: string;
      type: string;
      price: number;
    }[];
    const product = products.find(
      (p) => p.type === 'compound' && p.price === 1000
    );
    if (!product) throw new Error('Producto no encontrado');

    const saleResponse = await page.request.post('/api/ventas', {
      data: {
        items: [{ productId: product.id, quantity: 1 }],
        paymentMethod: 'cash',
        idempotencyKey: `test-${Date.now()}`,
      },
    });
    expect(saleResponse.status()).toBe(201);
    const sale = await saleResponse.json() as { id: number; cashRegisterId: number | null };

    if (!sale.cashRegisterId) {
      throw new Error('La venta no tiene caja asignada.');
    }

    await page.goto(`/ventas/historial/${sale.cashRegisterId}`);
    await page.getByTestId(`anular-sale-${sale.id}`).click();
    await page.getByLabel('Motivo').fill('Error de carga');
    await page.getByRole('button', { name: 'Confirmar anulación' }).click();

    await expect(page.getByTestId(`row-sale-${sale.id}`).getByText('Anulada')).toBeVisible({ timeout: 10000 });
  });

  test('muestra historial de stock tras un ajuste', async ({ page }) => {
    const productsResponse = await page.request.get(
      '/api/productos?includeAvailability=false'
    );
    const products = (await productsResponse.json()) as {
      id: number;
      name: string;
      type: string;
      criticalSupplyType: string | null;
    }[];
    const pan = products.find(
      (p) => p.type === 'critical_supply' && p.criticalSupplyType === 'bread'
    );
    if (!pan) throw new Error('No se encontró el insumo Pan');

    await page.goto('/stock');
    await page.getByTestId(`adjust-stock-${pan.id}`).click();
    await page.getByLabel(/Cantidad/).fill('5');
    await page.getByLabel('Motivo').fill('Ajuste de prueba historial');
    await page.getByRole('button', { name: 'Guardar ajuste' }).click();
    await expect(page).toHaveURL('/stock', { timeout: 10000 });

    await page.goto('/stock');
    await page.getByTestId(`stock-history-${pan.id}`).click();
    await expect(
      page
        .getByTestId('stock-movement-reason')
        .filter({ hasText: 'Ajuste de prueba historial' })
    ).toBeVisible();
  });

  test('elimina un producto y desaparece del listado', async ({ page }) => {
    await page.goto('/productos/nuevo');
    const name = `Producto a eliminar ${Date.now()}`;
    await page.getByLabel('Nombre').fill(name);
    await page.getByLabel('Stock mínimo').fill('5');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page).toHaveURL('/productos', { timeout: 10000 });

    const row = page.getByRole('row', { name: new RegExp(name) });
    await expect(row).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await row.getByRole('button', { name: 'Eliminar' }).click();

    await expect(page.getByRole('row', { name: new RegExp(name) })).toHaveCount(0, { timeout: 10000 });
  });
});
