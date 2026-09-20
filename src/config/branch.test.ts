import {
  getPublicBranchStatusCacheSMaxage,
  getPublicBranchStatusCacheSwr,
} from './branch';

describe('branch config', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('getPublicBranchStatusCacheSMaxage usa el valor por defecto', () => {
    delete process.env.PUBLIC_BRANCH_STATUS_CACHE_S_MAXAGE;
    expect(getPublicBranchStatusCacheSMaxage()).toBe(10);
  });

  test('getPublicBranchStatusCacheSMaxage devuelve 0 cuando está deshabilitado', () => {
    process.env.PUBLIC_BRANCH_STATUS_CACHE_S_MAXAGE = '0';
    expect(getPublicBranchStatusCacheSMaxage()).toBe(0);
  });

  test('getPublicBranchStatusCacheSMaxage respeta el valor configurado', () => {
    process.env.PUBLIC_BRANCH_STATUS_CACHE_S_MAXAGE = '20';
    expect(getPublicBranchStatusCacheSMaxage()).toBe(20);
  });

  test('getPublicBranchStatusCacheSMaxage vuelve al default ante valores inválidos', () => {
    process.env.PUBLIC_BRANCH_STATUS_CACHE_S_MAXAGE = 'abc';
    expect(getPublicBranchStatusCacheSMaxage()).toBe(10);
  });

  test('getPublicBranchStatusCacheSwr usa el valor por defecto', () => {
    delete process.env.PUBLIC_BRANCH_STATUS_CACHE_SWR;
    expect(getPublicBranchStatusCacheSwr()).toBe(30);
  });

  test('getPublicBranchStatusCacheSwr respeta el valor configurado', () => {
    process.env.PUBLIC_BRANCH_STATUS_CACHE_SWR = '45';
    expect(getPublicBranchStatusCacheSwr()).toBe(45);
  });

  test('getPublicBranchStatusCacheSwr vuelve al default ante valores inválidos', () => {
    process.env.PUBLIC_BRANCH_STATUS_CACHE_SWR = '-5';
    expect(getPublicBranchStatusCacheSwr()).toBe(30);
  });
});
