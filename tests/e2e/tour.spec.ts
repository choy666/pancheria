import { test, expect } from '@playwright/test';
import { login } from './helpers';

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
});
