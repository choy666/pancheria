'use server';

import { revalidatePath } from 'next/cache';
import * as branchService from '@/application/services/branchService';
import {
  invalidateBranchesCache,
  invalidatePublicCatalogCache,
} from '@/lib/server-cache';
import { requireAdmin } from '@/lib/auth';
import { DomainError, NotFoundError } from '@/domain/errors';
import { routes } from '@/config/routes';
import {
  parseContactsForm,
  parseOpeningHoursForm,
} from '@/lib/branch-helpers';

export type BranchState = { error: string } | null;

export async function createBranch(
  _prevState: BranchState,
  formData: FormData
): Promise<BranchState> {
  await requireAdmin();
  const name = formData.get('name')?.toString() ?? '';
  const openingHours = parseOpeningHoursForm(formData);
  const { phones, socialLinks } = parseContactsForm(formData);
  const address = formData.get('address')?.toString() || null;
  const location = formData.get('location')?.toString() || null;

  try {
    await branchService.createBranch({
      name,
      openingHours,
      address,
      phones,
      socialLinks,
      location,
    });
  } catch (error) {
    if (error instanceof DomainError) {
      return { error: error.message };
    }
    // Errores inesperados (p. ej. de PostgreSQL) no se filtran al admin:
    // su mensaje puede exponer detalles internos.
    return { error: 'Error al crear la sucursal. Intentá de nuevo.' };
  }

  invalidateBranchesCache();
  revalidatePath(routes.sucursales);
  return null;
}

export async function updateBranchAction(
  _prevState: BranchState,
  formData: FormData
): Promise<BranchState> {
  await requireAdmin();

  const id = Number(formData.get('id'));
  const name = formData.get('name')?.toString() ?? '';
  const openingHours = parseOpeningHoursForm(formData);
  const { phones, socialLinks } = parseContactsForm(formData);
  const address = formData.get('address')?.toString() || null;
  const location = formData.get('location')?.toString() || null;

  try {
    await branchService.updateBranch(id, {
      name,
      openingHours,
      address,
      phones,
      socialLinks,
      location,
    });
  } catch (error) {
    if (error instanceof DomainError) {
      return { error: error.message };
    }
    return { error: 'Error al actualizar la sucursal. Intentá de nuevo.' };
  }

  invalidateBranchesCache();
  revalidatePath(routes.sucursales);
  return null;
}

export async function deleteBranchAction(
  _prevState: BranchState,
  formData: FormData
): Promise<BranchState> {
  await requireAdmin();

  const id = Number(formData.get('id'));
  const confirmBranchName = formData.get('confirmBranchName')?.toString().trim();

  try {
    const branch = await branchService.getBranchById(id);
    if (!branch) {
      throw new NotFoundError('Sucursal', id);
    }

    if (confirmBranchName !== branch.name) {
      return { error: 'El nombre de sucursal ingresado no coincide.' };
    }

    await branchService.deleteBranch(id);
  } catch (error) {
    if (error instanceof DomainError) {
      return { error: error.message };
    }
    // El error inesperado también viaja como estado del form: el diálogo lo
    // muestra inline (`branch-delete-error`); relanzarlo caería al error
    // boundary y dejaría la operación sin feedback contextual.
    return { error: 'No se pudo eliminar la sucursal. Intentá de nuevo.' };
  }

  invalidateBranchesCache();
  invalidatePublicCatalogCache();
  revalidatePath(routes.sucursales);
  return null;
}

export async function getBranchDeletionSummaryAction(
  id: number
): Promise<ReturnType<typeof branchService.getBranchDeletionSummary>> {
  const session = await requireAdmin();
  // El branchId de la sesión ya viene revalidado contra la base por
  // `requireAuth`: es la sucursal asignada del usuario, que determina si la
  // eliminación borra su propia cuenta (riesgo de lockout).
  return branchService.getBranchDeletionSummary(id, session.user.branchId);
}
