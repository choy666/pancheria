import {
  getOrderExpirationMs,
  getOrderRateLimitWindowMs,
  getOrderRateLimitMaxRequests,
  getPedidosRefreshIntervalMs,
} from './orders';

describe('orders config', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('getOrderExpirationMs usa el valor por defecto', () => {
    delete process.env.ORDER_EXPIRATION_MS;
    expect(getOrderExpirationMs()).toBe(3600000);
  });

  test('getOrderExpirationMs aplica un mínimo de 60 segundos', () => {
    process.env.ORDER_EXPIRATION_MS = '1000';
    expect(getOrderExpirationMs()).toBe(3600000);
  });

  test('getOrderExpirationMs respeta la variable', () => {
    process.env.ORDER_EXPIRATION_MS = '7200000';
    expect(getOrderExpirationMs()).toBe(7200000);
  });

  test('getOrderRateLimitWindowMs usa el valor por defecto', () => {
    delete process.env.PUBLIC_ORDER_RATE_LIMIT_WINDOW_MS;
    expect(getOrderRateLimitWindowMs()).toBe(60000);
  });

  test('getOrderRateLimitMaxRequests usa el valor por defecto', () => {
    delete process.env.PUBLIC_ORDER_RATE_LIMIT_MAX_REQUESTS;
    expect(getOrderRateLimitMaxRequests()).toBe(10);
  });

  test('getPedidosRefreshIntervalMs está deshabilitado por defecto', () => {
    delete process.env.NEXT_PUBLIC_PEDIDOS_REFRESH_INTERVAL_MS;
    expect(getPedidosRefreshIntervalMs()).toBe(0);
  });

  test('getPedidosRefreshIntervalMs respeta la variable', () => {
    process.env.NEXT_PUBLIC_PEDIDOS_REFRESH_INTERVAL_MS = '30000';
    expect(getPedidosRefreshIntervalMs()).toBe(30000);
  });

  test('getPedidosRefreshIntervalMs aplica un mínimo de 1000 ms', () => {
    process.env.NEXT_PUBLIC_PEDIDOS_REFRESH_INTERVAL_MS = '500';
    expect(getPedidosRefreshIntervalMs()).toBe(10000);
  });

  test('getPedidosRefreshIntervalMs permite deshabilitar con 0', () => {
    process.env.NEXT_PUBLIC_PEDIDOS_REFRESH_INTERVAL_MS = '0';
    expect(getPedidosRefreshIntervalMs()).toBe(0);
  });
});
