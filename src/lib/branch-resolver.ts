import { getDefaultBranchName } from '@/config/branch';
import { MAX_LIMIT } from '@/config/pagination';
import { getCachedBranchIdByName, getCachedBranchList } from '@/lib/server-cache';
import type { Branch } from '@/domain/types';

/**
 * Mensaje genérico que se expone al cliente cuando no se puede resolver la
 * sucursal activa. Se centraliza aquí para evitar duplicarlo en cada ruta API.
 */
export const DEFAULT_BRANCH_ERROR =
  'No se encontró la sucursal activa. Volvé a intentar más tarde.';

export function parseBranchId(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }

  const asString = String(value).trim();
  if (!/^\d+$/.test(asString)) {
    return null;
  }

  const parsed = Number.parseInt(asString, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export async function listPublicBranches(): Promise<Branch[]> {
  // Cap defensivo: el selector público no debería listar más de MAX_LIMIT
  // sucursales. La tabla `branches` no tiene flag de activo: todas las
  // sucursales existentes se consideran activas. Cacheado por tag
  // `branches` (se invalida al crear/editar/eliminar sucursales).
  const branches = await getCachedBranchList(MAX_LIMIT);
  return branches.map((b) => ({
    id: b.id,
    name: b.name,
    openingHours: b.openingHours ?? [],
    address: b.address ?? null,
    phones: b.phones ?? [],
    socialLinks: b.socialLinks ?? [],
    location: b.location ?? null,
    createdAt: b.createdAt,
  }));
}

/**
 * Resuelve el identificador de la sucursal por defecto.
 * Devuelve `null` si la variable de entorno no está configurada o si no
 * existe una sucursal con ese nombre. Esto permite que los llamadores
 * decidan si renderizar un estado de error o responder con un código
 * controlado, sin exponer detalles internos al cliente.
 */
export async function getDefaultBranchId(): Promise<number | null> {
  const defaultBranchName = getDefaultBranchName();

  if (!defaultBranchName) {
    return null;
  }

  // Lookup directo por nombre cacheado (tag `branches`): evita una query
  // por cada request pública que necesita la sucursal por defecto.
  return getCachedBranchIdByName(defaultBranchName);
}
