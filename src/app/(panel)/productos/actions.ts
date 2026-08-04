'use server';

import { revalidatePath } from 'next/cache';
import * as productService from '@/application/services/productService';

export async function deleteProduct(formData: FormData) {
  const id = Number(formData.get('id'));
  await productService.deleteProduct(id);
  revalidatePath('/productos');
}
