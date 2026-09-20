import { and, count, eq, not } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { getCurrentTransaction } from '@/application/transactionService';
import type { PaginationParams } from '@/domain/types';

export type UserInsert = typeof users.$inferInsert;
export type UserUpdate = Partial<UserInsert>;

function resolveClient(dbOrTx?: typeof db) {
  return dbOrTx ?? getCurrentTransaction() ?? db;
}

export async function findAll(
  branchId?: number,
  pagination?: PaginationParams
) {
  const where = branchId ? eq(users.branchId, branchId) : undefined;

  const [{ count: total }] = await db
    .select({ count: count() })
    .from(users)
    .where(where);

  const items = await db.query.users.findMany({
    where,
    with: { branch: true },
    orderBy: (users, { desc }) => [desc(users.createdAt)],
    limit: pagination?.limit,
    offset: pagination ? (pagination.page - 1) * pagination.limit : undefined,
  });

  return {
    items,
    total: Number(total),
    page: pagination?.page ?? 1,
    limit: pagination?.limit ?? Number(total),
  };
}

export async function findById(id: number, dbOrTx?: typeof db) {
  return resolveClient(dbOrTx).query.users.findFirst({
    where: eq(users.id, id),
  });
}

export async function findByUsername(username: string) {
  return db.query.users.findFirst({
    where: eq(users.username, username),
  });
}

export async function findByUsernameWithBranch(username: string) {
  return db.query.users.findFirst({
    where: eq(users.username, username),
    with: { branch: true },
  });
}

export async function findByUsernameExcludingId(
  username: string,
  excludeId: number
) {
  return db.query.users.findFirst({
    where: and(eq(users.username, username), not(eq(users.id, excludeId))),
  });
}

export async function insert(values: UserInsert) {
  const [row] = await db.insert(users).values(values).returning();
  return row ?? null;
}

export async function update(
  id: number,
  data: UserUpdate,
  dbOrTx?: typeof db
) {
  const [row] = await resolveClient(dbOrTx)
    .update(users)
    .set(data)
    .where(eq(users.id, id))
    .returning();
  return row ?? null;
}

export async function deleteById(id: number) {
  await db.delete(users).where(eq(users.id, id));
}
