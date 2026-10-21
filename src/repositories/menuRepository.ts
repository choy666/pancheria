import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { menuSettings } from '@/db/schema';
import { nowUTC } from '@/lib/date';
import type { MenuSettingsRow } from '@/domain/types';

export type MenuSettingsUpsert = Omit<
  MenuSettingsRow,
  'branchId' | 'updatedAt'
>;

export async function findSettings(
  branchId: number
): Promise<MenuSettingsRow | null> {
  const row = await db.query.menuSettings.findFirst({
    where: eq(menuSettings.branchId, branchId),
  });
  return row ?? null;
}

export async function upsertSettings(
  branchId: number,
  data: MenuSettingsUpsert
): Promise<MenuSettingsRow> {
  const [row] = await db
    .insert(menuSettings)
    .values({ branchId, ...data, updatedAt: nowUTC() })
    .onConflictDoUpdate({
      target: menuSettings.branchId,
      set: { ...data, updatedAt: nowUTC() },
    })
    .returning();
  return row;
}
