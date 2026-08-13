import { isIdempotencyKeyUsed } from './idempotencyService';
import { db } from '@/db';

jest.mock('@/db', () => ({
  db: {
    query: {
      sales: {
        findFirst: jest.fn(),
      },
    },
  },
}));

const mockedDb = db as unknown as {
  query: {
    sales: {
      findFirst: jest.Mock;
    };
  };
};

const BRANCH_ID = 1;

describe('idempotencyService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve true si la clave de idempotencia ya fue usada', async () => {
    mockedDb.query.sales.findFirst.mockResolvedValue({
      id: 1,
      idempotencyKey: 'key-123',
    } as any);

    const result = await isIdempotencyKeyUsed(BRANCH_ID, 'key-123');

    expect(result).toBe(true);
    expect(mockedDb.query.sales.findFirst).toHaveBeenCalled();
  });

  test('devuelve false si la clave de idempotencia no fue usada', async () => {
    mockedDb.query.sales.findFirst.mockResolvedValue(undefined);

    const result = await isIdempotencyKeyUsed(BRANCH_ID, 'key-nueva');

    expect(result).toBe(false);
    expect(mockedDb.query.sales.findFirst).toHaveBeenCalled();
  });
});
