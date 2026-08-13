/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from './route';
import * as stockService from '@/application/services/stockService';
import { requireAuth, getCurrentBranchId } from '@/lib/auth';
import {
  UnauthorizedError,
  NotFoundError,
  ValidationError,
} from '@/domain/errors';

jest.mock('@/application/services/stockService');
jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
  getCurrentBranchId: jest.fn(),
}));
jest.mock('@/lib/logger', () => ({
  logError: jest.fn(),
}));

const mockedStockService = stockService as jest.Mocked<typeof stockService>;
const mockedRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;
const mockedGetCurrentBranchId =
  getCurrentBranchId as jest.MockedFunction<typeof getCurrentBranchId>;

const BRANCH_ID = 1;

describe('stock /api/stock/movimientos', () => {
  let session: Awaited<ReturnType<typeof requireAuth>>;

  beforeEach(() => {
    jest.clearAllMocks();
    session = {
      user: { name: 'operator', role: 'operator', branchId: BRANCH_ID },
    } as Awaited<ReturnType<typeof requireAuth>>;
    mockedRequireAuth.mockResolvedValue(session);
    mockedGetCurrentBranchId.mockResolvedValue(BRANCH_ID);
  });

  function buildRequest(search: string): NextRequest {
    return new NextRequest(
      `http://localhost:3000/api/stock/movimientos?${search}`
    );
  }

  test('devuelve 401 cuando el usuario no está autenticado', async () => {
    mockedRequireAuth.mockRejectedValue(
      new UnauthorizedError('Se requiere iniciar sesión.')
    );

    const response = await GET(buildRequest('productId=1'));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe('Se requiere iniciar sesión.');
  });

  test('devuelve 400 cuando falta el productId', async () => {
    const response = await GET(buildRequest(''));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('Se requiere el ID del producto.');
  });

  test('devuelve 400 cuando el productId es inválido', async () => {
    const response = await GET(buildRequest('productId=abc'));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('Se requiere el ID del producto.');
  });

  test('devuelve el historial con status 200', async () => {
    const history = {
      items: [{ id: 1, productId: 1, type: 'restock', quantity: 10 }],
      total: 1,
      page: 1,
      limit: 10,
    };
    mockedStockService.getStockHistory.mockResolvedValue(
      history as unknown as Awaited<ReturnType<typeof stockService.getStockHistory>>
    );

    const response = await GET(buildRequest('productId=1'));
    const body = (await response.json()) as { items: unknown[] };

    expect(response.status).toBe(200);
    expect(body.items).toEqual(history.items);
    expect(mockedStockService.getStockHistory).toHaveBeenCalledWith(
      BRANCH_ID,
      1,
      { page: 1, limit: 10 }
    );
  });

  test('devuelve 404 cuando el producto no existe', async () => {
    mockedStockService.getStockHistory.mockRejectedValue(
      new NotFoundError('Producto', 99)
    );

    const response = await GET(buildRequest('productId=99'));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe('Producto con ID 99 no encontrado.');
  });

  test('devuelve 400 ante un ValidationError del servicio', async () => {
    mockedStockService.getStockHistory.mockRejectedValue(
      new ValidationError('Producto inválido.')
    );

    const response = await GET(buildRequest('productId=1'));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('Producto inválido.');
  });

  test('devuelve 503 ante un error de conexión a la base de datos', async () => {
    const dbError = Object.assign(new Error('connection refused'), {
      code: 'ECONNREFUSED',
    });
    mockedStockService.getStockHistory.mockRejectedValue(dbError);

    const response = await GET(buildRequest('productId=1'));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Error de conexión con la base de datos');
  });

  test('devuelve 500 ante cualquier error inesperado', async () => {
    mockedStockService.getStockHistory.mockRejectedValue(
      new Error('Error desconocido')
    );

    const response = await GET(buildRequest('productId=1'));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(body.error).toBe('Error interno del servidor');
  });
});
