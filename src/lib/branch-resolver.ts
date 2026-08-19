import * as branchService from '@/application/services/branchService';
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
  const branches = await branchService.listBranches();
  return branches.map((b) => ({
    id: b.id,
    name: b.name,
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
  const defaultBranchName = process.env.DEFAULT_BRANCH_NAME?.trim();

  if (!defaultBranchName) {
    return null;
  }

  const branches = await branchService.listBranches();
  const branch = branches.find((b) => b.name === defaultBranchName);

  if (!branch) {
    return null;
  }

  return branch.id;
}
