import { and, eq, not } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { db } from '@/db';
import { users } from '@/db/schema';
import * as branchService from '@/application/services/branchService';
import { ValidationError, NotFoundError } from '@/domain/errors';

type UserRole = 'admin' | 'operator';

export async function getUserById(id: number) {
  return db.query.users.findFirst({
    where: eq(users.id, id),
    with: { branch: true },
  });
}

export async function listUsers(branchId?: number) {
  return db.query.users.findMany({
    where: branchId ? eq(users.branchId, branchId) : undefined,
    with: { branch: true },
    orderBy: (users, { desc }) => [desc(users.createdAt)],
  });
}

export async function createUser(data: {
  username: string;
  password: string;
  role: UserRole;
  branchId: number;
}) {
  const username = data.username.trim();

  if (!username) {
    throw new ValidationError('El nombre de usuario es obligatorio.');
  }

  if (data.password.length < 4) {
    throw new ValidationError('La contraseña debe tener al menos 4 caracteres.');
  }

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

  const existing = await db.query.users.findFirst({
    where: eq(users.username, username),
  });

  if (existing) {
    throw new ValidationError('Ya existe un usuario con ese nombre.');
  }

  const passwordHash = await bcrypt.hash(data.password, 10);

  const [user] = await db
    .insert(users)
    .values({
      username,
      passwordHash,
      role: data.role,
      branchId: data.branchId,
    })
    .returning();

  if (!user) {
    throw new Error('No se pudo crear el usuario.');
  }

  return user;
}

export async function updateUser(
  id: number,
  data: {
    username?: string;
    branchId?: number;
  }
) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, id),
  });

  if (!user) {
    throw new NotFoundError('Usuario', id);
  }

  if (user.role === 'admin') {
    throw new ValidationError('No se puede editar el administrador inicial.');
  }

  const updates: Partial<typeof users.$inferInsert> = {};

  if (data.username !== undefined) {
    const username = data.username.trim();
    if (!username) {
      throw new ValidationError('El nombre de usuario es obligatorio.');
    }

    const existing = await db.query.users.findFirst({
      where: and(eq(users.username, username), not(eq(users.id, id))),
    });

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

  if (Object.keys(updates).length === 0) {
    return user;
  }

  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, id))
    .returning();

  if (!updated) {
    throw new Error('No se pudo actualizar el usuario.');
  }

  return updated;
}

export async function resetUserPassword(id: number, password: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, id),
  });

  if (!user) {
    throw new NotFoundError('Usuario', id);
  }

  if (password.length < 4) {
    throw new ValidationError('La contraseña debe tener al menos 4 caracteres.');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const [updated] = await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.id, id))
    .returning();

  if (!updated) {
    throw new Error('No se pudo actualizar la contraseña.');
  }

  return updated;
}

export async function deleteUser(id: number) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, id),
  });

  if (!user) {
    throw new NotFoundError('Usuario', id);
  }

  if (user.role === 'admin') {
    throw new ValidationError('No se puede eliminar el administrador inicial.');
  }

  await db.delete(users).where(eq(users.id, id));
}
