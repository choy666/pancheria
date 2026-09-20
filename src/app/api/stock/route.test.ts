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
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockedStockService = stockService as jest.Mocked<typeof stockService>;
const mockedRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;
const mockedGetCurrentBranchId =
  getCurrentBranchId as jest.MockedFunction<typeof getCurrentBranchId>;

const BRANCH_ID = 1;

function buildRequest(path = ''): NextRequest {
  return new NextRequest(`http://localhost:3000/api/stock${path}`);
}

describe('stock /api/stock', () => {
  let session: Awaited<ReturnType<typeof requireAuth>>;

  beforeEach(() => {
    jest.clearAllMocks();
    session = {
      user: { name: 'operator', role: 'operator', branchId: BRANCH_ID },
    } as Awaited<ReturnType<typeof requireAuth>>;
    mockedRequireAuth.mockResolvedValue(session);
    mockedGetCurrentBranchId.mockResolvedValue(BRANCH_ID);
  });

  test('devuelve 401 cuando el usuario no está autenticado', async () => {
    mockedRequireAuth.mockRejectedValue(
      new UnauthorizedError('Se requiere iniciar sesión.')
    );

    const response = await GET(buildRequest(), { params: Promise.resolve({}) });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe('Se requiere iniciar sesión.');
  });

  test('devuelve la página de alertas de stock con status 200', async () => {
    const result = {
      items: [{ id: 1, name: 'Pan', stock: 2, minStock: 5, isLow: true }],
      total: 1,
      page: 1,
      limit: 10,
    };
    mockedStockService.listStockAlertsPage.mockResolvedValue(
      result as unknown as Awaited<
        ReturnType<typeof stockService.listStockAlertsPage>
      >
    );

    const response = await GET(buildRequest(), { params: Promise.resolve({}) });
    const body = (await response.json()) as unknown;

    expect(response.status).toBe(200);
    expect(body).toEqual(result);
    expect(mockedStockService.listStockAlertsPage).toHaveBeenCalledWith(
      BRANCH_ID,
      { page: 1, limit: 10 }
    );
  });

  test('propaga page y limit de la query al servicio', async () => {
    mockedStockService.listStockAlertsPage.mockResolvedValue({
      items: [],
      total: 0,
      page: 2,
      limit: 50,
    } as unknown as Awaited<
      ReturnType<typeof stockService.listStockAlertsPage>
    >);

    const response = await GET(buildRequest('?page=2&limit=50'), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(200);
    expect(mockedStockService.listStockAlertsPage).toHaveBeenCalledWith(
      BRANCH_ID,
      { page: 2, limit: 50 }
    );
  });

  test('devuelve 404 cuando el servicio lanza NotFoundError', async () => {
    mockedStockService.listStockAlertsPage.mockRejectedValue(
      new NotFoundError('Producto', 1)
    );

    const response = await GET(buildRequest(), { params: Promise.resolve({}) });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe('Producto con ID 1 no encontrado.');
  });

  test('devuelve 400 ante un ValidationError del servicio', async () => {
    mockedStockService.listStockAlertsPage.mockRejectedValue(
      new ValidationError('Sucursal inválida.')
    );

    const response = await GET(buildRequest(), { params: Promise.resolve({}) });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('Sucursal inválida.');
  });

  test('devuelve 503 ante un error de conexión a la base de datos', async () => {
    const dbError = Object.assign(new Error('connection refused'), {
      code: 'ECONNREFUSED',
    });
    mockedStockService.listStockAlertsPage.mockRejectedValue(dbError);

    const response = await GET(buildRequest(), { params: Promise.resolve({}) });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Error de conexión con la base de datos');
  });

  test('devuelve 500 ante cualquier error inesperado', async () => {
    mockedStockService.listStockAlertsPage.mockRejectedValue(
      new Error('Error desconocido')
    );

    const response = await GET(buildRequest(), { params: Promise.resolve({}) });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(body.error).toBe('Error interno del servidor');
  });
});
