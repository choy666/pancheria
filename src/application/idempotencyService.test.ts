import { isIdempotencyKeyUsed } from './idempotencyService';
import { db } from '@/db';

jest.mock('@/db', () => ({
  db: {
    query: {
      sales: {
        findFirst: jest.fn(),
      },
      orders: {
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
    orders: {
      findFirst: jest.Mock;
    };
  };
};

const BRANCH_ID = 1;

function scopedKey(key: string) {
  return `${BRANCH_ID}:${key}`;
}

describe('idempotencyService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve true si la clave de idempotencia de venta ya fue usada', async () => {
    mockedDb.query.sales.findFirst.mockResolvedValue({
      id: 1,
      idempotencyKey: scopedKey('key-123'),
    } as any);

    const result = await isIdempotencyKeyUsed(
      'sale',
      BRANCH_ID,
      scopedKey('key-123')
    );

    expect(result).toBe(true);
    expect(mockedDb.query.sales.findFirst).toHaveBeenCalled();
  });

  test('devuelve false si la clave de idempotencia de venta no fue usada', async () => {
    mockedDb.query.sales.findFirst.mockResolvedValue(undefined);

    const result = await isIdempotencyKeyUsed(
      'sale',
      BRANCH_ID,
      scopedKey('key-nueva')
    );

    expect(result).toBe(false);
    expect(mockedDb.query.sales.findFirst).toHaveBeenCalled();
  });

  test('devuelve true si la clave de idempotencia de pedido ya fue usada', async () => {
    mockedDb.query.orders.findFirst.mockResolvedValue({
      id: 1,
      idempotencyKey: scopedKey('key-123'),
    } as any);

    const result = await isIdempotencyKeyUsed(
      'order',
      BRANCH_ID,
      scopedKey('key-123')
    );

    expect(result).toBe(true);
    expect(mockedDb.query.orders.findFirst).toHaveBeenCalled();
  });

  test('devuelve false si la clave de idempotencia de pedido no fue usada', async () => {
    mockedDb.query.orders.findFirst.mockResolvedValue(undefined);

    const result = await isIdempotencyKeyUsed(
      'order',
      BRANCH_ID,
      scopedKey('key-nueva')
    );

    expect(result).toBe(false);
    expect(mockedDb.query.orders.findFirst).toHaveBeenCalled();
  });
});
