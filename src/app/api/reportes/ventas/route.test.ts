/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from './route';
import * as reportService from '@/application/services/reportService';
import { requireAdmin, getCurrentBranchId } from '@/lib/auth';

jest.mock('@/application/services/reportService');
jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
  requireAdmin: jest.fn(),
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

const mockedReportService = reportService as jest.Mocked<typeof reportService>;
const mockedRequireAdmin = requireAdmin as jest.MockedFunction<
  typeof requireAdmin
>;
const mockedGetCurrentBranchId = getCurrentBranchId as jest.MockedFunction<
  typeof getCurrentBranchId
>;

const BRANCH_ID = 1;
const baseUrl = 'http://localhost:3000/api/reportes/ventas';

function buildRequest(search = ''): NextRequest {
  return new NextRequest(search ? `${baseUrl}?${search}` : baseUrl);
}

describe('GET /api/reportes/ventas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRequireAdmin.mockResolvedValue({
      user: { name: 'admin', branchId: BRANCH_ID, role: 'admin' },
    } as Awaited<ReturnType<typeof requireAdmin>>);
    mockedGetCurrentBranchId.mockResolvedValue(BRANCH_ID);
    mockedReportService.getSalesReport.mockResolvedValue({
      range: {
        start: '2026-10-01T00:00:00.000Z',
        end: '2026-10-31T00:00:00.000Z',
      },
      totals: {
        total: 0,
        cashTotal: 0,
        transferTotal: 0,
        salesCount: 0,
        cancelledSalesCount: 0,
        cashRegistersCount: 0,
        cashDifference: 0,
        transferDifference: 0,
      },
      byDay: [],
      byProduct: [],
      cashRegisters: [],
    });
  });

  test('devuelve 403 cuando el usuario no es admin', async () => {
    const { ForbiddenError } = await import('@/domain/errors');
    mockedRequireAdmin.mockRejectedValue(
      new ForbiddenError('Se requiere rol de administrador.')
    );

    const response = await GET(buildRequest(), { params: Promise.resolve({}) });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(403);
    expect(body.error).toBe('Se requiere rol de administrador.');
  });

  test('devuelve el reporte del rango pedido', async () => {
    const response = await GET(buildRequest('start=2026-10-01&end=2026-10-31'), {
      params: Promise.resolve({}),
    });
    const body = (await response.json()) as { totals: { total: number } };

    expect(response.status).toBe(200);
    expect(body.totals.total).toBe(0);
    // `end=2026-10-31` es inclusivo → exclusivo en 2026-11-01.
    expect(mockedReportService.getSalesReport).toHaveBeenCalledWith(
      BRANCH_ID,
      new Date('2026-10-01T00:00:00.000Z'),
      new Date('2026-11-01T00:00:00.000Z')
    );
  });

  test('usa los últimos 30 días cuando no hay parámetros', async () => {
    const response = await GET(buildRequest(), { params: Promise.resolve({}) });

    expect(response.status).toBe(200);
    const [, start, end] =
      mockedReportService.getSalesReport.mock.calls[0];
    expect(end.getTime() - start.getTime()).toBeCloseTo(
      30 * 24 * 60 * 60 * 1000,
      -2
    );
  });

  test('rechaza un rango con fecha inválida', async () => {
    const response = await GET(buildRequest('start=foo&end=2026-10-31'), {
      params: Promise.resolve({}),
    });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('Rango de fechas inválido.');
    expect(mockedReportService.getSalesReport).not.toHaveBeenCalled();
  });

  test('rechaza un rango invertido', async () => {
    const response = await GET(buildRequest('start=2026-10-31&end=2026-10-01'), {
      params: Promise.resolve({}),
    });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe(
      'La fecha de inicio no puede ser posterior a la de fin.'
    );
    expect(mockedReportService.getSalesReport).not.toHaveBeenCalled();
  });
});
