import { NextRequest } from 'next/server';
import { GET } from './route';
import { DbPublicOrderRateLimitStore } from '@/lib/public-order-rate-limit-store';

jest.mock('@/lib/public-order-rate-limit-store', () => ({
  DbPublicOrderRateLimitStore: jest.fn().mockImplementation(() => ({
    cleanupExpired: jest.fn(),
  })),
}));

const mockedStore = DbPublicOrderRateLimitStore as jest.MockedClass<
  typeof DbPublicOrderRateLimitStore
>;

const ORIGINAL_CRON_SECRET = process.env.CRON_SECRET;

beforeAll(() => {
  process.env.CRON_SECRET = 'secreto-cron';
});

afterAll(() => {
  process.env.CRON_SECRET = ORIGINAL_CRON_SECRET;
});

function buildRequest(authHeader?: string): NextRequest {
  return new NextRequest('http://localhost:3000/api/cron/rate-limit-cleanup', {
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

describe('GET /api/cron/rate-limit-cleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const instance = mockedStore.mock.instances[0] as unknown as { cleanupExpired: jest.Mock } | undefined;
    if (instance) {
      instance.cleanupExpired.mockResolvedValue(0);
    }
  });

  test('devuelve 401 si no hay encabezado de autorizacion', async () => {
    const response = await GET(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('No autorizado.');
  });

  test('devuelve 401 si el token no coincide', async () => {
    const response = await GET(buildRequest('Bearer token-incorrecto'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('No autorizado.');
  });

  test('limpia entradas vencidas y devuelve la cantidad eliminada', async () => {
    const cleanupExpired = jest.fn().mockResolvedValue(5);
    (DbPublicOrderRateLimitStore as jest.MockedClass<typeof DbPublicOrderRateLimitStore>).mockImplementation(() => ({
      cleanupExpired,
    } as unknown as DbPublicOrderRateLimitStore));

    const response = await GET(buildRequest('Bearer secreto-cron'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, deleted: 5 });
    expect(cleanupExpired).toHaveBeenCalled();
  });
});
