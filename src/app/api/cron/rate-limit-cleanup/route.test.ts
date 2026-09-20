import { NextRequest } from 'next/server';
import { GET } from './route';
import { DbPublicOrderRateLimitStore } from '@/lib/public-order-rate-limit-store';
import { getRateLimitStore } from '@/lib/rate-limit-store';

jest.mock('@/lib/public-order-rate-limit-store', () => ({
  DbPublicOrderRateLimitStore: jest.fn().mockImplementation(() => ({
    cleanupExpired: jest.fn(),
  })),
}));
jest.mock('@/lib/rate-limit-store', () => ({
  getRateLimitStore: jest.fn().mockReturnValue({
    cleanupStale: jest.fn().mockResolvedValue(0),
  }),
}));

const mockedStore = DbPublicOrderRateLimitStore as jest.MockedClass<
  typeof DbPublicOrderRateLimitStore
>;
const mockedGetRateLimitStore = getRateLimitStore as jest.MockedFunction<
  typeof getRateLimitStore
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
    mockedGetRateLimitStore.mockReturnValue({
      cleanupStale: jest.fn().mockResolvedValue(0),
    } as unknown as ReturnType<typeof getRateLimitStore>);
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
    const cleanupStale = jest.fn().mockResolvedValue(3);
    mockedGetRateLimitStore.mockReturnValue({
      cleanupStale,
    } as unknown as ReturnType<typeof getRateLimitStore>);

    const response = await GET(buildRequest('Bearer secreto-cron'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      deletedRateLimits: 5,
      deletedLoginAttempts: 3,
    });
    expect(cleanupExpired).toHaveBeenCalled();
    expect(cleanupStale).toHaveBeenCalled();
  });
});
