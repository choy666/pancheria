import {
  getRateLimitStoreProvider,
  getPublicOrderRateLimitStoreProvider,
  getE2eEnableRateLimit,
  getPublicOrderRateLimitEnableInDev,
  getPublicRateLimitTrustPrivateIps,
  getLoginRateLimitMaxAttempts,
  getLoginRateLimitWindowMs,
} from './rate-limit';

describe('rate-limit config', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('getRateLimitStoreProvider devuelve undefined sin variable', () => {
    delete process.env.RATE_LIMIT_STORE_PROVIDER;
    expect(getRateLimitStoreProvider()).toBeUndefined();
  });

  test('getRateLimitStoreProvider respeta valores válidos', () => {
    process.env.RATE_LIMIT_STORE_PROVIDER = 'db';
    expect(getRateLimitStoreProvider()).toBe('db');
  });

  test('getRateLimitStoreProvider ignora valores inválidos', () => {
    process.env.RATE_LIMIT_STORE_PROVIDER = 'redis';
    expect(getRateLimitStoreProvider()).toBeUndefined();
  });

  test('getPublicOrderRateLimitStoreProvider respeta valores válidos', () => {
    process.env.PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER = 'db';
    expect(getPublicOrderRateLimitStoreProvider()).toBe('db');
  });

  test('getE2eEnableRateLimit solo se activa con true', () => {
    delete process.env.E2E_ENABLE_RATE_LIMIT;
    expect(getE2eEnableRateLimit()).toBe(false);
    process.env.E2E_ENABLE_RATE_LIMIT = 'true';
    expect(getE2eEnableRateLimit()).toBe(true);
  });

  test('getPublicOrderRateLimitEnableInDev solo se activa con true', () => {
    delete process.env.PUBLIC_ORDER_RATE_LIMIT_ENABLE_IN_DEV;
    expect(getPublicOrderRateLimitEnableInDev()).toBe(false);
    process.env.PUBLIC_ORDER_RATE_LIMIT_ENABLE_IN_DEV = 'true';
    expect(getPublicOrderRateLimitEnableInDev()).toBe(true);
  });

  test('getPublicRateLimitTrustPrivateIps solo se activa con true', () => {
    delete process.env.PUBLIC_RATE_LIMIT_TRUST_PRIVATE_IPS;
    expect(getPublicRateLimitTrustPrivateIps()).toBe(false);
    process.env.PUBLIC_RATE_LIMIT_TRUST_PRIVATE_IPS = 'true';
    expect(getPublicRateLimitTrustPrivateIps()).toBe(true);
  });

  test('getLoginRateLimitMaxAttempts usa el valor por defecto', () => {
    delete process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS;
    expect(getLoginRateLimitMaxAttempts()).toBe(5);
  });

  test('getLoginRateLimitMaxAttempts respeta la variable', () => {
    process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS = '10';
    expect(getLoginRateLimitMaxAttempts()).toBe(10);
  });

  test('getLoginRateLimitMaxAttempts ignora valores inválidos', () => {
    process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 'abc';
    expect(getLoginRateLimitMaxAttempts()).toBe(5);
    process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS = '0';
    expect(getLoginRateLimitMaxAttempts()).toBe(5);
  });

  test('getLoginRateLimitWindowMs usa el valor por defecto', () => {
    delete process.env.LOGIN_RATE_LIMIT_WINDOW_MS;
    expect(getLoginRateLimitWindowMs()).toBe(900000);
  });

  test('getLoginRateLimitWindowMs respeta la variable', () => {
    process.env.LOGIN_RATE_LIMIT_WINDOW_MS = '60000';
    expect(getLoginRateLimitWindowMs()).toBe(60000);
  });

  test('getLoginRateLimitWindowMs ignora valores inválidos', () => {
    process.env.LOGIN_RATE_LIMIT_WINDOW_MS = '-1';
    expect(getLoginRateLimitWindowMs()).toBe(900000);
  });
});
