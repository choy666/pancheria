/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from './route';
import * as orderService from '@/application/services/orderService';
import { requireAuth, getCurrentBranchId } from '@/lib/auth';
import {
  UnauthorizedError,
  NotFoundError,
  ValidationError,
} from '@/domain/errors';

jest.mock('@/application/services/orderService');
jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
  getCurrentBranchId: jest.fn(),
}));
jest.mock('@/lib/logger', () => ({
  logError: jest.fn(),
}));

const mockedOrderService = orderService as jest.Mocked<typeof orderService>;
const mockedRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;
const mockedGetCurrentBranchId =
  getCurrentBranchId as jest.MockedFunction<typeof getCurrentBranchId>;

const BRANCH_ID = 1;

describe('GET /api/pedidos', () => {
  let session: Awaited<ReturnType<typeof requireAuth>>;

  beforeEach(() => {
    jest.clearAllMocks();
    session = {
      user: { name: 'operator', role: 'operator', branchId: BRANCH_ID },
    } as Awaited<ReturnType<typeof requireAuth>>;
    mockedRequireAuth.mockResolvedValue(session);
    mockedGetCurrentBranchId.mockResolvedValue(BRANCH_ID);
  });

  function buildRequest(path = ''): NextRequest {
    return new NextRequest(
      `http://localhost:3000/api/pedidos${path ? `?${path}` : ''}`
    );
  }

  const paginatedResponse = {
    items: [],
    total: 0,
    page: 1,
    limit: 10,
  };

  test('devuelve 401 cuando el usuario no está autenticado', async () => {
    mockedRequireAuth.mockRejectedValue(
      new UnauthorizedError('Se requiere iniciar sesión.')
    );

    const response = await GET(buildRequest());
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe('Se requiere iniciar sesión.');
  });

  test('devuelve los pedidos pendientes por defecto con status 200', async () => {
    mockedOrderService.getOrders.mockResolvedValue(paginatedResponse as any);

    const response = await GET(buildRequest());
    const body = (await response.json()) as { items: unknown[] };

    expect(response.status).toBe(200);
    expect(body.items).toEqual([]);
    expect(mockedOrderService.getOrders).toHaveBeenCalledWith(
      BRANCH_ID,
      expect.objectContaining({ status: 'pending', page: 1, limit: 10 })
    );
  });

  test('permite filtrar por estado', async () => {
    mockedOrderService.getOrders.mockResolvedValue(paginatedResponse as any);

    const response = await GET(buildRequest('status=converted'));

    expect(response.status).toBe(200);
    expect(mockedOrderService.getOrders).toHaveBeenCalledWith(
      BRANCH_ID,
      expect.objectContaining({ status: 'converted' })
    );
  });

  test('devuelve 400 cuando el estado es inválido', async () => {
    const response = await GET(buildRequest('status=invalid'));

    expect(response.status).toBe(400);
    expect(mockedOrderService.getOrders).not.toHaveBeenCalled();
  });

  test('devuelve 404 cuando el servicio lanza NotFoundError', async () => {
    mockedOrderService.getOrders.mockRejectedValue(new NotFoundError('Sucursal', 1));

    const response = await GET(buildRequest());
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe('Sucursal con ID 1 no encontrado.');
  });

  test('devuelve 400 ante un ValidationError del servicio', async () => {
    mockedOrderService.getOrders.mockRejectedValue(
      new ValidationError('Filtro inválido.')
    );

    const response = await GET(buildRequest());
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('Filtro inválido.');
  });

  test('devuelve 503 ante un error de conexión a la base de datos', async () => {
    const dbError = Object.assign(new Error('connection refused'), {
      code: 'ECONNREFUSED',
    });
    mockedOrderService.getOrders.mockRejectedValue(dbError);

    const response = await GET(buildRequest());
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Error de conexión con la base de datos');
  });
});
