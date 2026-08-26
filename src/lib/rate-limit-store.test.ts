import {
  InMemoryRateLimitStore,
  createRateLimitStore,
} from './rate-limit-store';

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

describe('InMemoryRateLimitStore', () => {
  let store: InMemoryRateLimitStore;

  beforeEach(() => {
    store = new InMemoryRateLimitStore();
  });

  test('permite el primer intento fallido', async () => {
    const blocked = await store.recordFailedAttempt('admin', 60_000, 5);
    expect(blocked).toBe(false);
  });

  test('bloquea cuando se supera el límite', async () => {
    for (let i = 0; i < 5; i += 1) {
      await store.recordFailedAttempt('admin', 60_000, 5);
    }

    const blocked = await store.recordFailedAttempt('admin', 60_000, 5);
    expect(blocked).toBe(true);
  });

  test('reinicia el contador después de la ventana', async () => {
    const windowMs = 1;

    for (let i = 0; i < 5; i += 1) {
      await store.recordFailedAttempt('admin', windowMs, 5);
    }

    await new Promise((resolve) => setTimeout(resolve, 10));

    const blocked = await store.recordFailedAttempt('admin', windowMs, 5);
    expect(blocked).toBe(false);
  });

  test('elimina los intentos tras un login exitoso', async () => {
    await store.recordFailedAttempt('admin', 60_000, 5);
    await store.recordSuccessfulAttempt('admin');

    const blocked = await store.recordFailedAttempt('admin', 60_000, 5);
    expect(blocked).toBe(false);
  });
});

describe('DbRateLimitStore (vía createRateLimitStore)', () => {
  const originalProvider = process.env.RATE_LIMIT_STORE_PROVIDER;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.RATE_LIMIT_STORE_PROVIDER = 'db';
  });

  afterEach(() => {
    process.env.RATE_LIMIT_STORE_PROVIDER = originalProvider;
  });

  test('recordFailedAttempt devuelve si se superó el límite', async () => {
    mockedDb.returning.mockResolvedValue([{ count: 6 }]);

    const store = createRateLimitStore();
    const blocked = await store.recordFailedAttempt('admin', 60_000, 5);

    expect(blocked).toBe(true);
    expect(mockedDb.insert).toHaveBeenCalled();
    expect(mockedDb.onConflictDoUpdate).toHaveBeenCalled();
    expect(mockedDb.returning).toHaveBeenCalled();
  });

  test('recordFailedAttempt permite si no se supera el límite', async () => {
    mockedDb.returning.mockResolvedValue([{ count: 1 }]);

    const store = createRateLimitStore();
    const blocked = await store.recordFailedAttempt('admin', 60_000, 5);

    expect(blocked).toBe(false);
  });

  test('recordSuccessfulAttempt elimina los intentos del usuario', async () => {
    mockedDb.returning.mockResolvedValue([{ count: 1 }]);

    const store = createRateLimitStore();
    await store.recordSuccessfulAttempt('admin');

    expect(mockedDb.delete).toHaveBeenCalled();
    expect(mockedDb.where).toHaveBeenCalled();
  });
});

describe('createRateLimitStore', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDbUrl = process.env.DATABASE_URL;
  const originalProvider = process.env.RATE_LIMIT_STORE_PROVIDER;

  afterEach(() => {
    Object.assign(process.env, { NODE_ENV: originalNodeEnv });
    process.env.DATABASE_URL = originalDbUrl;
    process.env.RATE_LIMIT_STORE_PROVIDER = originalProvider;
  });

  test('usa db cuando el proveedor es db', () => {
    process.env.RATE_LIMIT_STORE_PROVIDER = 'db';
    const store = createRateLimitStore();
    expect(store.recordFailedAttempt).toBeDefined();
    expect(store.recordSuccessfulAttempt).toBeDefined();
  });

  test('usa memory cuando el proveedor es memory', () => {
    process.env.RATE_LIMIT_STORE_PROVIDER = 'memory';
    const store = createRateLimitStore();
    expect(store).toBeInstanceOf(InMemoryRateLimitStore);
  });

  test('usa memory en test por defecto', () => {
    Object.assign(process.env, { NODE_ENV: 'test' });
    delete process.env.RATE_LIMIT_STORE_PROVIDER;
    const store = createRateLimitStore();
    expect(store).toBeInstanceOf(InMemoryRateLimitStore);
  });

  test('usa db en producción si hay base de datos', () => {
    Object.assign(process.env, { NODE_ENV: 'production' });
    process.env.DATABASE_URL = 'postgresql://localhost/test';
    delete process.env.RATE_LIMIT_STORE_PROVIDER;
    const store = createRateLimitStore();
    expect(store.recordFailedAttempt).toBeDefined();
    expect(store.recordSuccessfulAttempt).toBeDefined();
  });

  test('usa memory en producción si no hay base de datos', () => {
    Object.assign(process.env, { NODE_ENV: 'production' });
    delete process.env.DATABASE_URL;
    delete process.env.RATE_LIMIT_STORE_PROVIDER;
    const store = createRateLimitStore();
    expect(store).toBeInstanceOf(InMemoryRateLimitStore);
  });
});
