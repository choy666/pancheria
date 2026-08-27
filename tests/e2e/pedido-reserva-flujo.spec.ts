import { test, expect } from '@playwright/test';
import { login, unique, createProductViaApi, restockProductViaApi, ensureCashRegisterOpen } from './helpers';

test.describe('Flujo completo de reserva, pago y finalización', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await ensureCashRegisterOpen(page);
  });

  test('recibe, confirma pago y finaliza un pedido sin doble descuento', async ({
    page,
  }) => {
    const product = await createProductViaApi(page, {
      name: unique('Bebida reserva'),
      type: 'critical_supply',
      criticalSupplyType: 'beverage',
      price: 1000,
      unit: 'unidad',
      isActive: true,
    });
    await restockProductViaApi(page, product.id, 5);

    await page.goto('/pedido');
    await expect(
      page.getByTestId(`product-card-${product.id}`).getByText('Disponible: 5 unidades')
    ).toBeVisible();

    await page.getByTestId(`add-product-${product.id}`).click();
    await page.getByRole('button', { name: 'Hacer pedido' }).click();

    const customerName = unique('Cliente reserva');
    const customerPhone = '3415555555';
    await page.getByLabel('Nombre').fill(customerName);
    await page.getByLabel('Teléfono').fill(customerPhone);
    await page.getByRole('button', { name: 'Confirmar pedido' }).click();

    await expect(page.getByText(/se creó correctamente/)).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar' }).click();

    // El stock físico sigue en 5 porque el pedido aún no fue recibido.
    await page.goto('/pedido');
    await expect(
      page.getByTestId(`product-card-${product.id}`).getByText('Disponible: 5 unidades')
    ).toBeVisible();

    // Recibir y reservar desde el panel.
    await page.goto('/pedidos');
    const row = page
      .locator('[data-testid^="row-order-"]')
      .filter({ hasText: customerName });
    await row.getByRole('link', { name: 'Ver' }).click();

    await page.getByRole('button', { name: 'Recibir y reservar' }).click();
    await expect(page.getByText('En proceso')).toBeVisible({ timeout: 10000 });

    // La reserva reduce la disponibilidad pública en 1 unidad.
    await page.goto('/pedido');
    await expect(
      page.getByTestId(`product-card-${product.id}`).getByText('Disponible: 4 unidades')
    ).toBeVisible();

    // Confirmar el pago: no debe volver a descontar stock.
    await page.goto('/pedidos');
    await page
      .locator('[data-testid^="row-order-"]')
      .filter({ hasText: customerName })
      .getByRole('link', { name: 'Ver' })
      .click();

    await page.getByLabel('Medio de pago').click();
    await page.getByRole('option', { name: 'Efectivo' }).click();
    await page.getByRole('button', { name: 'Confirmar pago' }).click();

    await expect(page.getByText('Pagado')).toBeVisible({ timeout: 10000 });

    // El stock físico ahora es 4 porque el pago descuenta la reserva.
    await page.goto('/pedido');
    await expect(
      page.getByTestId(`product-card-${product.id}`).getByText('Disponible: 4 unidades')
    ).toBeVisible();

    // Finalizar el pedido.
    await page.goto('/pedidos');
    await page
      .locator('[data-testid^="row-order-"]')
      .filter({ hasText: customerName })
      .getByRole('link', { name: 'Ver' })
      .click();

    await page.getByRole('button', { name: 'Finalizar pedido' }).click();
    await expect(page.getByText('Finalizado')).toBeVisible({ timeout: 10000 });
  });
});
