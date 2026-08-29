import { test, expect } from '@playwright/test';
import {
  ensureCashRegisterClosed,
  ensureCashRegisterOpen,
  login,
} from './helpers';

test.describe('Historial de cajas con ventas', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await ensureCashRegisterClosed(page);
  });

  test('la caja cerrada aparece en el historial y muestra sus ventas', async ({
    page,
  }) => {
    await ensureCashRegisterOpen(page);

    const productsResponse = await page.request.get(
      '/api/productos?includeAvailability=true'
    );
    const products = (await productsResponse.json()) as {
      id: number;
      name: string;
      price: number;
      type: string;
    }[];
    const product = products.find(
      (p) => p.type === 'service' && p.price === 500
    );
    if (!product) throw new Error('No se encontró producto de prueba de $500');

    await page.goto('/ventas');

    const card = page.locator(
      `[data-testid="product-card"][data-product-name="${product.name}"]`
    );
    await expect(card).toBeVisible({ timeout: 10000 });
    await card.click();

    await page.getByTestId('payment-cash-full').click();
    await page.getByRole('button', { name: 'Confirmar venta' }).click();
    await expect(page.getByText('El carrito está vacío.')).toBeVisible({
      timeout: 10000,
    });

    const resumen = await page.request.get('/api/caja/resumen');
    const caja = (await resumen.json()) as { id: number; status: string };
    expect(caja.status).not.toBe('closed');

    await page.request.post('/api/caja/cerrar', { data: { id: caja.id } });

    await page.goto('/ventas/historial');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByTestId(`cash-register-total-${caja.id}`)
    ).toBeVisible({
      timeout: 10000,
    });

    await page.getByTestId(`cash-register-row-${caja.id}`).click();

    await expect(page.getByText('Ventas de la caja')).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.getByTestId('sale-products').filter({ hasText: product.name })
    ).toBeVisible({
      timeout: 10000,
    });

    await ensureCashRegisterClosed(page);
  });
});
