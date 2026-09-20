import {
  getPedidoRefetchIntervalMs,
  getPublicCatalogCacheSMaxage,
  getPublicCatalogCacheSwr,
} from './catalog';

describe('catalog config', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('getPedidoRefetchIntervalMs usa el valor por defecto', () => {
    delete process.env.NEXT_PUBLIC_PEDIDO_REFETCH_INTERVAL_MS;
    expect(getPedidoRefetchIntervalMs()).toBe(30000);
  });

  test('getPedidoRefetchIntervalMs aplica un mínimo de 1000 ms', () => {
    process.env.NEXT_PUBLIC_PEDIDO_REFETCH_INTERVAL_MS = '500';
    expect(getPedidoRefetchIntervalMs()).toBe(30000);
  });

  test('getPublicCatalogCacheSMaxage usa el valor por defecto', () => {
    delete process.env.PUBLIC_CATALOG_CACHE_S_MAXAGE;
    expect(getPublicCatalogCacheSMaxage()).toBe(10);
  });

  test('getPublicCatalogCacheSMaxage devuelve 0 cuando está deshabilitado', () => {
    process.env.PUBLIC_CATALOG_CACHE_S_MAXAGE = '0';
    expect(getPublicCatalogCacheSMaxage()).toBe(0);
  });

  test('getPublicCatalogCacheSMaxage respeta el valor configurado', () => {
    process.env.PUBLIC_CATALOG_CACHE_S_MAXAGE = '15';
    expect(getPublicCatalogCacheSMaxage()).toBe(15);
  });

  test('getPublicCatalogCacheSMaxage vuelve al default ante valores inválidos', () => {
    process.env.PUBLIC_CATALOG_CACHE_S_MAXAGE = 'abc';
    expect(getPublicCatalogCacheSMaxage()).toBe(10);
  });

  test('getPublicCatalogCacheSwr usa el valor por defecto', () => {
    delete process.env.PUBLIC_CATALOG_CACHE_SWR;
    expect(getPublicCatalogCacheSwr()).toBe(30);
  });

  test('getPublicCatalogCacheSwr respeta el valor configurado', () => {
    process.env.PUBLIC_CATALOG_CACHE_SWR = '60';
    expect(getPublicCatalogCacheSwr()).toBe(60);
  });

  test('getPublicCatalogCacheSwr vuelve al default ante valores inválidos', () => {
    process.env.PUBLIC_CATALOG_CACHE_SWR = '-5';
    expect(getPublicCatalogCacheSwr()).toBe(30);
  });
});
