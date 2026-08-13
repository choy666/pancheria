/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from './route';
import * as saleService from '@/application/services/saleService';
import { requireAuth, getCurrentBranchId } from '@/lib/auth';
import {
  UnauthorizedError,
  NotFoundError,
  ValidationError,
} from '@/domain/errors';

jest.mock('@/application/services/saleService');
jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
  getCurrentBranchId: jest.fn(),
}));
jest.mock('@/lib/logger', () => ({
  logError: jest.fn(),
}));

const mockedSaleService = saleService as jest.Mocked<typeof saleService>;
const mockedRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;
const mockedGetCurrentBranchId =
  getCurrentBranchId as jest.MockedFunction<typeof getCurrentBranchId>;

const BRANCH_ID = 1;

describe('productos /api/productos/disponibilidad', () => {
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
      `http://localhost:3000/api/productos/disponibilidad?${search}`
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
    expect(body.error).toBe('Se requiere productId');
  });

  test('devuelve 400 cuando el productId es inválido', async () => {
    const response = await GET(buildRequest('productId=abc'));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('Se requiere productId');
  });

  test('devuelve la disponibilidad con status 200', async () => {
    mockedSaleService.calculateAvailability.mockResolvedValue(5);

    const response = await GET(buildRequest('productId=1'));
    const body = (await response.json()) as { productId: number; availability: number };

    expect(response.status).toBe(200);
    expect(body).toEqual({ productId: 1, availability: 5 });
    expect(mockedSaleService.calculateAvailability).toHaveBeenCalledWith(
      BRANCH_ID,
      1
    );
  });

  test('devuelve 400 ante un ValidationError del servicio', async () => {
    mockedSaleService.calculateAvailability.mockRejectedValue(
      new ValidationError('No se pudo calcular la disponibilidad.')
    );

    const response = await GET(buildRequest('productId=1'));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('No se pudo calcular la disponibilidad.');
  });

  test('devuelve 404 cuando el servicio lanza NotFoundError', async () => {
    mockedSaleService.calculateAvailability.mockRejectedValue(
      new NotFoundError('Producto', 99)
    );

    const response = await GET(buildRequest('productId=99'));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe('Producto con ID 99 no encontrado.');
  });

  test('devuelve 503 ante un error de conexión a la base de datos', async () => {
    const dbError = Object.assign(new Error('connection refused'), {
      code: 'ECONNREFUSED',
    });
    mockedSaleService.calculateAvailability.mockRejectedValue(dbError);

    const response = await GET(buildRequest('productId=1'));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Error de conexión con la base de datos');
  });

  test('devuelve 500 ante cualquier error inesperado del servicio', async () => {
    mockedSaleService.calculateAvailability.mockRejectedValue(
      new Error('Error desconocido')
    );

    const response = await GET(buildRequest('productId=1'));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(body.error).toBe('Error interno del servidor');
  });
});
