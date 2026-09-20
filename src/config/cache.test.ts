import { getDataCacheRevalidateSeconds } from './cache';

describe('cache config', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('getDataCacheRevalidateSeconds usa el valor por defecto', () => {
    delete process.env.DATA_CACHE_REVALIDATE_S;
    expect(getDataCacheRevalidateSeconds()).toBe(60);
  });

  test('getDataCacheRevalidateSeconds respeta el valor configurado', () => {
    process.env.DATA_CACHE_REVALIDATE_S = '120';
    expect(getDataCacheRevalidateSeconds()).toBe(120);
  });

  test('getDataCacheRevalidateSeconds devuelve 0 cuando está deshabilitado', () => {
    process.env.DATA_CACHE_REVALIDATE_S = '0';
    expect(getDataCacheRevalidateSeconds()).toBe(0);
  });

  test('getDataCacheRevalidateSeconds vuelve al default ante valores inválidos', () => {
    process.env.DATA_CACHE_REVALIDATE_S = 'abc';
    expect(getDataCacheRevalidateSeconds()).toBe(60);
  });
});
