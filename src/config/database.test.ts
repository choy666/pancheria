import {
  getDbPoolMax,
  getDbConnectionTimeoutMs,
  getDbIdleTimeoutMs,
} from './database';

describe('database config', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('getDbPoolMax devuelve undefined sin variable', () => {
    delete process.env.DATABASE_POOL_MAX;
    expect(getDbPoolMax()).toBeUndefined();
  });

  test('getDbPoolMax respeta la variable', () => {
    process.env.DATABASE_POOL_MAX = '5';
    expect(getDbPoolMax()).toBe(5);
  });

  test('getDbPoolMax ignora valores inválidos', () => {
    process.env.DATABASE_POOL_MAX = 'abc';
    expect(getDbPoolMax()).toBeUndefined();
    process.env.DATABASE_POOL_MAX = '0';
    expect(getDbPoolMax()).toBeUndefined();
    process.env.DATABASE_POOL_MAX = '-3';
    expect(getDbPoolMax()).toBeUndefined();
  });

  test('getDbConnectionTimeoutMs devuelve undefined sin variable', () => {
    delete process.env.DATABASE_CONNECTION_TIMEOUT_MS;
    expect(getDbConnectionTimeoutMs()).toBeUndefined();
  });

  test('getDbConnectionTimeoutMs respeta la variable', () => {
    process.env.DATABASE_CONNECTION_TIMEOUT_MS = '3000';
    expect(getDbConnectionTimeoutMs()).toBe(3000);
  });

  test('getDbConnectionTimeoutMs ignora valores inválidos', () => {
    process.env.DATABASE_CONNECTION_TIMEOUT_MS = 'abc';
    expect(getDbConnectionTimeoutMs()).toBeUndefined();
  });

  test('getDbIdleTimeoutMs devuelve undefined sin variable', () => {
    delete process.env.DATABASE_IDLE_TIMEOUT_MS;
    expect(getDbIdleTimeoutMs()).toBeUndefined();
  });

  test('getDbIdleTimeoutMs respeta la variable', () => {
    process.env.DATABASE_IDLE_TIMEOUT_MS = '10000';
    expect(getDbIdleTimeoutMs()).toBe(10000);
  });

  test('getDbIdleTimeoutMs ignora valores inválidos', () => {
    process.env.DATABASE_IDLE_TIMEOUT_MS = '-1';
    expect(getDbIdleTimeoutMs()).toBeUndefined();
  });
});
