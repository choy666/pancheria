import { test, expect } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db';
import { branches, menuSettings, products } from '../../src/db/schema';
import {
  createPromoWithRecipeViaApi,
  getDefaultBranchId,
  getTestSecondBranch,
  login,
  unique,
} from './helpers';

/**
 * Suite del menú digital `/menu` (route group `(kiosk)`): la carta completa
 * en grilla paginada por categorías con el QR de pedidos persistente.
 *
 * Notas de entorno: la página consulta `/api/public/menu`, que comparte los
 * headers de caché del catálogo público; en E2E `DATA_CACHE_REVALIDATE_S=0`
 * ya deshabilita la capa de caché de servidor.
 */
test.describe('Menú digital (/menu)', () => {
  test('sin branchId redirige a la URL canónica de la sucursal por defecto', async ({
    page,
  }) => {
    const branchId = await getDefaultBranchId();
    await page.goto('/menu');
    await expect(page).toHaveURL(`/menu?branchId=${branchId}`);
    await expect(page.getByTestId('menu-screen')).toBeVisible();
  });

  test('con branchId inválido redirige a /menu y resuelve la default', async ({
    page,
  }) => {
    const branchId = await getDefaultBranchId();
    await page.goto('/menu?branchId=no-es-un-numero');
    // Doble redirect: /menu?branchId=invalido → /menu → ?branchId=default
    await expect(page).toHaveURL(`/menu?branchId=${branchId}`);
  });

  test('una sucursal inexistente muestra el estado de error', async ({
    page,
  }) => {
    const rows = await db.select({ id: branches.id }).from(branches);
    const missingId = Math.max(...rows.map((row) => row.id)) + 100_000;
    await page.goto(`/menu?branchId=${missingId}`);
    await expect(page.getByTestId('pantalla-error')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Volver a intentar' })
    ).toBeVisible();
  });

  test('GET /api/public/menu devuelve el snapshot sin videos ni playlist', async ({
    page,
  }) => {
    const branchId = await getDefaultBranchId();

    const response = await page.request.get(
      `/api/public/menu?branchId=${branchId}`
    );
    expect(response.status()).toBe(200);
    const snapshot = (await response.json()) as {
      branch: { id: number };
      isOpen: boolean;
      products: unknown[];
      videos?: unknown;
      items?: unknown;
    };
    expect(snapshot.branch.id).toBe(branchId);
    expect(Array.isArray(snapshot.products)).toBe(true);
    expect(typeof snapshot.isOpen).toBe('boolean');
    // El menú muestra la carta completa: el snapshot no transporta la
    // playlist de videos ni los ítems de /pantalla.
    expect(snapshot.videos).toBeUndefined();
    expect(snapshot.items).toBeUndefined();

    // Sin branchId resuelve la sucursal por defecto.
    const fallback = await page.request.get('/api/public/menu');
    expect(fallback.status()).toBe(200);
    expect(
      ((await fallback.json()) as { branch: { id: number } }).branch.id
    ).toBe(branchId);

    // branchId inválido → 400 de validación Zod.
    const invalid = await page.request.get(
      '/api/public/menu?branchId=no-es-un-numero'
    );
    expect(invalid.status()).toBe(400);
  });

  test('muestra el producto en su categoría con el QR persistente', async ({
    page,
  }) => {
    await login(page);
    const branchId = await getDefaultBranchId();
    // El nombre con dígito inicial ordena primero dentro del grupo
    // `compound`, que encabeza el agrupamiento público.
    const { promo } = await createPromoWithRecipeViaApi(page, {
      baseName: '0 Menu promo',
      price: 4321,
    });

    await page.goto(`/menu?branchId=${branchId}`);

    const card = page.locator(
      `[data-testid="menu-card"][data-product-id="${promo.id}"]`
    );
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card).toContainText('0 Menu promo');
    await expect(card).toContainText('$');

    // El grupo del promo aparece con su cabezal de categoría.
    await expect(
      page.locator('[data-testid="menu-group"][data-product-type="compound"]')
    ).toBeVisible();

    // El QR de pedidos es persistente (no espera al final de un ciclo).
    await expect(page.getByTestId('menu-qr-strip')).toBeVisible();
    await expect(page.getByTestId('menu-qr-url')).toContainText(
      `/pedido?branchId=${branchId}`
    );

    // Chrome compartido con /pantalla: nombre de sucursal, estado y reloj.
    await expect(page.getByTestId('pantalla-status')).toBeVisible();
    await expect(page.getByTestId('pantalla-clock')).toBeVisible();
  });

  test('aplica la configuración de la sucursal: producto oculto y franja QR apagada', async ({
    page,
  }) => {
    await login(page);
    const branchId = await getDefaultBranchId();
    const { promo } = await createPromoWithRecipeViaApi(page, {
      baseName: 'Menu oculto',
    });

    // Fila `menu_settings` como si se hubiera guardado desde el panel.
    await db.insert(menuSettings).values({
      branchId,
      showQrStrip: false,
      hiddenProductIds: [promo.id],
    });

    try {
      await page.goto(`/menu?branchId=${branchId}`);
      await expect(page.getByTestId('menu-screen')).toBeVisible();

      // La promo oculta no llega a la grilla aunque tenga stock.
      await expect(
        page.locator(
          `[data-testid="menu-card"][data-product-id="${promo.id}"]`
        )
      ).not.toBeAttached();

      // La franja QR se apaga desde el panel.
      await expect(page.getByTestId('menu-qr-strip')).not.toBeAttached();
    } finally {
      await db
        .delete(menuSettings)
        .where(eq(menuSettings.branchId, branchId));
    }
  });

  test('el enlace de la navbar apunta a la sucursal activa y sigue al selector', async ({
    page,
  }) => {
    await login(page);
    const defaultId = await getDefaultBranchId();
    const second = await getTestSecondBranch();

    await page.goto('/');

    const link = page.getByTestId('menu-link');
    await expect(link).toHaveAttribute('href', `/menu?branchId=${defaultId}`);
    await expect(link).toHaveAttribute('target', '_blank');
    expect(await link.getAttribute('rel')).toContain('noopener');

    // Mismo mecanismo que el enlace de /pantalla: sigue al selector de
    // sucursal del panel (reload tras setActiveBranchAction).
    await page.getByTestId('branch-selector-trigger').click();
    const escapedName = second.branchName.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    );
    await page
      .getByTestId('branch-option')
      .filter({ hasText: new RegExp(`^${escapedName}( \\(inactiva\\))?$`) })
      .click();

    await expect(link).toHaveAttribute(
      'href',
      `/menu?branchId=${second.branchId}`
    );
  });

  test('muestra la descripción, marca el destacado y usa el CTA configurado', async ({
    page,
  }) => {
    await login(page);
    const branchId = await getDefaultBranchId();
    const { promo } = await createPromoWithRecipeViaApi(page, {
      baseName: 'Menu promo desc',
    });
    // La descripción es la data que más falta en las promos del tablero.
    await db
      .update(products)
      .set({ description: 'Con papas y gaseosa incluida' })
      .where(eq(products.id, promo.id));

    // Fila `menu_settings` como si se hubiera guardado desde el panel.
    await db.insert(menuSettings).values({
      branchId,
      featuredProductIds: [promo.id],
      qrStripText: 'Mirá el menú acá',
    });

    try {
      await page.goto(`/menu?branchId=${branchId}`);

      const card = page.locator(
        `[data-testid="menu-card"][data-product-id="${promo.id}"]`
      );
      await expect(card).toBeVisible({ timeout: 20_000 });
      await expect(card).toContainText('Con papas y gaseosa incluida');
      await expect(
        card.getByTestId('menu-card-featured')
      ).toContainText('Recomendado');

      // El CTA de la franja QR viene de la configuración de la sucursal.
      await expect(page.getByTestId('menu-qr-strip')).toContainText(
        'Mirá el menú acá'
      );
    } finally {
      await db
        .delete(menuSettings)
        .where(eq(menuSettings.branchId, branchId));
    }
  });

  test('una sucursal sin catálogo muestra el estado vacío con el QR', async ({
    page,
  }) => {
    // Sucursal nueva sin catálogo copiado: el board muestra el estado vacío
    // pero la franja de conversión con el QR sigue visible.
    const [branch] = await db
      .insert(branches)
      .values({ name: unique('Menú vacío') })
      .returning();

    try {
      await page.goto(`/menu?branchId=${branch.id}`);

      await expect(page.getByTestId('menu-empty')).toBeVisible({
        timeout: 20_000,
      });
      // Sin caja abierta ni horarios: la sucursal figura cerrada, con la
      // aclaración de que la carta sigue disponible.
      await expect(page.getByTestId('pantalla-status')).toContainText(
        'Cerrado'
      );
      await expect(page.getByTestId('pantalla-closed-hint')).toContainText(
        'pedir desde el QR'
      );
      await expect(page.getByTestId('menu-qr-url')).toContainText(
        `/pedido?branchId=${branch.id}`
      );
    } finally {
      await db.delete(branches).where(eq(branches.id, branch.id));
    }
  });
});
