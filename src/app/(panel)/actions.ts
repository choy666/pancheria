'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { requireAdmin, ACTIVE_BRANCH_COOKIE } from '@/lib/auth';
import * as branchService from '@/application/services/branchService';

export async function setActiveBranchAction(formData: FormData) {
  await requireAdmin();
  const branchId = formData.get('branchId')?.toString();

  if (!branchId) {
    return { error: 'Se requiere una sucursal.' };
  }

  const parsed = Number(branchId);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return { error: 'Sucursal inválida.' };
  }

  const branch = await branchService.getBranchById(parsed);

  if (!branch) {
    return { error: 'La sucursal seleccionada no existe.' };
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BRANCH_COOKIE, String(parsed), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  revalidatePath('/', 'layout');
  return null;
}
