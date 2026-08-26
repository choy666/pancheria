'use server';

import { revalidatePath } from 'next/cache';
import * as productService from '@/application/services/productService';
import { DomainError } from '@/domain/errors';
import { requireAdmin, getCurrentBranchId } from '@/lib/auth';
import { routes } from '@/config/routes';

export type DeleteProductState = { error: string } | null;

export async function deleteProduct(
  _prevState: DeleteProductState,
  formData: FormData
): Promise<DeleteProductState> {
  const session = await requireAdmin();
  const branchId = await getCurrentBranchId(session);
  const id = Number(formData.get('id'));

  try {
    await productService.deleteProduct(branchId, id);
  } catch (error) {
    if (error instanceof DomainError) {
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath(routes.productos);
  return null;
}
