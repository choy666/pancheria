import { eq, and, isNull, asc } from 'drizzle-orm';
import { db } from '@/db';
import { cashRegisters } from '@/db/schema';

export async function lockCashRegisterById(
  tx: typeof db,
  branchId: number,
  id: number,
  options: { requireOpen?: boolean; requireNotDeleted?: boolean } = {}
): Promise<typeof cashRegisters.$inferSelect | null> {
  const conditions: ReturnType<typeof eq>[] = [
    eq(cashRegisters.id, id),
    eq(cashRegisters.branchId, branchId),
  ];

  if (options.requireOpen) {
    conditions.push(eq(cashRegisters.status, 'open'));
  }

  if (options.requireNotDeleted) {
    conditions.push(isNull(cashRegisters.deletedAt));
  }

  const [locked] = await tx
    .select()
    .from(cashRegisters)
    .where(and(...conditions))
    .for('update');

  return locked ?? null;
}

export async function lockOpenCashRegister(
  tx: typeof db,
  branchId: number
): Promise<typeof cashRegisters.$inferSelect | null> {
  const [locked] = await tx
    .select()
    .from(cashRegisters)
    .where(
      and(
        eq(cashRegisters.branchId, branchId),
        eq(cashRegisters.status, 'open'),
        isNull(cashRegisters.deletedAt)
      )
    )
    .orderBy(asc(cashRegisters.id))
    .for('update');

  return locked ?? null;
}
