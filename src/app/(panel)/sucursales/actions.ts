'use server';

import { revalidatePath } from 'next/cache';
import * as branchService from '@/application/services/branchService';
import { requireAdmin } from '@/lib/auth';
import { DomainError } from '@/domain/errors';

export type BranchState = { error: string } | null;

export async function listBranches() {
  await requireAdmin();
  return branchService.listBranches();
}

export async function createBranch(
  _prevState: BranchState,
  formData: FormData
): Promise<BranchState> {
  await requireAdmin();
  const name = formData.get('name')?.toString() ?? '';

  try {
    await branchService.createBranch(name);
  } catch (error) {
    if (error instanceof DomainError) {
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath('/sucursales');
  return null;
}
