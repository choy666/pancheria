/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from './route';
import * as orderService from '@/application/services/orderService';
import * as branchService from '@/application/services/branchService';
import { requireAuth, getCurrentBranchId } from '@/lib/auth';
import {
  UnauthorizedError,
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from '@/domain/errors';

jest.mock('@/application/services/orderService');
jest.mock('@/application/services/branchService', () => ({
  getBranchById: jest.fn(),
}));
jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
  getCurrentBranchId: jest.fn(),
}));
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  logError: jest.fn(),
}));

const mockedOrderService = orderService as jest.Mocked<typeof orderService>;
const mockedBranchService = branchService as jest.Mocked<typeof branchService>;
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
    mockedBranchService.getBranchById.mockResolvedValue({
      id: BRANCH_ID,
      name: 'Sucursal Test',
      createdAt: new Date(),
    });
    mockedOrderService.expirePendingOrders.mockResolvedValue(0);
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

  test('sin branchId se usa la sucursal actual', async () => {
    mockedOrderService.getOrders.mockResolvedValue(paginatedResponse as any);

    const response = await GET(buildRequest());

    expect(response.status).toBe(200);
    expect(mockedOrderService.getOrders).toHaveBeenCalledWith(
      BRANCH_ID,
      expect.objectContaining({ status: 'pending' })
    );
  });

  test('admin puede listar pedidos de otra sucursal enviando branchId', async () => {
    session = {
      user: { name: 'admin', role: 'admin', branchId: BRANCH_ID },
    } as Awaited<ReturnType<typeof requireAuth>>;
    mockedRequireAuth.mockResolvedValue(session);
    mockedOrderService.getOrders.mockResolvedValue(paginatedResponse as any);

    const response = await GET(buildRequest('branchId=2'));

    expect(response.status).toBe(200);
    expect(mockedBranchService.getBranchById).toHaveBeenCalledWith(2);
    expect(mockedOrderService.getOrders).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ status: 'pending' })
    );
  });

  test('operator no puede listar pedidos de otra sucursal', async () => {
    mockedOrderService.getOrders.mockResolvedValue(paginatedResponse as any);

    const response = await GET(buildRequest('branchId=2'));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(403);
    expect(body.error).toBe('No tenés permiso para ver pedidos de otra sucursal.');
    expect(mockedOrderService.getOrders).not.toHaveBeenCalled();
  });

  test('devuelve 404 si la sucursal indicada no existe', async () => {
    session = {
      user: { name: 'admin', role: 'admin', branchId: BRANCH_ID },
    } as Awaited<ReturnType<typeof requireAuth>>;
    mockedRequireAuth.mockResolvedValue(session);
    mockedBranchService.getBranchById.mockResolvedValue(undefined);

    const response = await GET(buildRequest('branchId=2'));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe('Sucursal con ID 2 no encontrado.');
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
