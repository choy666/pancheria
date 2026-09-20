import { unstable_cache, revalidateTag } from 'next/cache';
import * as branchRepository from '@/repositories/branchRepository';
import * as catalogRepository from '@/repositories/catalogRepository';
import { getDataCacheRevalidateSeconds } from '@/config/cache';
import type { Branch, ProductRow } from '@/domain/types';

/**
 * Capa de caché de servidor (Data Cache de Next.js) sobre las lecturas
 * calientes y pseudo-estáticas: datos de sucursal y el listado del catálogo
 * público. La disponibilidad de stock NO se cachea: se calcula en vivo en
 * cada request porque cambia con cada venta/reserva.
 *
 * Invalidación: los puntos de mutación (server actions y route handlers del
 * panel) llaman `invalidateBranchesCache`/`invalidatePublicCatalogCache`.
 * `revalidateTag(tag, { expire: 0 })` fuerza revalidación bloqueante en la
 * próxima lectura (semántica Next 16: el operador que muta ve el cambio de
 * inmediato). El `revalidate` temporal queda como red de seguridad si alguna
 * mutación futura olvida invalidar.
 *
 * Solo entran datos públicos/no sensibles; nada de sesiones, ventas ni caja.
 *
 * En tests unitarios `next/cache` se mapea a `tests/mocks/next-cache.ts`
 * (passthrough), por lo que esta capa es transparente fuera del runtime de
 * Next.
 */

const DATA_CACHE_TAGS = {
  branches: 'branches',
  publicCatalog: 'public-catalog',
} as const;

const REVALIDATE_S = getDataCacheRevalidateSeconds();

function isCacheDisabled(): boolean {
  return REVALIDATE_S <= 0;
}

// `unstable_cache` exige `revalidate` > 0 o `false` y valida la opción en el
// registro (a nivel módulo). Con la capa deshabilitada (`<= 0`) las funciones
// exportadas bypassean estas llamadas, así que el valor registrado es
// irrelevante: se fija un placeholder válido para no romper el registro.
const REVALIDATE_OPTION = REVALIDATE_S > 0 ? REVALIDATE_S : 60;

// El data cache serializa los valores persistidos; los `Date` pueden volver
// como `string`. `new Date(...)` es idempotente si el serializer los preserva.
// Los guards evitan `Invalid Date` si un valor llega ausente.
function reviveBranch(row: Branch | undefined | null): Branch | undefined {
  if (!row) return undefined;
  return {
    ...row,
    createdAt: row.createdAt ? new Date(row.createdAt) : row.createdAt,
  };
}

function reviveProductRow(row: ProductRow): ProductRow {
  return {
    ...row,
    createdAt: row.createdAt ? new Date(row.createdAt) : row.createdAt,
    updatedAt: row.updatedAt ? new Date(row.updatedAt) : row.updatedAt,
    deletedAt: row.deletedAt ? new Date(row.deletedAt) : null,
  };
}

const cachedBranchById = unstable_cache(
  async (id: number) => branchRepository.findById(id),
  ['server-cache', 'branch-by-id'],
  { tags: [DATA_CACHE_TAGS.branches], revalidate: REVALIDATE_OPTION }
);

export async function getCachedBranchById(
  id: number
): Promise<Branch | undefined> {
  if (isCacheDisabled()) {
    return branchRepository.findById(id) as Promise<Branch | undefined>;
  }
  return reviveBranch((await cachedBranchById(id)) as Branch | undefined);
}

const cachedBranchIdByName = unstable_cache(
  async (name: string): Promise<number | null> => {
    const branch = await branchRepository.findByName(name);
    return (branch?.id as number | undefined) ?? null;
  },
  ['server-cache', 'branch-id-by-name'],
  { tags: [DATA_CACHE_TAGS.branches], revalidate: REVALIDATE_OPTION }
);

export async function getCachedBranchIdByName(
  name: string
): Promise<number | null> {
  if (isCacheDisabled()) {
    const branch = await branchRepository.findByName(name);
    return (branch?.id as number | undefined) ?? null;
  }
  return cachedBranchIdByName(name);
}

const cachedBranchList = unstable_cache(
  async (limit: number) => branchRepository.findAllOrderedByCreatedAt({ limit }),
  ['server-cache', 'branch-list'],
  { tags: [DATA_CACHE_TAGS.branches], revalidate: REVALIDATE_OPTION }
);

export async function getCachedBranchList(limit: number): Promise<Branch[]> {
  if (isCacheDisabled()) {
    return branchRepository.findAllOrderedByCreatedAt({ limit }) as Promise<
      Branch[]
    >;
  }
  const rows = await cachedBranchList(limit);
  return (rows as Branch[]).map((row) => reviveBranch(row) as Branch);
}

/**
 * Base del catálogo público (productos vendibles + total) sin disponibilidad.
 * `limit`/`offset` entran en la clave de caché: cada página se cachea por
 * separado. `null` representa "sin paginar" para claves deterministas.
 */
const cachedPublicCatalogBase = unstable_cache(
  async (branchId: number, limit: number | null, offset: number | null) => {
    const pagination =
      limit !== null || offset !== null
        ? { limit: limit ?? undefined, offset: offset ?? undefined }
        : undefined;
    const products = await catalogRepository.findPublicProducts(
      branchId,
      pagination
    );
    const total = pagination
      ? await catalogRepository.countPublicProducts(branchId)
      : products.length;
    return { products, total };
  },
  ['server-cache', 'public-catalog'],
  { tags: [DATA_CACHE_TAGS.publicCatalog], revalidate: REVALIDATE_OPTION }
);

export async function getCachedPublicCatalogBase(
  branchId: number,
  pagination?: { limit?: number; offset?: number }
): Promise<{ products: ProductRow[]; total: number }> {
  const limit = pagination?.limit ?? null;
  const offset = pagination?.offset ?? null;
  if (isCacheDisabled()) {
    const products = await catalogRepository.findPublicProducts(
      branchId,
      pagination
    );
    const total = pagination
      ? await catalogRepository.countPublicProducts(branchId)
      : products.length;
    return { products, total };
  }
  const { products, total } = await cachedPublicCatalogBase(
    branchId,
    limit,
    offset
  );
  return { products: (products as ProductRow[]).map(reviveProductRow), total };
}

export function invalidateBranchesCache(): void {
  revalidateTag(DATA_CACHE_TAGS.branches, { expire: 0 });
}

export function invalidatePublicCatalogCache(): void {
  revalidateTag(DATA_CACHE_TAGS.publicCatalog, { expire: 0 });
}
