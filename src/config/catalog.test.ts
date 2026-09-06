import { getPedidoRefetchIntervalMs } from './catalog';

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
});
