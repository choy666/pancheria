'use server';

import { revalidatePath } from 'next/cache';
import * as branchService from '@/application/services/branchService';
import { requireAdmin } from '@/lib/auth';
import { DomainError, NotFoundError } from '@/domain/errors';
import { routes } from '@/config/routes';
import { parseOpeningHoursForm } from '@/lib/branch-helpers';

export type BranchState = { error: string } | null;

export async function createBranch(
  _prevState: BranchState,
  formData: FormData
): Promise<BranchState> {
  await requireAdmin();
  const name = formData.get('name')?.toString() ?? '';
  const openingHours = parseOpeningHoursForm(formData);
  const address = formData.get('address')?.toString() || null;
  const phone = formData.get('phone')?.toString() || null;
  const location = formData.get('location')?.toString() || null;

  try {
    await branchService.createBranch(name, openingHours, address, phone, location);
  } catch (error) {
    if (error instanceof DomainError) {
      return { error: error.message };
    }
    return { error: error instanceof Error ? error.message : 'Error al crear la sucursal.' };
  }

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
  const address = formData.get('address')?.toString() || null;
  const phone = formData.get('phone')?.toString() || null;
  const location = formData.get('location')?.toString() || null;

  try {
    await branchService.updateBranch(id, name, openingHours, address, phone, location);
  } catch (error) {
    if (error instanceof DomainError) {
      return { error: error.message };
    }
    return { error: error instanceof Error ? error.message : 'Error al actualizar la sucursal.' };
  }

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
    throw error;
  }

  revalidatePath(routes.sucursales);
  return null;
}

export async function getBranchDeletionSummaryAction(
  id: number
): Promise<ReturnType<typeof branchService.getBranchDeletionSummary>> {
  await requireAdmin();
  return branchService.getBranchDeletionSummary(id);
}
