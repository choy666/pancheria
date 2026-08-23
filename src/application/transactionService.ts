import { AsyncLocalStorage } from 'async_hooks';
import { db } from '@/db';

const transactionStorage = new AsyncLocalStorage<typeof db>();

export function getCurrentTransaction(): typeof db | undefined {
  return transactionStorage.getStore();
}

export async function executeInTransaction<T>(
  fn: (tx: typeof db) => Promise<T>
): Promise<T> {
  return await db.transaction(async (tx) => {
    return await transactionStorage.run(
      tx as unknown as typeof db,
      async () => await fn(tx as unknown as typeof db)
    );
  });
}
