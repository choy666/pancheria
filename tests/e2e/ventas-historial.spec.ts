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

    await page.goto('/ventas');

    const card = page
      .locator('[data-slot="card"]')
      .filter({ hasText: 'Vaso de gaseosa' })
      .first();
    await expect(card).toBeVisible({ timeout: 10000 });
    await card.click();

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
    await expect(page.getByText('$500.00').first()).toBeVisible({
      timeout: 10000,
    });

    await page
      .getByRole('row')
      .filter({ hasText: '$500.00' })
      .first()
      .click();

    await expect(page.getByText('Ventas de la caja')).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText('Vaso de gaseosa x1')).toBeVisible({
      timeout: 10000,
    });

    await ensureCashRegisterClosed(page);
  });
});
