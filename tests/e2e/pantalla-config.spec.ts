import { test, expect } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db';
import {
  branches,
  products,
  stockMovements,
  videos,
} from '../../src/db/schema';
import {
  createPromoWithRecipeViaApi,
  getDefaultBranchId,
  login,
  loginAsOperator,
  unique,
  waitForHydratedInput,
} from './helpers';

/**
 * Suite del configurador `/pantalla-config` (panel admin) y su efecto sobre
 * la pantalla pública `/pantalla`.
 *
 * Los tests usan una sucursal ad-hoc y la cookie `activeBranchId` (la misma
 * que setea `setActiveBranchAction`) para no tocar la configuración de la
 * sucursal por defecto, de la que dependen los specs de `pantalla.spec.ts`.
 */
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

type PantallaSnapshotJson = {
  settings: {
    playlistMode: 'auto' | 'custom';
    productoMs: number;
    showBranchScene: boolean;
    showQrScene: boolean;
  };
  items: { kind: 'product' | 'video'; refId: number }[];
};

async function createIsolatedBranch() {
  const [branch] = await db
    .insert(branches)
    .values({ name: unique('Pantalla cfg') })
    .returning();
  return branch;
}

/** Misma cookie que `setActiveBranchAction`: dirige el panel a la sucursal. */
async function activateBranch(page: import('@playwright/test').Page, branchId: number) {
  await page.context().addCookies([
    {
      name: 'activeBranchId',
      value: String(branchId),
      url: BASE_URL,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}

async function fetchSnapshot(
  page: import('@playwright/test').Page,
  branchId: number
): Promise<PantallaSnapshotJson> {
  const response = await page.request.get(
    `/api/public/pantalla?branchId=${branchId}`
  );
  expect(response.status()).toBe(200);
  return (await response.json()) as PantallaSnapshotJson;
}

/**
 * Borra la sucursal ad-hoc y todo lo que la referencia con `restrict`
 * (los productos creados vía API tienen stock_movements y recipes; las
 * tablas de pantalla caen por cascade junto con los productos/sucursal).
 */
async function deleteIsolatedBranch(branchId: number) {
  await db
    .delete(stockMovements)
    .where(eq(stockMovements.branchId, branchId));
  await db.delete(products).where(eq(products.branchId, branchId));
  await db.delete(videos).where(eq(videos.branchId, branchId));
  await db.delete(branches).where(eq(branches.id, branchId));
}

test.describe('Configuración de la pantalla (/pantalla-config)', () => {
  test('el admin llega desde la navbar y ve ambos formularios', async ({
    page,
  }) => {
    await login(page);
    await page.goto('/');

    const nav = page.getByTestId('main-nav');
    await nav.getByTestId('nav-more-trigger').click();
    const link = page
      .getByTestId('nav-more-menu')
      .getByRole('menuitem', { name: 'Pantallas', exact: true });
    await expect(link).toHaveAttribute('href', '/pantalla-config');

    await link.click();
    await expect(page).toHaveURL('/pantalla-config');
    await expect(
      page.getByRole('heading', { name: 'Pantallas' })
    ).toBeVisible();
    // La página separa las dos TVs en secciones rotuladas.
    await expect(
      page.getByRole('heading', { name: /Carrusel publicitario/ })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /Menú digital/ })
    ).toBeVisible();
    await expect(page.getByTestId('pantalla-settings-form')).toBeVisible();
    await expect(page.getByTestId('pantalla-playlist-form')).toBeVisible();
    // La misma página configura el menú digital de la sucursal.
    await expect(page.getByTestId('menu-settings-form')).toBeVisible();
    // Atajos a ambas TVs pineadas a la sucursal activa.
    await expect(page.getByTestId('pantalla-open-live')).toBeVisible();
    await expect(page.getByTestId('menu-open-live')).toBeVisible();
  });

  test('guarda la configuración del menú y el snapshot la refleja', async ({
    page,
  }) => {
    const branch = await createIsolatedBranch();
    try {
      await login(page);
      await activateBranch(page, branch.id);
      const { promo } = await createPromoWithRecipeViaApi(page, {
        baseName: 'Cfg menu promo',
      });

      await page.goto('/pantalla-config');
      await waitForHydratedInput(
        page,
        '[data-testid="menu-pagina-segundos"]'
      );

      await page.getByTestId('menu-pagina-segundos').fill('8');
      await page.getByTestId('menu-filas-pagina').fill('3');
      await page.getByTestId('menu-show-qr').uncheck();
      await page.getByTestId(`menu-hide-product-${promo.id}`).check();
      await page.getByTestId('menu-settings-save').click();
      await expect(
        page.getByTestId('menu-settings-success')
      ).toBeVisible();

      const response = await page.request.get(
        `/api/public/menu?branchId=${branch.id}`
      );
      expect(response.status()).toBe(200);
      const snapshot = (await response.json()) as {
        settings: {
          paginaMs: number;
          filasPagina: number;
          showQrStrip: boolean;
          hiddenProductIds: number[];
        };
      };
      expect(snapshot.settings.paginaMs).toBe(8000);
      expect(snapshot.settings.filasPagina).toBe(3);
      expect(snapshot.settings.showQrStrip).toBe(false);
      expect(snapshot.settings.hiddenProductIds).toContain(promo.id);
    } finally {
      await deleteIsolatedBranch(branch.id);
    }
  });

  test('un operador es redirigido fuera de la configuración', async ({
    page,
  }) => {
    await loginAsOperator(page);
    await page.goto('/pantalla-config');
    await expect(page).toHaveURL('/');
    await expect(
      page.getByTestId('pantalla-settings-form')
    ).not.toBeAttached();
  });

  test('guarda duraciones y escenas fijas y el snapshot las refleja', async ({
    page,
  }) => {
    const branch = await createIsolatedBranch();
    try {
      await login(page);
      await activateBranch(page, branch.id);
      await page.goto('/pantalla-config');
      await waitForHydratedInput(page, '[data-testid="pantalla-producto-segundos"]');

      await page.getByTestId('pantalla-producto-segundos').fill('7');
      await page.getByTestId('pantalla-show-qr').uncheck();
      await page.getByTestId('pantalla-settings-save').click();
      await expect(
        page.getByTestId('pantalla-settings-success')
      ).toBeVisible();

      const snapshot = await fetchSnapshot(page, branch.id);
      expect(snapshot.settings.playlistMode).toBe('auto');
      expect(snapshot.settings.productoMs).toBe(7000);
      expect(snapshot.settings.showQrScene).toBe(false);
      expect(snapshot.settings.showBranchScene).toBe(true);
    } finally {
      await deleteIsolatedBranch(branch.id);
    }
  });

  test('en modo personalizado solo rota la playlist elegida', async ({
    page,
  }) => {
    const branch = await createIsolatedBranch();
    try {
      await login(page);
      await activateBranch(page, branch.id);

      // La promo nace en la sucursal ad-hoc (la API resuelve la cookie) y
      // con stock: entra como candidata del selector del editor.
      const { promo } = await createPromoWithRecipeViaApi(page, {
        baseName: '0 Cfg promo',
      });

      await page.goto('/pantalla-config');
      await waitForHydratedInput(page, '[data-testid="pantalla-mode-custom"]');

      // Modo personalizada + playlist con la sola promo.
      await page.getByTestId('pantalla-mode-custom').check();
      await page.getByTestId('pantalla-settings-save').click();
      await expect(
        page.getByTestId('pantalla-settings-success')
      ).toBeVisible();

      await page
        .getByTestId('pantalla-candidate-select')
        .selectOption(`product:${promo.id}`);
      await page.getByTestId('pantalla-add-item').click();
      await expect(
        page.getByTestId('pantalla-item-name')
      ).toContainText('0 Cfg promo');
      await page.getByTestId('pantalla-save-playlist').click();
      await expect(
        page.getByTestId('pantalla-playlist-success')
      ).toBeVisible();

      const snapshot = await fetchSnapshot(page, branch.id);
      expect(snapshot.settings.playlistMode).toBe('custom');
      expect(snapshot.items).toEqual([
        { kind: 'product', refId: promo.id },
      ]);

      // La TV de esa sucursal muestra la promo como primera escena del ciclo.
      await page.goto(`/pantalla?branchId=${branch.id}`);
      const promoScene = page.locator(
        `[data-testid="pantalla-scene-product"][data-product-id="${promo.id}"]`
      );
      await expect(promoScene).toBeVisible({ timeout: 20_000 });
      await expect(promoScene).toContainText('0 Cfg promo');
    } finally {
      await deleteIsolatedBranch(branch.id);
    }
  });

  test('un ítem oculto sale del snapshot pero queda en la lista', async ({
    page,
  }) => {
    const branch = await createIsolatedBranch();
    try {
      await login(page);
      await activateBranch(page, branch.id);
      const { promo } = await createPromoWithRecipeViaApi(page, {
        baseName: 'Cfg oculto',
      });

      await page.goto('/pantalla-config');
      await waitForHydratedInput(
        page,
        '[data-testid="pantalla-candidate-select"]'
      );
      await page
        .getByTestId('pantalla-candidate-select')
        .selectOption(`product:${promo.id}`);
      await page.getByTestId('pantalla-add-item').click();

      // "Visible" desactivado: el ítem queda guardado pero no viaja a la TV.
      await page.getByTestId('pantalla-item-toggle').uncheck();
      await page.getByTestId('pantalla-save-playlist').click();
      await expect(
        page.getByTestId('pantalla-playlist-success')
      ).toBeVisible();

      const snapshot = await fetchSnapshot(page, branch.id);
      expect(snapshot.items).toEqual([]);

      // Sigue listado en el editor tras la revalidación, con el toggle off.
      await expect(page.getByTestId('pantalla-item-row')).toBeVisible();
      await expect(
        page.getByTestId('pantalla-item-toggle')
      ).not.toBeChecked();
    } finally {
      await deleteIsolatedBranch(branch.id);
    }
  });

  test('la configuración de una sucursal no contamina a la otra', async ({
    page,
  }) => {
    const branch = await createIsolatedBranch();
    try {
      await login(page);
      await activateBranch(page, branch.id);
      await page.goto('/pantalla-config');
      await waitForHydratedInput(page, '[data-testid="pantalla-producto-segundos"]');

      await page.getByTestId('pantalla-producto-segundos').fill('9');
      await page.getByTestId('pantalla-settings-save').click();
      await expect(
        page.getByTestId('pantalla-settings-success')
      ).toBeVisible();

      const own = await fetchSnapshot(page, branch.id);
      expect(own.settings.productoMs).toBe(9000);

      // La sucursal por defecto sigue en modo auto con sus propios valores.
      const defaultId = await getDefaultBranchId();
      const other = await fetchSnapshot(page, defaultId);
      expect(other.settings.playlistMode).toBe('auto');
      expect(other.settings.productoMs).not.toBe(9000);
    } finally {
      await deleteIsolatedBranch(branch.id);
    }
  });
});
