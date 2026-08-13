import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { db } from '@/db';
import { users } from '@/db/schema';
import * as branchService from '@/application/services/branchService';
import { ValidationError } from '@/domain/errors';

type UserRole = 'admin' | 'operator';

export async function listUsers(branchId: number) {
  return db.query.users.findMany({
    where: eq(users.branchId, branchId),
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
