/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from './route';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import { requireAuth, getCurrentBranchId } from '@/lib/auth';

jest.mock('@/application/services/cashRegisterService');
jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
  getCurrentBranchId: jest.fn(),
}));
jest.mock('@/lib/logger', () => ({
  logError: jest.fn(),
}));

const mockedCashRegisterService = cashRegisterService as jest.Mocked<
  typeof cashRegisterService
>;
const mockedRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;
const mockedGetCurrentBranchId =
  getCurrentBranchId as jest.MockedFunction<typeof getCurrentBranchId>;

const BRANCH_ID = 1;

describe('GET /api/caja/historial', () => {
  const baseUrl = 'http://localhost:3000/api/caja/historial';

  beforeEach(() => {
    jest.clearAllMocks();
    mockedRequireAuth.mockResolvedValue({
      user: { name: 'admin', branchId: BRANCH_ID },
    } as Awaited<ReturnType<typeof requireAuth>>);
    mockedGetCurrentBranchId.mockResolvedValue(BRANCH_ID);
  });

  function buildRequest(search: string): NextRequest {
    return new NextRequest(`${baseUrl}?${search}`);
  }

  test('devuelve 401 cuando el usuario no está autenticado', async () => {
    const { UnauthorizedError } = await import('@/domain/errors');
    mockedRequireAuth.mockRejectedValue(
      new UnauthorizedError('Se requiere iniciar sesión.')
    );

    const response = await GET(buildRequest('start=2025-01-01&end=2025-01-31'));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe('Se requiere iniciar sesión.');
  });

  test('devuelve el historial de cajas con status 200', async () => {
    const history = [{ id: 1, branchId: BRANCH_ID, status: 'closed' as const }];
    mockedCashRegisterService.listCashRegisterHistory.mockResolvedValue({
      items: history,
      total: 1,
      page: 1,
      limit: 10,
    } as unknown as Awaited<ReturnType<typeof cashRegisterService.listCashRegisterHistory>>);

    const response = await GET(buildRequest('start=2025-01-01&end=2025-01-31'));
    const body = (await response.json()) as { items: unknown[] };

    expect(response.status).toBe(200);
    expect(body.items).toEqual(history);
    expect(mockedCashRegisterService.listCashRegisterHistory).toHaveBeenCalledWith(
      BRANCH_ID,
      expect.any(Date),
      expect.any(Date),
      undefined,
      { page: 1, limit: 10 }
    );
  });

  test('propaga el filtro de estado al servicio', async () => {
    mockedCashRegisterService.listCashRegisterHistory.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 10,
    });

    await GET(buildRequest('start=2025-01-01&end=2025-01-31&status=open'));

    expect(mockedCashRegisterService.listCashRegisterHistory).toHaveBeenCalledWith(
      BRANCH_ID,
      expect.any(Date),
      expect.any(Date),
      'open',
      { page: 1, limit: 10 }
    );
  });

  test('devuelve 503 ante un error de conexión a la base de datos', async () => {
    const dbError = Object.assign(
      new Error('Failed query: select from cash_registers'),
      { code: 'ECONNREFUSED' }
    );
    mockedCashRegisterService.listCashRegisterHistory.mockRejectedValue(dbError);

    const response = await GET(buildRequest('start=2025-01-01&end=2025-01-31'));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Error de conexión con la base de datos');
  });

  test('devuelve 500 ante cualquier error inesperado del servicio', async () => {
    mockedCashRegisterService.listCashRegisterHistory.mockRejectedValue(
      new Error('Error desconocido')
    );

    const response = await GET(buildRequest('start=2025-01-01&end=2025-01-31'));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(body.error).toBe('Error interno del servidor');
  });
});
