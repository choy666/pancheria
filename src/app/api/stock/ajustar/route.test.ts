/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from './route';
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

describe('stock /api/stock/ajustar', () => {
  let session: Awaited<ReturnType<typeof requireAuth>>;

  beforeEach(() => {
    jest.clearAllMocks();
    session = {
      user: { name: 'operator', role: 'operator', branchId: BRANCH_ID },
    } as Awaited<ReturnType<typeof requireAuth>>;
    mockedRequireAuth.mockResolvedValue(session);
    mockedGetCurrentBranchId.mockResolvedValue(BRANCH_ID);
  });

  function buildRequest(
    init?: ConstructorParameters<typeof NextRequest>[1]
  ): NextRequest {
    return new NextRequest(
      'http://localhost:3000/api/stock/ajustar',
      init
    );
  }

  const validBody = {
    productId: 1,
    quantity: 10,
    reason: 'Ingreso de mercadería',
    type: 'restock',
  };

  test('devuelve 401 cuando el usuario no está autenticado', async () => {
    mockedRequireAuth.mockRejectedValue(
      new UnauthorizedError('Se requiere iniciar sesión.')
    );

    const response = await POST(buildRequest({ method: 'POST', body: JSON.stringify(validBody) }), { params: Promise.resolve({}) });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe('Se requiere iniciar sesión.');
  });

  test('ajusta el stock y devuelve status 200', async () => {
    const result = { productId: 1, newStock: 15 };
    mockedStockService.adjustStock.mockResolvedValue(
      result as unknown as Awaited<ReturnType<typeof stockService.adjustStock>>
    );

    const response = await POST(buildRequest({ method: 'POST', body: JSON.stringify(validBody) }), { params: Promise.resolve({}) });
    const body = (await response.json()) as unknown;

    expect(response.status).toBe(200);
    expect(body).toEqual(result);
    expect(mockedStockService.adjustStock).toHaveBeenCalledWith(
      BRANCH_ID,
      1,
      10,
      'Ingreso de mercadería',
      'restock'
    );
  });

  test('devuelve 400 cuando el cuerpo es inválido', async () => {
    const response = await POST(buildRequest({
        method: 'POST',
        body: JSON.stringify({
          productId: 1,
          quantity: 10,
          reason: 'no',
          type: 'restock',
        }),
      }), { params: Promise.resolve({}) });

    expect(response.status).toBe(400);
  });

  test('devuelve 404 cuando el producto no existe', async () => {
    mockedStockService.adjustStock.mockRejectedValue(
      new NotFoundError('Producto', 99)
    );

    const response = await POST(buildRequest({ method: 'POST', body: JSON.stringify(validBody) }), { params: Promise.resolve({}) });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe('Producto con ID 99 no encontrado.');
  });

  test('devuelve 400 ante un ValidationError del servicio', async () => {
    mockedStockService.adjustStock.mockRejectedValue(
      new ValidationError('El ajuste dejaría el stock de Pan en negativo.')
    );

    const response = await POST(buildRequest({ method: 'POST', body: JSON.stringify(validBody) }), { params: Promise.resolve({}) });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('El ajuste dejaría el stock de Pan en negativo.');
  });

  test('devuelve 503 ante un error de conexión a la base de datos', async () => {
    const dbError = Object.assign(new Error('connection refused'), {
      code: 'ECONNREFUSED',
    });
    mockedStockService.adjustStock.mockRejectedValue(dbError);

    const response = await POST(buildRequest({ method: 'POST', body: JSON.stringify(validBody) }), { params: Promise.resolve({}) });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Error de conexión con la base de datos');
  });

  test('devuelve 500 ante cualquier error inesperado', async () => {
    mockedStockService.adjustStock.mockRejectedValue(
      new Error('Error desconocido')
    );

    const response = await POST(buildRequest({ method: 'POST', body: JSON.stringify(validBody) }), { params: Promise.resolve({}) });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(body.error).toBe('Error interno del servidor');
  });
});
