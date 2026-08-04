import { db } from '@/db';

export async function executeInTransaction<T>(
  fn: (tx: typeof db) => Promise<T>
): Promise<T> {
  return await db.transaction(async (tx) => {
    return await fn(tx as unknown as typeof db);
  });
}
