import { executeInTransaction } from './transactionService';
import { db } from '@/db';

jest.mock('@/db', () => ({
  db: {
    transaction: jest.fn(),
  },
}));

const mockedDb = db as unknown as {
  transaction: jest.Mock;
};

describe('transactionService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('executeInTransaction invoca el callback con la transacción', async () => {
    const mockTx = { id: 'tx-123' };
    mockedDb.transaction.mockImplementation(async (fn: any) => {
      return await fn(mockTx);
    });

    const callback = jest.fn(async (tx: any) => {
      expect(tx).toBe(mockTx);
      return 'resultado';
    });

    const result = await executeInTransaction(callback as any);

    expect(result).toBe('resultado');
    expect(callback).toHaveBeenCalledWith(mockTx);
    expect(mockedDb.transaction).toHaveBeenCalled();
  });

  test('executeInTransaction es reentrante y reutiliza la transacción activa', async () => {
    const mockTx = { id: 'tx-123' };
    mockedDb.transaction.mockImplementation(async (fn: any) => {
      return await fn(mockTx);
    });

    const inner = jest.fn(async (tx: any) => {
      expect(tx).toBe(mockTx);
      return 'interno';
    });

    const result = await executeInTransaction(async (tx: any) => {
      const innerResult = await executeInTransaction(inner);
      expect(innerResult).toBe('interno');
      expect(tx).toBe(mockTx);
      return 'externo';
    });

    expect(result).toBe('externo');
    expect(mockedDb.transaction).toHaveBeenCalledTimes(1);
    expect(inner).toHaveBeenCalledWith(mockTx);
  });
});
