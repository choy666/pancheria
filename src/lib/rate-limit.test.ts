/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { createRateLimiter, getClientIp } from './rate-limit';

jest.mock('@/lib/public-order-rate-limit-store', () => ({
  createPublicOrderRateLimitStore: jest.fn().mockReturnValue({
    recordRequest: jest.fn().mockResolvedValue(true),
  }),
}));

function createRequest(
  headers: Record<string, string> = {},
  runtimeIp?: string
): NextRequest {
  return {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
    ip: runtimeIp,
  } as unknown as NextRequest;
}

describe('getClientIp', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalVercel = process.env.VERCEL;
  const originalTrustedHeader = process.env.TRUSTED_PROXY_IP_HEADER;

  afterEach(() => {
    Object.assign(process.env, { NODE_ENV: originalNodeEnv });
    process.env.VERCEL = originalVercel;
    delete process.env.TRUSTED_PROXY_IP_HEADER;
  });

  test('prefiere la IP del runtime', () => {
    const request = createRequest({}, '1.2.3.4');
    expect(getClientIp(request)).toBe('1.2.3.4');
  });

  test('usa x-vercel-forwarded-for en Vercel', () => {
    process.env.VERCEL = '1';
    const request = createRequest({
      'x-vercel-forwarded-for': '5.6.7.8, 9.10.11.12',
    });
    expect(getClientIp(request)).toBe('5.6.7.8');
  });

  test('usa el header confiable configurado', () => {
    process.env.TRUSTED_PROXY_IP_HEADER = 'x-custom-real-ip';
    const request = createRequest({
      'x-custom-real-ip': '13.14.15.16, 17.18.19.20',
    });
    expect(getClientIp(request)).toBe('13.14.15.16');
  });

  test('usa X-Forwarded-For en desarrollo', () => {
    Object.assign(process.env, { NODE_ENV: 'development' });
    const request = createRequest({
      'x-forwarded-for': '21.22.23.24, 25.26.27.28',
    });
    expect(getClientIp(request)).toBe('21.22.23.24');
  });

  test('ignora X-Forwarded-For fuera de desarrollo', () => {
    Object.assign(process.env, { NODE_ENV: 'production' });
    const request = createRequest({
      'x-forwarded-for': '21.22.23.24',
    });
    expect(getClientIp(request)).toBe('unknown');
  });

  test('retorna unknown cuando no hay fuentes', () => {
    Object.assign(process.env, { NODE_ENV: 'production' });
    const request = createRequest();
    expect(getClientIp(request)).toBe('unknown');
  });
});

describe('createRateLimiter', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    Object.assign(process.env, { NODE_ENV: originalNodeEnv });
  });

  test('en test siempre permite el request', async () => {
    const isRateLimited = createRateLimiter('pedido', 60_000, 10);
    const blocked = await isRateLimited('1.2.3.4');
    expect(blocked).toBe(false);
  });

  test('delega en el store fuera de test', async () => {
    Object.assign(process.env, { NODE_ENV: 'production' });
    const { createPublicOrderRateLimitStore } = await import(
      '@/lib/public-order-rate-limit-store'
    );
    const store = (createPublicOrderRateLimitStore as jest.Mock)();

    const isRateLimited = createRateLimiter('pedido', 60_000, 10);
    const blocked = await isRateLimited('1.2.3.4');

    expect(blocked).toBe(true);
    expect(store.recordRequest).toHaveBeenCalledWith('1.2.3.4', 60_000, 10);
  });
});
