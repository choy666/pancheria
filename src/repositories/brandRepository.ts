import { isNotNull } from 'drizzle-orm';
import { db } from '@/db';
import { brandSettings } from '@/db/schema';
import { nowUTC } from '@/lib/date';
import type { BrandLogo, BrandSettings } from '@/domain/types';

type BrandSettingsUpsert = Omit<BrandSettings, 'logoUpdatedAt'>;

const BRAND_ROW_ID = 1;

export async function findSettings(): Promise<BrandSettings | null> {
  const row = await db.query.brandSettings.findFirst({
    columns: { id: false, logoData: false, logoMimeType: false, updatedAt: false },
  });
  return row ?? null;
}

export async function findLogo(): Promise<BrandLogo | null> {
  const row = await db.query.brandSettings.findFirst({
    columns: { logoData: true, logoMimeType: true, logoUpdatedAt: true },
    where: isNotNull(brandSettings.logoData),
  });
  if (!row?.logoData || !row.logoMimeType || !row.logoUpdatedAt) return null;
  return {
    data: row.logoData,
    mimeType: row.logoMimeType,
    updatedAt: row.logoUpdatedAt,
  };
}

export async function upsertSettings(data: BrandSettingsUpsert): Promise<void> {
  await db
    .insert(brandSettings)
    .values({ id: BRAND_ROW_ID, ...data, updatedAt: nowUTC() })
    .onConflictDoUpdate({
      target: brandSettings.id,
      set: { ...data, updatedAt: nowUTC() },
    });
}

export async function upsertLogo(data: Buffer, mimeType: string): Promise<void> {
  const now = nowUTC();
  const logo = { logoData: data, logoMimeType: mimeType, logoUpdatedAt: now, updatedAt: now };
  await db
    .insert(brandSettings)
    .values({ id: BRAND_ROW_ID, ...logo })
    .onConflictDoUpdate({ target: brandSettings.id, set: logo });
}

export async function clearLogo(): Promise<void> {
  const now = nowUTC();
  const logo = { logoData: null, logoMimeType: null, logoUpdatedAt: null, updatedAt: now };
  await db
    .insert(brandSettings)
    .values({ id: BRAND_ROW_ID, ...logo })
    .onConflictDoUpdate({ target: brandSettings.id, set: logo });
}
