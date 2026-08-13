'use server';

import { revalidatePath } from 'next/cache';
import * as userService from '@/application/services/userService';
import { requireAdmin } from '@/lib/auth';
import { DomainError } from '@/domain/errors';

export type UserState = { error: string } | null;

export async function listUsers() {
  await requireAdmin();
  return userService.listUsers();
}

export async function createUser(
  _prevState: UserState,
  formData: FormData
): Promise<UserState> {
  await requireAdmin();

  const username = formData.get('username')?.toString() ?? '';
  const password = formData.get('password')?.toString() ?? '';
  const branchId = Number(formData.get('branchId'));

  try {
    await userService.createUser({
      username,
      password,
      role: 'operator',
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

export async function updateUserAction(
  _prevState: UserState,
  formData: FormData
): Promise<UserState> {
  await requireAdmin();

  const id = Number(formData.get('id'));
  const username = formData.get('username')?.toString().trim();
  const branchIdRaw = formData.get('branchId')?.toString();

  try {
    await userService.updateUser(id, {
      username,
      branchId: branchIdRaw ? Number(branchIdRaw) : undefined,
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

export async function resetUserPasswordAction(
  _prevState: UserState,
  formData: FormData
): Promise<UserState> {
  await requireAdmin();

  const id = Number(formData.get('id'));
  const password = formData.get('password')?.toString() ?? '';

  try {
    await userService.resetUserPassword(id, password);
  } catch (error) {
    if (error instanceof DomainError) {
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath('/usuarios');
  return null;
}

export async function deleteUserAction(
  _prevState: UserState,
  formData: FormData
): Promise<UserState> {
  await requireAdmin();

  const id = Number(formData.get('id'));

  try {
    await userService.deleteUser(id);
  } catch (error) {
    if (error instanceof DomainError) {
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath('/usuarios');
  return null;
}
