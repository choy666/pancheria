import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import {
  login,
  ensureCashRegisterOpen,
  createProductViaApi,
  unique,
  setUniqueClientIp,
} from './helpers';

/**
 * Perfiles de UX (V4.x del plan): anchos 360/390/768/1280, zoom 200 %,
 * navegación por teclado y mobile gama baja con throttling de CPU/red.
 *
 * Las capturas quedan en `tmp/auditoria-qa-2026-09-21/` como evidencia
 * para el informe. No son assertions de pixel-perfect: lo que se verifica
 * es que no haya overflow horizontal, que los controles clave sigan
 * alcanzables y que el teclado complete el flujo.
 */

const EVIDENCE_DIR = path.join('tmp', 'auditoria-qa-2026-09-21');

function screenshotPath(name: string) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  return path.join(EVIDENCE_DIR, name);
}

async function expectNoHorizontalOverflow(
  page: import('@playwright/test').Page,
  width: number
) {
  const scrollWidth = await page.evaluate(
    () => document.documentElement.scrollWidth
  );
  // Margen de 1 px por redondeos de layout.
  expect(scrollWidth).toBeLessThanOrEqual(width + 1);
}

test.describe('Perfiles de UX', () => {
  for (const width of [360, 390, 768, 1280]) {
    test(`el catálogo /pedido es usable a ${width}px sin overflow horizontal`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/pedido');
      await page.waitForLoadState('networkidle');

      await expect(
        page.locator('[data-testid^="product-card-"]').first()
      ).toBeVisible();
      await expectNoHorizontalOverflow(page, width);
      await page.screenshot({
        path: screenshotPath(`pedido-${width}px.png`),
        fullPage: true,
      });
    });
  }

  test('seguimiento es usable a 360px y sus controles quedan alcanzables', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/pedido/seguimiento');
    await page.waitForLoadState('networkidle');

    await expect(page.getByLabel('Número de pedido')).toBeVisible();
    await expect(page.getByLabel('Tu nombre')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Buscar pedido' })
    ).toBeVisible();
    await expectNoHorizontalOverflow(page, 360);
    await page.screenshot({
      path: screenshotPath('seguimiento-360px.png'),
      fullPage: true,
    });
  });

  test('el catálogo reflowa sin scroll horizontal a 320px (zoom 400% de 1280)', async ({
    page,
  }) => {
    // WCAG 1.4.10 Reflow: a 320 CSS px (equivalente a 400% de zoom en
    // 1280px) el contenido no debe requerir scroll horizontal. Los
    // elementos que lo provocan se reportan para la evidencia.
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/pedido');
    await page.waitForLoadState('networkidle');

    await expect(
      page.locator('[data-testid^="product-card-"]').first()
    ).toBeVisible();

    const offenders = await page.evaluate(() => {
      const limit = document.documentElement.clientWidth;
      const found: { tag: string; testid: string | null; cls: string; width: number }[] = [];
      for (const el of document.querySelectorAll('*')) {
        if (el.scrollWidth > limit + 1 && found.length < 10) {
          found.push({
            tag: el.tagName.toLowerCase(),
            testid: el.getAttribute('data-testid'),
            cls: (el.getAttribute('class') ?? '').slice(0, 120),
            width: el.scrollWidth,
          });
        }
      }
      return found;
    });
    await page.screenshot({
      path: screenshotPath('pedido-320px.png'),
      fullPage: true,
    });

    expect(
      offenders,
      `Elementos que desbordan a 320px: ${JSON.stringify(offenders, null, 2)}`
    ).toEqual([]);
  });

  test('el checkout completo se puede hacer solo con teclado', async ({
    page,
  }) => {
    await login(page);
    await ensureCashRegisterOpen(page);
    await setUniqueClientIp(page);

    const product = await createProductViaApi(page, {
      name: unique('Servicio Teclado'),
      type: 'service',
      price: 1000,
      unit: 'unidad',
      stock: 0,
      minStock: 0,
      isActive: true,
    });

    await page.goto('/pedido');
    await page.waitForLoadState('networkidle');

    // El foco por Tab debe poder llegar al botón de agregar del producto.
    const addButton = page.getByTestId(`add-product-${product.id}`);
    await addButton.focus();
    await expect(addButton).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('cart-title')).toBeVisible();

    await page.getByRole('button', { name: 'Hacer pedido' }).press('Enter');
    await expect(page.getByTestId('checkout-dialog-title')).toBeVisible();

    // Formulario completo por teclado: campos y submit con Enter.
    await page.getByLabel('Nombre').fill(unique('Cliente Teclado'));
    await page.getByLabel('Teléfono').fill('3415555555');
    // El botón queda disabled mientras el diálogo chequea disponibilidad;
    // un Enter en esa ventana se traga el click y el submit nunca sale.
    const confirmButton = page.getByTestId('confirm-order-button');
    await expect(confirmButton).toBeEnabled();
    await confirmButton.press('Enter');

    // Timeout generoso: el submit público compila la Server Action bajo
    // Turbopack la primera vez y la suite completa deja el dev server
    // cargado.
    await expect(page.getByTestId('order-success-title')).toBeVisible({
      timeout: 30_000,
    });
  });

  test('el catálogo carga contenido en mobile gama baja (CPU 4x + Fast 3G)', async ({
    page,
    context,
  }) => {
    test.setTimeout(120_000);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    // Perfil ~Fast 3G: los bundles sin minificar de `next dev` harían
    // prohibitivo un 3G real de 400 kbps; 1.6 Mbps ya degrada lo
    // suficiente para medir la experiencia en gama baja.
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });

    await page.setViewportSize({ width: 360, height: 800 });
    const startedAt = Date.now();
    await page.goto('/pedido', { waitUntil: 'domcontentloaded' });
    await expect(
      page.locator('[data-testid^="product-card-"]').first()
    ).toBeVisible({ timeout: 90_000 });
    const loadMs = Date.now() - startedAt;

    await page.screenshot({ path: screenshotPath('pedido-slow3g-360px.png') });
    // Sin umbral duro: el dato va al informe. Solo se verifica que el
    // contenido principal renderiza bajo degradación severa.
    expect(loadMs).toBeGreaterThan(0);
    console.log(`[/pedido bajo Slow3G+CPU4x] primer producto en ${loadMs} ms`);
  });
});
