/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from './route';
import * as orderService from '@/application/services/orderService';

jest.mock('@/application/services/orderService', () => ({
  expirePendingOrders: jest.fn(),
}));

const mockedExpirePendingOrders = orderService.expirePendingOrders as jest.MockedFunction<
  typeof orderService.expirePendingOrders
>;

const ORIGINAL_CRON_SECRET = process.env.CRON_SECRET;

beforeAll(() => {
  process.env.CRON_SECRET = 'secreto-cron';
});

afterAll(() => {
  process.env.CRON_SECRET = ORIGINAL_CRON_SECRET;
});

function buildRequest(authHeader?: string): NextRequest {
  return new NextRequest('http://localhost:3000/api/cron/expire-orders', {
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

describe('GET /api/cron/expire-orders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedExpirePendingOrders.mockResolvedValue(3);
  });

  test('devuelve 401 si no hay encabezado de autorizacion', async () => {
    const response = await GET(buildRequest());
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe('No autorizado.');
    expect(mockedExpirePendingOrders).not.toHaveBeenCalled();
  });

  test('devuelve 401 si el token no coincide', async () => {
    const response = await GET(buildRequest('Bearer token-incorrecto'));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe('No autorizado.');
    expect(mockedExpirePendingOrders).not.toHaveBeenCalled();
  });

  test('expira pedidos pendientes y devuelve la cantidad', async () => {
    const response = await GET(buildRequest('Bearer secreto-cron'));
    const body = (await response.json()) as { ok: boolean; expired: number };

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, expired: 3 });
    expect(mockedExpirePendingOrders).toHaveBeenCalledWith();
  });
});
