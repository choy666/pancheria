import { test, expect, type Page } from '@playwright/test';
import { loginAsAdmin, loginAsOperator, ensureCashRegisterOpen } from './helpers';

async function findTourStorageKey(page: Page, suffix: string): Promise<string | null> {
  return page.evaluate((s) => {
    const prefix = `pancheria-tour-${s}`;
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith(prefix)) {
        return key;
      }
    }
    return null;
  }, suffix);
}

async function getTourStorageSuffix(page: Page): Promise<string> {
  const seenKey = await findTourStorageKey(page, 'seen');
  if (!seenKey) {
    throw new Error('No se encontró la clave pancheria-tour-seen en localStorage');
  }
  return seenKey.replace('pancheria-tour-seen', '');
}

async function getTourStorageValue(page: Page, suffix: string): Promise<string | null> {
  const key = await findTourStorageKey(page, suffix);
  if (!key) return null;
  return page.evaluate((k) => window.localStorage.getItem(k), key);
}

async function setTourStorageValue(page: Page, suffix: string, value: string) {
  const suffixTour = await getTourStorageSuffix(page);
  await page.evaluate(
    ({ k, v }) => window.localStorage.setItem(k, v),
    { k: `pancheria-tour-${suffix}${suffixTour}`, v: value }
  );
}

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
    await loginAsAdmin(page);
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

    const seen = await getTourStorageValue(page, 'seen');
    expect(seen).toBe('true');

    // Simula la reanudación en el paso final para probar el botón Finalizar.
    // El paso final del flujo admin es el índice 16.
    await setTourStorageValue(page, 'active', 'true');
    await setTourStorageValue(page, 'step', '16');

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
    await waitForTourStep(page, 'Panel de control');
    await clickTourNext(page); // 1 -> 2
    await waitForTourStep(page, 'Menú superior');
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
    await page.waitForURL('/sucursales');
    await waitForTourStep(page, 'Sucursales');

    await clickTourNext(page); // 12 -> 13
    await page.waitForURL('/usuarios');
    await waitForTourStep(page, 'Usuarios');

    await clickTourNext(page); // 13 -> 14
    await waitForTourStep(page, 'Selector de sucursal');

    await clickTourNext(page); // 14 -> 15
    await waitForTourStep(page, 'Fin del recorrido');

    const doneButton = page.locator(
      '.driver-popover-next-btn.driver-popover-done-btn'
    );
    await expect(doneButton).toHaveText('Finalizar');
    await doneButton.click();

    await expect(page.locator('.driver-popover')).toHaveCount(0);

    const tourActive = await getTourStorageValue(page, 'active');
    expect(tourActive).toBeNull();
  });
});

test.describe('Tour como operador', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOperator(page);
  });

  test('recorre las secciones permitidas y omite las de administrador', async ({
    page,
  }) => {
    await ensureCashRegisterOpen(page);

    await page.goto('/');

    // No se inicia automáticamente.
    await expect(page.locator('.driver-popover')).toHaveCount(0);

    // Inicia con el botón Guía.
    await page.getByRole('button', { name: 'Guía' }).click();
    await waitForTourStep(page, 'Bienvenido a Panchería');

    // El paso del panel describe solo las secciones permitidas.
    await clickTourNext(page); // 0 -> 1
    await waitForTourStep(page, 'Panel de control');
    await expect(page.locator('.driver-popover-description')).toContainText(
      'Ventas, Stock y Caja'
    );
    await expect(page.locator('.driver-popover-description')).toContainText(
      'No tenés acceso a Productos, Sucursales ni Usuarios'
    );

    // Avanzar hasta Ventas.
    await clickTourNext(page); // 1 -> 2
    await waitForTourStep(page, 'Menú superior');
    await clickTourNext(page); // 2 -> 3
    await waitForTourStep(page, 'Ventas');

    // Navega a /ventas.
    await clickTourNext(page); // 3 -> 4
    await page.waitForURL('/ventas');
    await waitForTourStep(page, 'Estado de la caja');

    await clickTourNext(page); // 4 -> 5
    await waitForTourStep(page, 'Productos disponibles');

    await clickTourNext(page); // 5 -> 6
    await waitForTourStep(page, 'Pedido actual');

    // El recorrido del operador va de Ventas directamente a Stock.
    await clickTourNext(page); // 6 -> 7
    await page.waitForURL('/stock');
    await waitForTourStep(page, 'Stock');

    await clickTourNext(page); // 7 -> 8
    await page.waitForURL('/cierre');
    await waitForTourStep(page, 'Cierre de caja');

    await clickTourNext(page); // 8 -> 9
    await page.waitForURL('/cierre/historial');
    await waitForTourStep(page, 'Historial de cierres');

    // El recorrido finaliza sin pasar por Productos, Sucursales ni Usuarios.
    await clickTourNext(page); // 9 -> 10
    await waitForTourStep(page, 'Fin del recorrido');

    const doneButton = page.locator(
      '.driver-popover-next-btn.driver-popover-done-btn'
    );
    await expect(doneButton).toHaveText('Finalizar');
    await doneButton.click();

    await expect(page.locator('.driver-popover')).toHaveCount(0);

    const tourActive = await getTourStorageValue(page, 'active');
    expect(tourActive).toBeNull();
  });
});

test.describe('Guía interactiva en móvil', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await ensureCashRegisterOpen(page);
  });

  test('inicia el tour desde el menú hamburguesa, cierra el menú y el popover es visible', async ({
    page,
  }) => {
    await page.goto('/');

    const menuButton = page.getByRole('button', {
      name: /abrir menú|cerrar menú/i,
    });
    await expect(menuButton).toHaveAttribute('aria-expanded', 'false');

    await menuButton.click();
    await expect(menuButton).toHaveAttribute('aria-expanded', 'true');

    const mobileNav = page.locator('[data-tour="mobile-nav"]');
    const guideButton = mobileNav.getByRole('button', { name: 'Guía' });
    await expect(guideButton).toBeVisible();
    await guideButton.click();

    await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    await waitForTourStep(page, 'Bienvenido a Panchería');

    const popover = page.locator('.driver-popover');
    await expect(popover).toBeVisible();

    const box = await popover.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(375);
    expect(box!.y + box!.height).toBeLessThanOrEqual(667);

    await clickTourNext(page);
    await expect(page.locator('.driver-popover-title')).toBeVisible();
  });

  test('reinicia el tour desde cualquier página en móvil y cierra el menú', async ({
    page,
  }) => {
    await page.goto('/productos');

    const menuButton = page.getByRole('button', {
      name: /abrir menú|cerrar menú/i,
    });
    await menuButton.click();

    const mobileNav = page.locator('[data-tour="mobile-nav"]');
    const guideButton = mobileNav.getByRole('button', { name: 'Guía' });
    await guideButton.click();

    await page.waitForURL('/');
    await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    await waitForTourStep(page, 'Bienvenido a Panchería');
  });
});
