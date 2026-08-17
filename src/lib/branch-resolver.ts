import * as branchService from '@/application/services/branchService';
import type { Branch } from '@/domain/types';
import { ValidationError } from '@/domain/errors';

export async function listPublicBranches(): Promise<Branch[]> {
  const branches = await branchService.listBranches();
  return branches.map((b) => ({
    id: b.id,
    name: b.name,
    createdAt: b.createdAt,
  }));
}

export async function getDefaultBranchId(): Promise<number> {
  const defaultBranchName = process.env.DEFAULT_BRANCH_NAME?.trim();

  if (!defaultBranchName) {
    throw new ValidationError(
      'DEFAULT_BRANCH_NAME no está configurado en las variables de entorno.'
    );
  }

  const branches = await branchService.listBranches();
  const branch = branches.find((b) => b.name === defaultBranchName);

  if (!branch) {
    throw new ValidationError(
      `No se encontró la sucursal por defecto "${defaultBranchName}".`
    );
  }

  return branch.id;
}
