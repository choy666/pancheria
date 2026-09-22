import { test, expect } from '@playwright/test';
import { like } from 'drizzle-orm';
import { db } from '../../src/db';
import { products } from '../../src/db/schema';
import {
  login,
  ensureCashRegisterOpen,
  setUniqueClientIp,
  getDefaultBranchId,
} from './helpers';

/**
 * Paginación del catálogo público `/pedido`.
 *
 * `NEXT_PUBLIC_CATALOG_PAGE_SIZE=200` en `.env.e2e` hace que ningún otro
 * test ejercite el botón "Cargar más": acá se insertan productos `service`
 * (vendibles al público, sin stock) directo en la base para superar la
 * primera página, igual que los helpers que mutan `branches`/`cash_registers`.
 */
test.describe('Paginación del catálogo público', () => {
  test('el botón "Cargar más" trae la página siguiente y se oculta al agotar el total', async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await login(page);
    await ensureCashRegisterOpen(page);
    await setUniqueClientIp(page);

    const branchId = await getDefaultBranchId();

    // La página e2e carga 200 por página: insertamos 205 servicios para
    // garantizar total > pageSize sin depender del catálogo del seed.
    const stamp = Date.now();
    const bulk = Array.from({ length: 205 }, (_, i) => ({
      branchId,
      name: `ZZZ Paginación ${stamp} ${String(i).padStart(3, '0')}`,
      type: 'service' as const,
      price: 100 + i,
      unit: 'unidad',
      stock: 0,
      minStock: 0,
      isActive: true,
    }));
    try {
      await db.insert(products).values(bulk);

      const productCards = page.locator('[data-testid^="product-card-"]');

      await page.goto('/pedido');
      await page.waitForLoadState('networkidle');

      // Primera página: como máximo el tamaño de página, y el botón visible.
      const initialCount = await productCards.count();
      expect(initialCount).toBe(200);
      const loadMore = page.getByTestId('catalog-load-more');
      await expect(loadMore).toBeVisible();

      await loadMore.click();

      // La segunda página suma los productos restantes del total.
      await expect
        .poll(async () => productCards.count(), { timeout: 15_000 })
        .toBeGreaterThan(initialCount);
      await expect(loadMore).not.toBeVisible();

      // Los servicios insertados quedan al final del orden alfabético y
      // aparecen tras el "Cargar más".
      await expect(
        page.locator('[data-testid^="product-card-"]', {
          hasText: `ZZZ Paginación ${stamp}`,
        }).first()
      ).toBeVisible();
    } finally {
      // Limpieza obligatoria: los 205 servicios quedan en la base compartida
      // de la suite y contaminan los specs que corren después sobre
      // /productos (diálogos, papelera, menú móvil, tour).
      await db
        .delete(products)
        .where(like(products.name, `ZZZ Paginación ${stamp} %`));
    }
  });
});
