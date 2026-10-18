import { test, expect } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db';
import { branches, videos } from '../../src/db/schema';
import {
  createPromoWithRecipeViaApi,
  getDefaultBranchId,
  getTestSecondBranch,
  login,
  unique,
} from './helpers';

/**
 * Suite de la pantalla publicitaria `/pantalla` (route group `(kiosk)`).
 *
 * Notas de entorno:
 * - `global-setup.ts` trunca `videos` y el seed no siembra ninguno, así que la
 *   playlist base no tiene escenas de video; el caso con video se fuerza con
 *   un insert directo (y el stream local exige sesión de admin, que el
 *   contexto público de Playwright no tiene → la escena se salta).
 * - Las duraciones de escena vienen de `NEXT_PUBLIC_PANTALLA_*_MS`
 *   (.env.e2e.example / job de CI las acortan a ~1.5 s). Las assertions usan
 *   timeouts que también cubren los defaults (8–12 s) por si el `.env.e2e`
 *   local es anterior a estas variables.
 */
test.describe('Pantalla publicitaria (/pantalla)', () => {
  test('sin branchId redirige a la URL canónica de la sucursal por defecto', async ({
    page,
  }) => {
    const branchId = await getDefaultBranchId();
    await page.goto('/pantalla');
    await expect(page).toHaveURL(`/pantalla?branchId=${branchId}`);
    await expect(page.getByTestId('pantalla-screen')).toBeVisible();
  });

  test('con branchId inválido redirige a /pantalla y resuelve la default', async ({
    page,
  }) => {
    const branchId = await getDefaultBranchId();
    await page.goto('/pantalla?branchId=no-es-un-numero');
    // Doble redirect: /pantalla?branchId=invalido → /pantalla → ?branchId=default
    await expect(page).toHaveURL(`/pantalla?branchId=${branchId}`);
  });

  test('una sucursal inexistente muestra el estado de error', async ({
    page,
  }) => {
    const rows = await db.select({ id: branches.id }).from(branches);
    const missingId = Math.max(...rows.map((row) => row.id)) + 100_000;
    await page.goto(`/pantalla?branchId=${missingId}`);
    await expect(page.getByTestId('pantalla-error')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Volver a intentar' })
    ).toBeVisible();
  });

  test('GET /api/public/pantalla devuelve el snapshot de la sucursal', async ({
    page,
  }) => {
    const branchId = await getDefaultBranchId();

    const response = await page.request.get(
      `/api/public/pantalla?branchId=${branchId}`
    );
    expect(response.status()).toBe(200);
    const snapshot = (await response.json()) as {
      branch: { id: number; name: string };
      isOpen: boolean;
      products: unknown[];
      videos: { id: number; fileUrl: string }[];
    };
    expect(snapshot.branch.id).toBe(branchId);
    expect(Array.isArray(snapshot.products)).toBe(true);
    expect(Array.isArray(snapshot.videos)).toBe(true);
    expect(typeof snapshot.isOpen).toBe('boolean');
    for (const video of snapshot.videos) {
      // El snapshot emite URLs same-origin para el provider local.
      expect(video.fileUrl).not.toContain('http://localhost');
    }

    // Sin branchId resuelve la sucursal por defecto.
    const fallback = await page.request.get('/api/public/pantalla');
    expect(fallback.status()).toBe(200);
    expect(
      ((await fallback.json()) as { branch: { id: number } }).branch.id
    ).toBe(branchId);

    // branchId inválido → 400 de validación Zod.
    const invalid = await page.request.get(
      '/api/public/pantalla?branchId=no-es-un-numero'
    );
    expect(invalid.status()).toBe(400);
  });

  test('muestra el primer producto del agrupamiento público y rota de escena', async ({
    page,
  }) => {
    await login(page);
    const branchId = await getDefaultBranchId();
    // El nombre con dígito inicial ordena primero dentro del grupo
    // `compound`, que encabeza el agrupamiento público: el promo del test es
    // la primera escena del ciclo. La receta con autoDiscount le da
    // availability > 0 (los productos agotados se ocultan de la playlist).
    const { promo } = await createPromoWithRecipeViaApi(page, {
      baseName: '0 Pantalla promo',
      price: 4321,
    });

    await page.goto(`/pantalla?branchId=${branchId}`);

    const promoScene = page.locator(
      `[data-testid="pantalla-scene-product"][data-product-id="${promo.id}"]`
    );
    await expect(promoScene).toBeVisible({ timeout: 20_000 });
    // Nombre y precio reales del catálogo (formatMoney usa es-AR).
    await expect(promoScene).toContainText('0 Pantalla promo');
    await expect(promoScene).toContainText('$');

    // La escena avanza sola: desaparece la del promo y aparece otra
    // (producto siguiente, sucursal o QR según el largo del ciclo).
    await expect(promoScene).toBeHidden({ timeout: 30_000 });

    // Chrome persistente: marca de la sucursal y estado operativo.
    await expect(page.getByTestId('pantalla-status')).toBeVisible();
    await expect(page.getByTestId('pantalla-clock')).toBeVisible();
  });

  test('una sucursal sin catálogo rota solo sucursal y QR', async ({
    page,
  }) => {
    // Sucursal nueva sin catálogo copiado ni videos: la playlist queda
    // [sucursal, qr] y el ciclo completo cabe en el timeout del test
    // incluso con las duraciones por defecto (8 s + 12 s).
    const [branch] = await db
      .insert(branches)
      .values({ name: unique('Pantalla vacía') })
      .returning();

    try {
      await page.goto(`/pantalla?branchId=${branch.id}`);

      await expect(page.getByTestId('pantalla-scene-branch')).toBeVisible({
        timeout: 20_000,
      });
      // Sin caja abierta ni horarios: la sucursal figura cerrada.
      await expect(page.getByTestId('pantalla-branch-status')).toContainText(
        'Cerrado'
      );

      await expect(page.getByTestId('pantalla-scene-qr')).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByTestId('pantalla-qr-url')).toContainText(
        `/pedido?branchId=${branch.id}`
      );
      // El QR apunta a /pedido de esta sucursal (svg inline).
      const qrSvg = page
        .getByTestId('pantalla-scene-qr')
        .locator('svg')
        .first();
      await expect(qrSvg).toBeVisible();
    } finally {
      await db.delete(branches).where(eq(branches.id, branch.id));
    }
  });

  test('un video con stream local se salta sin sesión y la pantalla sigue rotando', async ({
    page,
  }) => {
    // Sucursal ad-hoc sin catálogo: el ciclo queda [video, sucursal, qr] y
    // la escena de video reaparece cada vuelta (~20 s con duraciones
    // default). Con el catálogo del seed la primera aparición es tan
    // efímera —el stream 401 la desmonta al instante— que el locator la
    // puede perder y la segunda vuelta supera el timeout del assert.
    const [branch] = await db
      .insert(branches)
      .values({ name: unique('Pantalla video') })
      .returning();
    // Provider local (STORAGE_PROVIDER=local en E2E): el snapshot emite
    // /api/videos/<key>/stream, que exige sesión de admin. El contexto
    // público del test no la tiene → <video> dispara error y la escena cede.
    const [video] = await db
      .insert(videos)
      .values({
        branchId: branch.id,
        title: unique('Video E2E'),
        fileUrl: 'http://localhost:3000/api/videos/e2e-fake/stream',
        mimeType: 'video/mp4',
        isActive: true,
      })
      .returning();

    try {
      await page.goto(`/pantalla?branchId=${branch.id}`);

      // La escena de video encabeza el ciclo cuando hay videos activos.
      await expect(page.getByTestId('pantalla-scene-video')).toBeAttached({
        timeout: 45_000,
      });
      // ...y se salta cuando el stream falla (`error`/`play().catch`) o, si
      // el navegador no dispara el evento, por el watchdog: en E2E
      // NEXT_PUBLIC_PANTALLA_VIDEO_MAX_MS=8000 lo hace determinista.
      await expect(page.getByTestId('pantalla-scene-video')).toBeHidden({
        timeout: 45_000,
      });
      // La pantalla sigue viva rotando las demás escenas.
      await expect(page.getByTestId('pantalla-scene-branch')).toBeAttached({
        timeout: 45_000,
      });
      await expect(page.getByTestId('pantalla-screen')).toBeVisible();
    } finally {
      await db.delete(videos).where(eq(videos.id, video.id));
      await db.delete(branches).where(eq(branches.id, branch.id));
    }
  });
});

test.describe('Acceso desde el panel y multi-sucursal', () => {
  test('el enlace de la navbar apunta a la sucursal activa y sigue al selector', async ({
    page,
  }) => {
    await login(page);
    const defaultId = await getDefaultBranchId();
    const second = await getTestSecondBranch();

    await page.goto('/');

    const link = page.getByTestId('pantalla-link');
    await expect(link).toHaveAttribute(
      'href',
      `/pantalla?branchId=${defaultId}`
    );
    await expect(link).toHaveAttribute('target', '_blank');
    expect(await link.getAttribute('rel')).toContain('noopener');

    // El Select de Radix abre un portal fuera del header; el texto de la
    // opción activa es el nombre exacto (las inactivas llevan " (inactiva)").
    await page.getByTestId('branch-selector-trigger').click();
    const escapedName = second.branchName.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    );
    await page
      .getByTestId('branch-option')
      .filter({ hasText: new RegExp(`^${escapedName}( \\(inactiva\\))?$`) })
      .click();

    // setActiveBranchAction dispara window.location.reload(): la assertion
    // reintenta hasta que el header re-renderiza con la nueva sucursal.
    await expect(link).toHaveAttribute(
      'href',
      `/pantalla?branchId=${second.branchId}`
    );
  });

  test('dos pantallas pineadas a sucursales distintas no se contaminan', async ({
    page,
  }) => {
    // Sucursales ad-hoc sin catálogo ni videos: el ciclo queda [sucursal, qr]
    // y el QR aparece en la primera vuelta, incluso con duraciones default.
    const [branchA] = await db
      .insert(branches)
      .values({ name: unique('Pantalla A') })
      .returning();
    const [branchB] = await db
      .insert(branches)
      .values({ name: unique('Pantalla B') })
      .returning();
    // /pantalla es pública: basta otra page del mismo contexto.
    const pageB = await page.context().newPage();

    try {
      await page.goto(`/pantalla?branchId=${branchA.id}`);
      await pageB.goto(`/pantalla?branchId=${branchB.id}`);

      // El chrome muestra el nombre de su propia sucursal, sin mezclarse.
      await expect(page.getByTestId('pantalla-screen')).toContainText(
        branchA.name
      );
      await expect(page.getByTestId('pantalla-screen')).not.toContainText(
        branchB.name
      );
      await expect(pageB.getByTestId('pantalla-screen')).toContainText(
        branchB.name
      );
      await expect(pageB.getByTestId('pantalla-screen')).not.toContainText(
        branchA.name
      );

      // El QR de cada TV apunta al /pedido de su propia sucursal.
      await expect(page.getByTestId('pantalla-qr-url')).toContainText(
        `/pedido?branchId=${branchA.id}`,
        { timeout: 30_000 }
      );
      await expect(pageB.getByTestId('pantalla-qr-url')).toContainText(
        `/pedido?branchId=${branchB.id}`,
        { timeout: 30_000 }
      );
    } finally {
      await pageB.close();
      await db.delete(branches).where(eq(branches.id, branchA.id));
      await db.delete(branches).where(eq(branches.id, branchB.id));
    }
  });
});
