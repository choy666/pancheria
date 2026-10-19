import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { pantallaItems, pantallaSettings, products, videos } from '@/db/schema';
import { nowUTC } from '@/lib/date';
import type {
  PantallaItemRow,
  PantallaSettingsRow,
  ProductRow,
  VideoRow,
} from '@/domain/types';

export type PantallaSettingsUpsert = Omit<
  PantallaSettingsRow,
  'branchId' | 'updatedAt'
>;

export type PantallaItemWithRef = {
  item: PantallaItemRow;
  product: ProductRow | null;
  video: VideoRow | null;
};

export async function findSettings(
  branchId: number
): Promise<PantallaSettingsRow | null> {
  const row = await db.query.pantallaSettings.findFirst({
    where: eq(pantallaSettings.branchId, branchId),
  });
  return row ?? null;
}

export async function upsertSettings(
  branchId: number,
  data: PantallaSettingsUpsert
): Promise<PantallaSettingsRow> {
  const [row] = await db
    .insert(pantallaSettings)
    .values({ branchId, ...data, updatedAt: nowUTC() })
    .onConflictDoUpdate({
      target: pantallaSettings.branchId,
      set: { ...data, updatedAt: nowUTC() },
    })
    .returning();
  return row;
}

/**
 * Ítems de la playlist explícita de una sucursal, ordenados por `position`.
 * `enabledOnly` filtra los deshabilitados (lo que consume el snapshot
 * público; el panel de configuración lista todos).
 */
export async function findItems(
  branchId: number,
  options: { enabledOnly?: boolean } = {}
): Promise<PantallaItemRow[]> {
  const conditions = [eq(pantallaItems.branchId, branchId)];
  if (options.enabledOnly) {
    conditions.push(eq(pantallaItems.isEnabled, true));
  }

  return db
    .select()
    .from(pantallaItems)
    .where(and(...conditions))
    .orderBy(asc(pantallaItems.position));
}

/**
 * Ítems con su referencia resuelta (producto o video completo, `null` si la
 * fila referenciada ya no existe). Alimenta la vista de configuración: el
 * servicio deriva el estado mostrado ("sin stock", "inactivo", …).
 */
export async function findItemsWithRefs(
  branchId: number
): Promise<PantallaItemWithRef[]> {
  const rows = await db
    .select({
      item: pantallaItems,
      product: products,
      video: videos,
    })
    .from(pantallaItems)
    .leftJoin(products, eq(pantallaItems.productId, products.id))
    .leftJoin(videos, eq(pantallaItems.videoId, videos.id))
    .where(eq(pantallaItems.branchId, branchId))
    .orderBy(asc(pantallaItems.position));

  return rows as PantallaItemWithRef[];
}

export async function deleteItemsByBranch(
  dbOrTx: typeof db = db,
  branchId: number
): Promise<void> {
  await dbOrTx
    .delete(pantallaItems)
    .where(eq(pantallaItems.branchId, branchId));
}

export async function insertItems(
  dbOrTx: typeof db = db,
  values: (typeof pantallaItems.$inferInsert)[]
) {
  if (values.length === 0) return [];
  return dbOrTx.insert(pantallaItems).values(values).returning();
}
