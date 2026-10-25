import { getVentasCatalogRefreshIntervalMs } from './ventas';

describe('ventas config', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('getVentasCatalogRefreshIntervalMs usa el valor por defecto', () => {
    delete process.env.NEXT_PUBLIC_VENTAS_REFETCH_INTERVAL_MS;
    expect(getVentasCatalogRefreshIntervalMs()).toBe(30000);
  });

  test('getVentasCatalogRefreshIntervalMs respeta la variable', () => {
    process.env.NEXT_PUBLIC_VENTAS_REFETCH_INTERVAL_MS = '60000';
    expect(getVentasCatalogRefreshIntervalMs()).toBe(60000);
  });

  test('getVentasCatalogRefreshIntervalMs permite deshabilitar con 0', () => {
    process.env.NEXT_PUBLIC_VENTAS_REFETCH_INTERVAL_MS = '0';
    expect(getVentasCatalogRefreshIntervalMs()).toBe(0);
  });

  test('getVentasCatalogRefreshIntervalMs deshabilita con valores negativos', () => {
    process.env.NEXT_PUBLIC_VENTAS_REFETCH_INTERVAL_MS = '-1';
    expect(getVentasCatalogRefreshIntervalMs()).toBe(0);
  });

  test('getVentasCatalogRefreshIntervalMs deshabilita con valores no numéricos', () => {
    process.env.NEXT_PUBLIC_VENTAS_REFETCH_INTERVAL_MS = 'abc';
    expect(getVentasCatalogRefreshIntervalMs()).toBe(0);
  });

  test('getVentasCatalogRefreshIntervalMs ajusta al mínimo valores menores a 5 segundos', () => {
    process.env.NEXT_PUBLIC_VENTAS_REFETCH_INTERVAL_MS = '1000';
    expect(getVentasCatalogRefreshIntervalMs()).toBe(5000);
  });

  test('getVentasCatalogRefreshIntervalMs ajusta al mínimo valores positivos muy bajos', () => {
    process.env.NEXT_PUBLIC_VENTAS_REFETCH_INTERVAL_MS = '1';
    expect(getVentasCatalogRefreshIntervalMs()).toBe(5000);
  });
});
