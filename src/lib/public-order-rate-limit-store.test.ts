import {
  InMemoryPublicOrderRateLimitStore,
  DbPublicOrderRateLimitStore,
} from './public-order-rate-limit-store';

jest.mock('@/db', () => ({
  db: {
    query: {
      publicOrderRateLimits: {
        findFirst: jest.fn(),
      },
    },
    delete: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
  },
}));

import { db } from '@/db';

const mockedDb = db as unknown as {
  query: {
    publicOrderRateLimits: {
      findFirst: jest.Mock;
    };
  };
  delete: jest.Mock;
  where: jest.Mock;
};

describe('InMemoryPublicOrderRateLimitStore', () => {
  let store: InMemoryPublicOrderRateLimitStore;

  beforeEach(() => {
    store = new InMemoryPublicOrderRateLimitStore();
  });

  test('get devuelve undefined cuando no hay registro', async () => {
    const record = await store.get('192.168.1.1');
    expect(record).toBeUndefined();
  });

  test('set y get guardan y recuperan un registro', async () => {
    const record = { count: 3, resetAt: Date.now() + 60_000 };
    await store.set('192.168.1.1', record);

    const retrieved = await store.get('192.168.1.1');
    expect(retrieved).toEqual(record);
  });

  test('delete elimina un registro', async () => {
    await store.set('192.168.1.1', { count: 1, resetAt: Date.now() });
    await store.delete('192.168.1.1');

    const record = await store.get('192.168.1.1');
    expect(record).toBeUndefined();
  });
});

describe('DbPublicOrderRateLimitStore', () => {
  let store: DbPublicOrderRateLimitStore;

  beforeEach(() => {
    jest.clearAllMocks();
    store = new DbPublicOrderRateLimitStore();
  });

  test('get devuelve undefined cuando no hay registro', async () => {
    mockedDb.query.publicOrderRateLimits.findFirst.mockResolvedValue(undefined);

    const record = await store.get('192.168.1.1');
    expect(record).toBeUndefined();
    expect(mockedDb.delete).not.toHaveBeenCalled();
  });

  test('get devuelve registro vigente', async () => {
    const resetAt = Date.now() + 60_000;
    mockedDb.query.publicOrderRateLimits.findFirst.mockResolvedValue({
      ip: '192.168.1.1',
      count: 2,
      resetAt,
    });

    const record = await store.get('192.168.1.1');
    expect(record).toEqual({ count: 2, resetAt });
    expect(mockedDb.delete).not.toHaveBeenCalled();
  });

  test('get borra y devuelve undefined cuando el registro ya vencio', async () => {
    mockedDb.query.publicOrderRateLimits.findFirst.mockResolvedValue({
      ip: '192.168.1.1',
      count: 2,
      resetAt: Date.now() - 1,
    });

    const record = await store.get('192.168.1.1');
    expect(record).toBeUndefined();
    expect(mockedDb.delete).toHaveBeenCalled();
  });
});
