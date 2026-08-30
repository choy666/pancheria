/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from './route';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import * as orderService from '@/application/services/orderService';
import * as stockService from '@/application/services/stockService';
import { requireAuth, getCurrentBranchId } from '@/lib/auth';
import { UnauthorizedError } from '@/domain/errors';

jest.mock('@/application/services/cashRegisterService');
jest.mock('@/application/services/orderService');
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

const mockedCashRegisterService =
  cashRegisterService as jest.Mocked<typeof cashRegisterService>;
const mockedOrderService = orderService as jest.Mocked<typeof orderService>;
const mockedStockService = stockService as jest.Mocked<typeof stockService>;
const mockedRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;
const mockedGetCurrentBranchId = getCurrentBranchId as jest.MockedFunction<
  typeof getCurrentBranchId
>;

const BRANCH_ID = 1;

function buildRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/panel/resumen');
}

function buildCashRegister(status: 'open' | 'closed' = 'open') {
  return {
    id: 1,
    branchId: BRANCH_ID,
    status,
    openedAt: new Date(),
    openedBy: 'operador',
    closedBy: null,
    closedAt: null,
    autoClosed: false,
    initialAmount: 0,
    total: 2500,
    cashTotal: 1500,
    transferTotal: 1000,
    totalSales: 5,
    cashInDrawer: 1500,
    productsSummary: { Panchuque: 3 },
    criticalSuppliesSummary: { Pan: 3 },
    recipeSuppliesSummary: { Salchicha: 3 },
    createdAt: new Date(),
    deletedAt: null,
    closingCashCount: null,
    closingDifference: null,
    closingNotes: null,
  };
}

function buildOrderResult(total: number) {
  return {
    items: [],
    total,
    page: 1,
    limit: 1,
  };
}

describe('GET /api/panel/resumen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const session = {
      user: { name: 'operador', role: 'operator', branchId: BRANCH_ID },
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

  test('devuelve el resumen completo del panel', async () => {
    mockedCashRegisterService.getOpenCashRegisterSummary.mockResolvedValue(
      buildCashRegister('open')
    );
    mockedStockService.listStockAlerts.mockResolvedValue([
      { isLow: true } as Awaited<ReturnType<typeof stockService.listStockAlerts>>[number],
      { isLow: false } as Awaited<ReturnType<typeof stockService.listStockAlerts>>[number],
      { isLow: true } as Awaited<ReturnType<typeof stockService.listStockAlerts>>[number],
    ]);
    mockedOrderService.expirePendingOrders.mockResolvedValue(0);

    mockedOrderService.getOrders
      .mockResolvedValueOnce(buildOrderResult(2))
      .mockResolvedValueOnce(buildOrderResult(1))
      .mockResolvedValueOnce(buildOrderResult(3))
      .mockResolvedValueOnce(buildOrderResult(4))
      .mockResolvedValueOnce(buildOrderResult(0));

    const response = await GET(buildRequest(), { params: Promise.resolve({}) });
    const body = (await response.json()) as {
      cashRegister: { total: number };
      lowStockCount: number;
      orderCounts: Record<string, number>;
    };

    expect(response.status).toBe(200);
    expect(body.cashRegister.total).toBe(2500);
    expect(body.lowStockCount).toBe(2);
    expect(body.orderCounts).toEqual({
      pending: 2,
      in_process: 1,
      paid: 3,
      finished: 4,
      cancelled: 0,
    });
    expect(mockedOrderService.getOrders).toHaveBeenCalledTimes(5);
    expect(mockedOrderService.expirePendingOrders).toHaveBeenCalledWith(BRANCH_ID);
  });

  test('devuelve caja cerrada cuando no hay caja abierta', async () => {
    mockedCashRegisterService.getOpenCashRegisterSummary.mockResolvedValue(null);
    mockedStockService.listStockAlerts.mockResolvedValue([]);
    mockedOrderService.expirePendingOrders.mockResolvedValue(0);
    mockedOrderService.getOrders.mockResolvedValue(buildOrderResult(0));

    const response = await GET(buildRequest(), { params: Promise.resolve({}) });
    const body = (await response.json()) as {
      cashRegister: { status: string };
      lowStockCount: number;
      orderCounts: Record<string, number>;
    };

    expect(response.status).toBe(200);
    expect(body.cashRegister.status).toBe('closed');
    expect(body.lowStockCount).toBe(0);
    expect(body.orderCounts).toEqual({
      pending: 0,
      in_process: 0,
      paid: 0,
      finished: 0,
      cancelled: 0,
    });
  });
});
