import {
  InMemoryPublicOrderRateLimitStore,
  DbPublicOrderRateLimitStore,
} from './public-order-rate-limit-store';

jest.mock('@/db', () => ({
  db: {
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    onConflictDoUpdate: jest.fn().mockReturnThis(),
    returning: jest.fn(),
    delete: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
  },
}));

import { db } from '@/db';

const mockedDb = db as unknown as {
  insert: jest.Mock;
  onConflictDoUpdate: jest.Mock;
  returning: jest.Mock;
  delete: jest.Mock;
  where: jest.Mock;
};

describe('InMemoryPublicOrderRateLimitStore', () => {
  let store: InMemoryPublicOrderRateLimitStore;

  beforeEach(() => {
    store = new InMemoryPublicOrderRateLimitStore();
  });

  test('permite el primer request', async () => {
    const blocked = await store.recordRequest('192.168.1.1', 60_000, 10);
    expect(blocked).toBe(false);
  });

  test('bloquea cuando se supera el límite', async () => {
    for (let i = 0; i < 10; i += 1) {
      await store.recordRequest('192.168.1.1', 60_000, 10);
    }

    const blocked = await store.recordRequest('192.168.1.1', 60_000, 10);
    expect(blocked).toBe(true);
  });

  test('reinicia el contador después de la ventana', async () => {
    const windowMs = 1;

    for (let i = 0; i < 10; i += 1) {
      await store.recordRequest('192.168.1.1', windowMs, 10);
    }

    await new Promise((resolve) => setTimeout(resolve, 10));

    const blocked = await store.recordRequest('192.168.1.1', windowMs, 10);
    expect(blocked).toBe(false);
  });
});

describe('DbPublicOrderRateLimitStore', () => {
  let store: DbPublicOrderRateLimitStore;

  beforeEach(() => {
    jest.clearAllMocks();
    store = new DbPublicOrderRateLimitStore();
  });

  test('recordRequest devuelve si el IP superó el límite', async () => {
    mockedDb.returning.mockResolvedValue([{ count: 11 }]);

    const blocked = await store.recordRequest('192.168.1.1', 60_000, 10);

    expect(blocked).toBe(true);
    expect(mockedDb.insert).toHaveBeenCalled();
    expect(mockedDb.onConflictDoUpdate).toHaveBeenCalled();
    expect(mockedDb.returning).toHaveBeenCalled();
  });

  test('recordRequest permite el request si no supera el límite', async () => {
    mockedDb.returning.mockResolvedValue([{ count: 1 }]);

    const blocked = await store.recordRequest('192.168.1.1', 60_000, 10);

    expect(blocked).toBe(false);
  });
});
