'use server';

import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { auth } from '@/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { DomainError, NotFoundError, ValidationError } from '@/domain/errors';
import {
  validateMinLength,
  validateNonEmptyString,
} from '@/lib/validation-helpers';

export type ChangePasswordState = { success?: string; error?: string } | null;

export async function changePassword(
  _prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const session = await auth();

  if (!session?.user) {
    return { error: 'Se requiere iniciar sesión.' };
  }

  const userId = Number(session.user.id);

  try {
    const currentPassword = formData.get('currentPassword')?.toString() ?? '';
    const newPassword = formData.get('newPassword')?.toString() ?? '';
    const confirmPassword = formData.get('confirmPassword')?.toString() ?? '';

    validateNonEmptyString(currentPassword, 'La contraseña actual');
    validateNonEmptyString(newPassword, 'La nueva contraseña');
    validateMinLength(newPassword, 6, 'La nueva contraseña');

    if (newPassword !== confirmPassword) {
      throw new ValidationError('Las contraseñas nuevas no coinciden.');
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new NotFoundError('Usuario', userId);
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!isValid) {
      throw new ValidationError('La contraseña actual es incorrecta.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));

    return { success: 'Contraseña actualizada correctamente.' };
  } catch (error) {
    if (error instanceof DomainError) {
      return { error: error.message };
    }

    throw error;
  }
}
