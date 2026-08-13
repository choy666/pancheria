'use server';

import { revalidatePath } from 'next/cache';
import * as productService from '@/application/services/productService';
import { DomainError } from '@/domain/errors';
import { requireAuth } from '@/lib/auth';

export type DeleteProductState = { error: string } | null;

export async function deleteProduct(
  _prevState: DeleteProductState,
  formData: FormData
): Promise<DeleteProductState> {
  const session = await requireAuth();
  const branchId = Number(session.user.branchId);
  const id = Number(formData.get('id'));

  try {
    await productService.deleteProduct(branchId, id);
  } catch (error) {
    if (error instanceof DomainError) {
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath('/productos');
  return null;
}
