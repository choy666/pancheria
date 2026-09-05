import { test, expect } from '@playwright/test';
import {
  login,
  ensureCashRegisterClosed,
  ensureCashRegisterOpen,
  unique,
  createProductViaApi,
  restockProductViaApi,
} from './helpers';

test.describe('Pago mixto en el terminal de ventas', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await ensureCashRegisterClosed(page);
  });

  test('permite pagar una venta con efectivo y transferencia y refleja los totales en la caja', async ({
    page,
  }) => {
    await ensureCashRegisterOpen(page);

    const bebida = await createProductViaApi(page, {
      name: unique('Bebida mixto'),
      type: 'critical_supply',
      criticalSupplyType: 'beverage',
      price: 1500,
      unit: 'unidad',
      minStock: 0,
      isActive: true,
    });

    await restockProductViaApi(page, bebida.id, 2);

    await page.goto('/ventas');

    const card = page.locator(
      '[data-testid="product-card"][data-product-name="' + bebida.name + '"]'
    );

    await expect(card.getByText('Disponible: 2 unidad')).toBeVisible({
      timeout: 10000,
    });

    await card.click();

    const cartItem = page.locator(
      '[data-testid="cart-item"][data-product-name="' + bebida.name + '"]'
    );
    await expect(
      cartItem.getByText('1', { exact: true })
    ).toBeVisible({ timeout: 10000 });

    // Ingresar pago en efectivo.
    await page.getByTestId('payment-cash-input').fill('1000');
    // Ingresar pago con transferencia.
    await page.getByTestId('payment-transfer-input').fill('500');

    await expect(page.getByTestId('payment-remaining-badge')).toHaveText(
      'Pago completo',
      { timeout: 5000 }
    );
    await expect(
      page.getByRole('button', { name: 'Confirmar venta' })
    ).toBeEnabled({ timeout: 5000 });

    await page.getByRole('button', { name: 'Confirmar venta' }).click();

    await expect(page.getByText('El carrito está vacío.')).toBeVisible({
      timeout: 10000,
    });

    // Verificar caja.
    await page.goto('/cierre');
    await expect(page.getByTestId('cash-register-total')).toHaveText(
      'Total: $ 1.500',
      { timeout: 10000 }
    );
    await expect(page.getByText('Efectivo en ventas: $ 1.000')).toBeVisible();
    await expect(page.getByText('Transferencia: $ 500')).toBeVisible();
    await expect(page.getByText('Ventas: 1')).toBeVisible();

    await expect(
      page.locator('[data-testid="cash-register-product-item"]').filter({
        hasText: bebida.name,
      })
    ).toHaveCount(1, { timeout: 5000 });

    await ensureCashRegisterClosed(page);
  });
});
