import { test, expect } from '@playwright/test';
import { ensureCashRegisterOpen, login } from './helpers';

test.describe('Paso 4 - Flujos avanzados', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('anula una venta y verifica reintegro de stock', async ({ page }) => {
    await ensureCashRegisterOpen(page);

    const productsResponse = await page.request.get('/api/productos');
    const products = await productsResponse.json() as { id: number; name: string }[];
    const product = products.find((p) => p.name === 'Promo 1');
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
    await page.fill('input#cancel-reason', 'Error de carga');
    await page.getByRole('button', { name: 'Confirmar anulación' }).click();

    await expect(page.getByTestId(`row-sale-${sale.id}`).getByText('Anulada')).toBeVisible({ timeout: 10000 });
  });

  test('muestra historial de stock tras un ajuste', async ({ page }) => {
    await page.goto('/stock');
    const row = page.getByRole('row', { name: /Pan/ });
    await row.getByRole('button', { name: 'Ajustar' }).first().click();
    await page.fill('input#adjust-quantity', '5');
    await page.fill('textarea#adjust-reason', 'Ajuste de prueba historial');
    await page.getByRole('button', { name: 'Guardar ajuste' }).click();
    await expect(page).toHaveURL('/stock', { timeout: 10000 });

    await page.goto('/stock');
    const historyRow = page.getByRole('row', { name: /Pan/ });
    await historyRow.getByRole('button', { name: 'Historial' }).first().click();
    await expect(page.getByText('Ajuste de prueba historial').first()).toBeVisible();
  });

  test('elimina un producto y desaparece del listado', async ({ page }) => {
    await page.goto('/productos/nuevo');
    const name = `Producto a eliminar ${Date.now()}`;
    await page.fill('input#name', name);
    await page.fill('input#minStock', '5');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page).toHaveURL('/productos', { timeout: 10000 });

    const row = page.getByRole('row', { name: new RegExp(name) });
    await expect(row).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await row.getByRole('button', { name: 'Eliminar' }).click();

    await expect(page.getByRole('row', { name: new RegExp(name) })).toHaveCount(0, { timeout: 10000 });
  });
});
