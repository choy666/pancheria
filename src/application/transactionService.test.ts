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
});
