import bcrypt from 'bcrypt';
import { users } from '@/db/schema';
import { executeInTransaction } from '@/application/transactionService';
import * as branchService from '@/application/services/branchService';
import * as userRepository from '@/repositories/userRepository';
import { getRateLimitStore } from '@/lib/rate-limit-store';
import { DomainError, ValidationError, NotFoundError } from '@/domain/errors';
import {
  validateNonEmptyString,
  validateMinLength,
} from '@/lib/validation-helpers';

type UserRole = 'admin' | 'operator';

export async function listUsers(branchId?: number) {
  return userRepository.findAll(branchId);
}

export async function createUser(data: {
  username: string;
  password: string;
  role: UserRole;
  branchId: number;
}) {
  const username = validateNonEmptyString(
    data.username,
    'El nombre de usuario'
  );

  validateMinLength(data.password, 6, 'La contraseña');

  if (data.role !== 'operator') {
    throw new ValidationError('Solo se permiten usuarios operador.');
  }

  if (!data.branchId) {
    throw new ValidationError('Debe seleccionar una sucursal.');
  }

  const branch = await branchService.getBranchById(data.branchId);

  if (!branch) {
    throw new ValidationError('La sucursal seleccionada no existe.');
  }

  const existing = await userRepository.findByUsername(username);

  if (existing) {
    throw new ValidationError('Ya existe un usuario con ese nombre.');
  }

  const passwordHash = await bcrypt.hash(data.password, 10);

  const user = await userRepository.insert({
    username,
    passwordHash,
    role: data.role,
    branchId: data.branchId,
  });

  if (!user) {
    throw new DomainError('No se pudo crear el usuario.');
  }

  return user;
}

export async function updateUser(
  id: number,
  data: {
    username?: string;
    branchId?: number;
    password?: string;
  }
) {
  const user = await userRepository.findById(id);

  if (!user) {
    throw new NotFoundError('Usuario', id);
  }

  if (user.role === 'admin') {
    throw new ValidationError('No se puede editar el administrador inicial.');
  }

  const updates: Partial<typeof users.$inferInsert> = {};

  if (data.username !== undefined) {
    const username = validateNonEmptyString(data.username, 'El nombre de usuario');

    const existing = await userRepository.findByUsernameExcludingId(
      username,
      id
    );

    if (existing) {
      throw new ValidationError('Ya existe otro usuario con ese nombre.');
    }

    updates.username = username;
  }

  if (data.branchId !== undefined) {
    if (!data.branchId) {
      throw new ValidationError('Debe seleccionar una sucursal.');
    }

    const branch = await branchService.getBranchById(data.branchId);

    if (!branch) {
      throw new ValidationError('La sucursal seleccionada no existe.');
    }

    updates.branchId = data.branchId;
  }

  if (data.password !== undefined && data.password.length > 0) {
    validateMinLength(data.password, 6, 'La contraseña');

    updates.passwordHash = await bcrypt.hash(data.password, 10);
  }

  if (Object.keys(updates).length === 0) {
    return user;
  }

  const updated = await userRepository.update(id, updates);

  if (!updated) {
    throw new DomainError('No se pudo actualizar el usuario.');
  }

  return updated;
}

export async function deleteUser(id: number) {
  const user = await userRepository.findById(id);

  if (!user) {
    throw new NotFoundError('Usuario', id);
  }

  if (user.role === 'admin') {
    throw new ValidationError('No se puede eliminar el administrador inicial.');
  }

  await userRepository.deleteById(id);

  const rateLimitStore = getRateLimitStore();
  await rateLimitStore.remove(user.username);
}

export async function findById(id: number) {
  return userRepository.findById(id);
}

export async function updatePassword(
  id: number,
  newPassword: string
): Promise<typeof users.$inferSelect> {
  validateMinLength(newPassword, 6, 'La contraseña');

  return executeInTransaction(async (tx) => {
    const user = await userRepository.findById(id, tx);

    if (!user) {
      throw new NotFoundError('Usuario', id);
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    const updated = await userRepository.update(
      user.id,
      { passwordHash },
      tx
    );

    if (!updated) {
      throw new DomainError('No se pudo actualizar la contraseña.');
    }

    return updated;
  });
}
