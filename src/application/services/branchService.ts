import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { branches } from '@/db/schema';
import { ValidationError } from '@/domain/errors';

export async function listBranches() {
  return db.query.branches.findMany({
    orderBy: (branches, { desc }) => [desc(branches.createdAt)],
  });
}

export async function getBranchById(id: number) {
  return db.query.branches.findFirst({
    where: eq(branches.id, id),
  });
}

export async function createBranch(name: string) {
  const trimmed = name.trim();

  if (!trimmed) {
    throw new ValidationError('El nombre de la sucursal es obligatorio.');
  }

  const existing = await db.query.branches.findFirst({
    where: eq(branches.name, trimmed),
  });

  if (existing) {
    throw new ValidationError('Ya existe una sucursal con ese nombre.');
  }

  const [branch] = await db
    .insert(branches)
    .values({ name: trimmed })
    .returning();

  if (!branch) {
    throw new Error('No se pudo crear la sucursal.');
  }

  return branch;
}
