/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from './route';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import { requireAuth, getCurrentBranchId } from '@/lib/auth';
import { UnauthorizedError } from '@/domain/errors';

jest.mock('@/application/services/cashRegisterService');
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
const mockedRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;
const mockedGetCurrentBranchId = getCurrentBranchId as jest.MockedFunction<
  typeof getCurrentBranchId
>;

const BRANCH_ID = 1;

function buildRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/caja/resumen');
}

describe('GET /api/caja/resumen', () => {
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

  test('devuelve el resumen de la caja abierta', async () => {
    const live = {
      status: 'open',
      total: 1500,
      sales: 2,
    };
    mockedCashRegisterService.getOpenCashRegisterSummary.mockResolvedValue(
      live as any
    );

    const response = await GET(buildRequest(), { params: Promise.resolve({}) });
    const body = (await response.json()) as unknown;

    expect(response.status).toBe(200);
    expect(body).toEqual(live);
    expect(mockedCashRegisterService.getOpenCashRegisterSummary).toHaveBeenCalledWith(
      BRANCH_ID
    );
  });

  test('devuelve status cerrado cuando no hay caja abierta', async () => {
    mockedCashRegisterService.getOpenCashRegisterSummary.mockResolvedValue(null);

    const response = await GET(buildRequest(), { params: Promise.resolve({}) });
    const body = (await response.json()) as { status: string };

    expect(response.status).toBe(200);
    expect(body.status).toBe('closed');
  });
});
