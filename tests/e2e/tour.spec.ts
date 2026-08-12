import { test, expect, type Page } from '@playwright/test';
import { login, ensureCashRegisterOpen } from './helpers';

async function waitForTourStep(page: Page, title: string) {
  await expect(page.locator('.driver-popover-title')).toBeVisible();
  await expect(page.locator('.driver-popover-title')).toContainText(title);
}

async function clickTourNext(page: Page) {
  await page.locator('.driver-popover-next-btn').click();
}

async function clickTourPrev(page: Page) {
  await page.locator('.driver-popover-prev-btn').click();
}

test.describe('Guía interactiva', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('se inicia manualmente, se cierra con la cruz y el botón Finalizar funciona', async ({
    page,
  }) => {
    await page.goto('/');

    // No se inicia automáticamente.
    await expect(page.locator('.driver-popover')).toHaveCount(0);

    // Inicia con el botón Guía.
    await page.getByRole('button', { name: 'Guía' }).click();
    await expect(page.locator('.driver-popover-title')).toBeVisible();
    await expect(page.locator('.driver-popover-title')).toContainText(
      'Bienvenido a Panchería'
    );

    // Cierra con la cruz.
    await page.locator('.driver-popover-close-btn').click();
    await expect(page.locator('.driver-popover')).toHaveCount(0);

    const seen = await page.evaluate(() =>
      window.localStorage.getItem('pancheria-tour-seen')
    );
    expect(seen).toBe('true');

    // Simula la reanudación en el paso final para probar el botón Finalizar.
    await page.evaluate(() => {
      window.localStorage.setItem('pancheria-tour-active', 'true');
      window.localStorage.setItem('pancheria-tour-step', '12');
    });

    await page.goto('/cierre/historial');
    await expect(page.locator('.driver-popover-title')).toBeVisible();
    await expect(page.locator('.driver-popover-title')).toContainText(
      'Fin del recorrido'
    );

    const doneButton = page.locator(
      '.driver-popover-next-btn.driver-popover-done-btn'
    );
    await expect(doneButton).toHaveText('Finalizar');
    await doneButton.click();

    await expect(page.locator('.driver-popover')).toHaveCount(0);
  });

  test('reinicia desde cualquier página, navega y avanza por todo el recorrido', async ({
    page,
  }) => {
    await ensureCashRegisterOpen(page);

    // Iniciar desde /productos y verificar que vuelve al inicio.
    await page.goto('/productos');
    await page.getByRole('button', { name: 'Guía' }).click();

    await page.waitForURL('/');
    await waitForTourStep(page, 'Bienvenido a Panchería');

    // Avanzar hasta el paso "Ventas".
    await clickTourNext(page); // 0 -> 1
    await clickTourNext(page); // 1 -> 2
    await clickTourNext(page); // 2 -> 3
    await waitForTourStep(page, 'Ventas');

    // Avanzar al siguiente paso navega a /ventas.
    await clickTourNext(page); // 3 -> 4
    await page.waitForURL('/ventas');
    await waitForTourStep(page, 'Estado de la caja');

    // Retroceder vuelve a / en el paso "Ventas".
    await clickTourPrev(page); // 4 -> 3
    await page.waitForURL('/');
    await waitForTourStep(page, 'Ventas');

    // Continuar y completar el recorrido.
    await clickTourNext(page); // 3 -> 4
    await page.waitForURL('/ventas');
    await waitForTourStep(page, 'Estado de la caja');

    await clickTourNext(page); // 4 -> 5
    await waitForTourStep(page, 'Productos disponibles');

    await clickTourNext(page); // 5 -> 6
    await waitForTourStep(page, 'Pedido actual');

    await clickTourNext(page); // 6 -> 7
    await page.waitForURL('/productos');
    await waitForTourStep(page, 'Productos y promos');

    await clickTourNext(page); // 7 -> 8
    await waitForTourStep(page, 'Nuevos productos');

    await clickTourNext(page); // 8 -> 9
    await page.waitForURL('/stock');
    await waitForTourStep(page, 'Stock');

    await clickTourNext(page); // 9 -> 10
    await page.waitForURL('/cierre');
    await waitForTourStep(page, 'Cierre de caja');

    await clickTourNext(page); // 10 -> 11
    await page.waitForURL('/cierre/historial');
    await waitForTourStep(page, 'Historial de cierres');

    await clickTourNext(page); // 11 -> 12
    await waitForTourStep(page, 'Fin del recorrido');

    const doneButton = page.locator(
      '.driver-popover-next-btn.driver-popover-done-btn'
    );
    await expect(doneButton).toHaveText('Finalizar');
    await doneButton.click();

    await expect(page.locator('.driver-popover')).toHaveCount(0);

    const tourActive = await page.evaluate(() =>
      window.localStorage.getItem('pancheria-tour-active')
    );
    expect(tourActive).toBeNull();
  });
});
