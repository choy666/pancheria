'use server';

import { revalidatePath } from 'next/cache';
import * as productService from '@/application/services/productService';
import { DomainError } from '@/domain/errors';

export type DeleteProductState = { error: string } | null;

export async function deleteProduct(
  _prevState: DeleteProductState,
  formData: FormData
): Promise<DeleteProductState> {
  const id = Number(formData.get('id'));

  try {
    await productService.deleteProduct(id);
  } catch (error) {
    if (error instanceof DomainError) {
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath('/productos');
  return null;
}
