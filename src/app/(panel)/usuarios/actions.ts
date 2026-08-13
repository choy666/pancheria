'use server';

import { revalidatePath } from 'next/cache';
import * as userService from '@/application/services/userService';
import { requireAdmin } from '@/lib/auth';
import { DomainError } from '@/domain/errors';

export type UserState = { error: string } | null;

export async function listUsers() {
  const session = await requireAdmin();
  return userService.listUsers(session.user.branchId);
}

export async function createUser(
  _prevState: UserState,
  formData: FormData
): Promise<UserState> {
  await requireAdmin();

  const username = formData.get('username')?.toString() ?? '';
  const password = formData.get('password')?.toString() ?? '';
  const role = formData.get('role')?.toString() ?? 'operator';
  const branchId = Number(formData.get('branchId'));

  try {
    await userService.createUser({
      username,
      password,
      role: role === 'admin' ? 'admin' : 'operator',
      branchId,
    });
  } catch (error) {
    if (error instanceof DomainError) {
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath('/usuarios');
  return null;
}
