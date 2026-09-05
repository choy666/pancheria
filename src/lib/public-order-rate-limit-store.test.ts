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
    const blocked = await store.recordRequest('pedido', '192.168.1.1', 60_000, 10);
    expect(blocked).toBe(false);
  });

  test('bloquea cuando se supera el límite', async () => {
    for (let i = 0; i < 10; i += 1) {
      await store.recordRequest('pedido', '192.168.1.1', 60_000, 10);
    }

    const blocked = await store.recordRequest('pedido', '192.168.1.1', 60_000, 10);
    expect(blocked).toBe(true);
  });

  test('reinicia el contador después de la ventana', async () => {
    const windowMs = 1;

    for (let i = 0; i < 10; i += 1) {
      await store.recordRequest('pedido', '192.168.1.1', windowMs, 10);
    }

    await new Promise((resolve) => setTimeout(resolve, 10));

    const blocked = await store.recordRequest('pedido', '192.168.1.1', windowMs, 10);
    expect(blocked).toBe(false);
  });

  test('limpia registros expirados periódicamente', async () => {
    const expiredIp = '192.168.1.1';

    await store.recordRequest('pedido', expiredIp, 1, 10);
    await new Promise((resolve) => setTimeout(resolve, 10));

    // 99 requests con ventana larga para que no expiren.
    for (let i = 0; i < 99; i += 1) {
      await store.recordRequest('pedido', `10.0.0.${i % 256}`, 60_000, 1000);
    }

    // El request 100 activa la limpieza y debe eliminar el registro vencido.
    await store.recordRequest('pedido', '10.0.0.100', 60_000, 1000);

    const deleted = await store.cleanupExpired();
    expect(deleted).toBe(0);
    expect((store as unknown as { attemptsByScopeAndIp: Map<string, unknown> }).attemptsByScopeAndIp.has(`pedido:${expiredIp}`)).toBe(false);
  });

  test('no mezcla contadores entre scopes', async () => {
    for (let i = 0; i < 10; i += 1) {
      await store.recordRequest('chat', '192.168.1.1', 60_000, 10);
    }

    const blocked = await store.recordRequest('pedido', '192.168.1.1', 60_000, 10);
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

    const blocked = await store.recordRequest('pedido', '192.168.1.1', 60_000, 10);

    expect(blocked).toBe(true);
    expect(mockedDb.insert).toHaveBeenCalled();
    expect(mockedDb.onConflictDoUpdate).toHaveBeenCalled();
    expect(mockedDb.returning).toHaveBeenCalled();
  });

  test('recordRequest permite el request si no supera el límite', async () => {
    mockedDb.returning.mockResolvedValue([{ count: 1 }]);

    const blocked = await store.recordRequest('pedido', '192.168.1.1', 60_000, 10);

    expect(blocked).toBe(false);
  });
});
