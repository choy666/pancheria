import { test, expect } from '@playwright/test';
import {
  ensureLoggedIn,
  ensureCashRegisterOpen,
  ensureCashRegisterClosed,
  getCashRegister,
} from './helpers';

test.use({ viewport: { width: 375, height: 667 } });

const protectedRoutes = [
  '/',
  '/ventas',
  '/ventas/historial',
  '/productos',
  '/productos/nuevo',
  '/stock',
  '/cierre',
  '/cierre/historial',
];

test.describe('Responsividad en móvil', () => {
  test('login y panel se muestran sin scroll horizontal', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible();

    const noHScrollLogin = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    );
    expect(noHScrollLogin, 'scroll horizontal en /login').toBe(true);

    await ensureLoggedIn(page);
    await expect(page).toHaveURL('/');

    const noHScrollPanel = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    );
    expect(noHScrollPanel, 'scroll horizontal en /').toBe(true);
  });

  test('el menú hamburguesa se abre, navega y cierra', async ({ page }) => {
    await ensureLoggedIn(page);
    await page.goto('/');

    const menuButton = page.getByRole('button', { name: /abrir menú|cerrar menú/i });
    await expect(menuButton).toBeVisible();
    await expect(menuButton).toHaveAttribute('aria-expanded', 'false');

    await menuButton.click();
    await expect(menuButton).toHaveAttribute('aria-expanded', 'true');

    const mobileNav = page.locator('header > div + div nav');
    await expect(mobileNav.getByRole('link', { name: 'Ventas' })).toBeVisible();

    await mobileNav.getByRole('link', { name: 'Productos' }).click();
    await expect(page).toHaveURL('/productos');
    await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  });

  test('no hay scroll horizontal en las rutas protegidas principales', async ({ page }) => {
    await ensureLoggedIn(page);

    const viewports = [
      { width: 375, height: 667, name: 'móvil pequeño' },
      { width: 430, height: 932, name: 'móvil grande' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 1920, height: 1080, name: 'desktop' },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      for (const route of protectedRoutes) {
        await page.goto(route);
        await expect(page).toHaveURL(route);

        const hasHScroll = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth
        );
        expect(
          hasHScroll,
          `scroll horizontal en ${route} con viewport ${viewport.name} (${viewport.width}x${viewport.height})`
        ).toBe(false);
      }
    }
  });

  test('tablas y botones principales son visibles y clickeables', async ({ page }) => {
    await ensureLoggedIn(page);

    await page.goto('/productos');
    await expect(page.locator('table')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nueva promo' })).toBeVisible();

    await page.goto('/stock');
    await expect(page.locator('table')).toBeVisible();

    await page.goto('/ventas/historial');
    await expect(page.locator('table')).toBeVisible();

    await page.goto('/cierre/historial');
    await expect(page.locator('table')).toBeVisible();

    await page.goto('/ventas');
    await expect(
      page.getByRole('button', { name: /Abrir caja|Cerrar caja/ })
    ).toBeVisible();
  });

  test('formularios de productos se adaptan a 375px', async ({ page }) => {
    await ensureLoggedIn(page);

    await page.goto('/productos/nuevo?tab=product');
    await expect(page.getByRole('button', { name: 'Guardar' })).toBeVisible();

    const noHScrollForm = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    );
    expect(noHScrollForm, 'scroll horizontal en /productos/nuevo').toBe(true);

    const editLink = page.locator('table tbody a[href*="/productos/"]').first();
    await page.goto('/productos');
    await expect(editLink).toBeVisible();
    const href = await editLink.getAttribute('href');
    if (href) {
      await page.goto(href);
      await expect(page.getByRole('button', { name: /Guardar|Actualizar/ })).toBeVisible();
      const noHScrollEdit = await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
      );
      expect(noHScrollEdit, `scroll horizontal en ${href}`).toBe(true);
    }
  });

  test('rutas de detalle y papelera se adaptan a 375px', async ({ page }) => {
    await ensureLoggedIn(page);

    await ensureCashRegisterOpen(page);
    const caja = await getCashRegister(page);
    if (!caja || !caja.id) throw new Error('No hay caja abierta para el test');

    await ensureCashRegisterClosed(page);

    const detalleRoutes = [
      `/ventas/historial/${caja.id}`,
      `/cierre/${caja.id}`,
    ];

    for (const route of detalleRoutes) {
      await page.goto(route);
      await expect(page).toHaveURL(route);

      const hasHScroll = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(hasHScroll, `scroll horizontal detectado en ${route}`).toBe(false);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }

    await page.request.delete(`/api/caja/${caja.id}`);

    await page.goto('/ventas/historial/eliminadas');
    await expect(page).toHaveURL('/ventas/historial/eliminadas');

    const noHScrollTrash = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    );
    expect(noHScrollTrash, 'scroll horizontal en /ventas/historial/eliminadas').toBe(true);
  });
});
