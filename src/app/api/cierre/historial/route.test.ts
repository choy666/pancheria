/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from './route';
import * as closureService from '@/application/services/closureService';
import { requireAuth, getCurrentBranchId } from '@/lib/auth';
import {
  UnauthorizedError,
  NotFoundError,
  ValidationError,
} from '@/domain/errors';

jest.mock('@/application/services/closureService');
jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
  getCurrentBranchId: jest.fn(),
}));
jest.mock('@/lib/logger', () => ({
  logError: jest.fn(),
}));

const mockedClosureService = closureService as jest.Mocked<typeof closureService>;
const mockedRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;
const mockedGetCurrentBranchId =
  getCurrentBranchId as jest.MockedFunction<typeof getCurrentBranchId>;

const BRANCH_ID = 1;

describe('cierre /api/cierre/historial', () => {
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
      `http://localhost:3000/api/cierre/historial?${search}`
    );
  }

  test('devuelve 401 cuando el usuario no está autenticado', async () => {
    mockedRequireAuth.mockRejectedValue(
      new UnauthorizedError('Se requiere iniciar sesión.')
    );

    const response = await GET(buildRequest('start=2025-01-01&end=2025-01-31'), { params: Promise.resolve({}) });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe('Se requiere iniciar sesión.');
  });

  test('devuelve el historial de cierres con status 200', async () => {
    const history = {
      items: [{ id: 1, branchId: BRANCH_ID, date: '2025-01-15' }],
      total: 1,
      page: 1,
      limit: 10,
    };
    mockedClosureService.listClosures.mockResolvedValue(
      history as unknown as Awaited<ReturnType<typeof closureService.listClosures>>
    );

    const response = await GET(buildRequest('start=2025-01-01&end=2025-01-31'), { params: Promise.resolve({}) });
    const body = (await response.json()) as { items: unknown[] };

    expect(response.status).toBe(200);
    expect(body.items).toEqual(history.items);
    expect(mockedClosureService.listClosures).toHaveBeenCalledWith(
      BRANCH_ID,
      expect.any(Date),
      expect.any(Date),
      { page: 1, limit: 10 }
    );
  });

  test('propaga la paginación al servicio', async () => {
    mockedClosureService.listClosures.mockResolvedValue(
      { items: [], total: 0, page: 2, limit: 25 } as unknown as Awaited<
        ReturnType<typeof closureService.listClosures>
      >
    );

    await GET(buildRequest('start=2025-01-01&end=2025-01-31&page=2&limit=25'), { params: Promise.resolve({}) });

    expect(mockedClosureService.listClosures).toHaveBeenCalledWith(
      BRANCH_ID,
      expect.any(Date),
      expect.any(Date),
      { page: 2, limit: 25 }
    );
  });

  test('devuelve 404 cuando el servicio lanza NotFoundError', async () => {
    mockedClosureService.listClosures.mockRejectedValue(
      new NotFoundError('Cierre', 1)
    );

    const response = await GET(buildRequest('start=2025-01-01&end=2025-01-31'), { params: Promise.resolve({}) });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe('Cierre con ID 1 no encontrado.');
  });

  test('devuelve 400 ante un ValidationError del servicio', async () => {
    mockedClosureService.listClosures.mockRejectedValue(
      new ValidationError('Rango de fechas inválido.')
    );

    const response = await GET(buildRequest('start=2025-01-01&end=2025-01-31'), { params: Promise.resolve({}) });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('Rango de fechas inválido.');
  });

  test('devuelve 503 ante un error de conexión a la base de datos', async () => {
    const dbError = Object.assign(new Error('connection refused'), {
      code: 'ECONNREFUSED',
    });
    mockedClosureService.listClosures.mockRejectedValue(dbError);

    const response = await GET(buildRequest('start=2025-01-01&end=2025-01-31'), { params: Promise.resolve({}) });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Error de conexión con la base de datos');
  });

  test('devuelve 500 ante cualquier error inesperado', async () => {
    mockedClosureService.listClosures.mockRejectedValue(
      new Error('Error desconocido')
    );

    const response = await GET(buildRequest('start=2025-01-01&end=2025-01-31'), { params: Promise.resolve({}) });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(body.error).toBe('Error interno del servidor');
  });
});
