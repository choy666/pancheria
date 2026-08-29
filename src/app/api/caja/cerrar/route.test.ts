/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from './route';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import { requireAuth, getCurrentBranchId } from '@/lib/auth';
import { NotFoundError, UnauthorizedError, ValidationError } from '@/domain/errors';

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

function buildRequest(body?: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/caja/cerrar', {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('POST /api/caja/cerrar', () => {
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

    const response = await POST(buildRequest(), { params: Promise.resolve({}) });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe('Se requiere iniciar sesión.');
  });

  test('cierra la caja activa por branchId', async () => {
    const cashRegister = {
      id: 1,
      branchId: BRANCH_ID,
      closedBy: 'operador',
      status: 'closed',
    };
    mockedCashRegisterService.getOpenCashRegister.mockResolvedValue({
      id: 1,
    } as any);
    mockedCashRegisterService.closeCashRegister.mockResolvedValue(
      cashRegister as any
    );

    const response = await POST(buildRequest(), { params: Promise.resolve({}) });
    const body = (await response.json()) as unknown;

    expect(response.status).toBe(200);
    expect(body).toEqual(cashRegister);
    expect(mockedCashRegisterService.closeCashRegister).toHaveBeenCalledWith(
      BRANCH_ID,
      1,
      'operador',
      undefined,
      undefined
    );
  });

  test('cierra la caja por id si se envía', async () => {
    const cashRegister = { id: 5, branchId: BRANCH_ID, status: 'closed' };
    mockedCashRegisterService.closeCashRegister.mockResolvedValue(
      cashRegister as any
    );

    const response = await POST(
      buildRequest({ id: 5 }),
      { params: Promise.resolve({}) }
    );

    expect(response.status).toBe(200);
    expect(mockedCashRegisterService.closeCashRegister).toHaveBeenCalledWith(
      BRANCH_ID,
      5,
      'operador',
      undefined,
      undefined
    );
  });

  test('cierra la caja con conteo real de efectivo y notas', async () => {
    const cashRegister = { id: 1, branchId: BRANCH_ID, status: 'closed' };
    mockedCashRegisterService.getOpenCashRegister.mockResolvedValue({
      id: 1,
    } as any);
    mockedCashRegisterService.closeCashRegister.mockResolvedValue(
      cashRegister as any
    );

    const response = await POST(
      buildRequest({ closingCashCount: 1050, closingNotes: 'sobrante' }),
      { params: Promise.resolve({}) }
    );

    expect(response.status).toBe(200);
    expect(mockedCashRegisterService.closeCashRegister).toHaveBeenCalledWith(
      BRANCH_ID,
      1,
      'operador',
      1050,
      'sobrante'
    );
  });

  test('devuelve 400 si no hay una caja abierta', async () => {
    mockedCashRegisterService.getOpenCashRegister.mockResolvedValue(null as any);

    const response = await POST(buildRequest(), { params: Promise.resolve({}) });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('No hay una caja abierta.');
  });

  test('devuelve 404 cuando la caja no existe', async () => {
    mockedCashRegisterService.closeCashRegister.mockRejectedValue(
      new NotFoundError('Caja', 99)
    );

    const response = await POST(
      buildRequest({ id: 99 }),
      { params: Promise.resolve({}) }
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe('Caja con ID 99 no encontrado.');
  });

  test('devuelve 400 ante un ValidationError', async () => {
    mockedCashRegisterService.getOpenCashRegister.mockResolvedValue({
      id: 1,
    } as any);
    mockedCashRegisterService.closeCashRegister.mockRejectedValue(
      new ValidationError('La caja ya está cerrada.')
    );

    const response = await POST(buildRequest(), { params: Promise.resolve({}) });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('La caja ya está cerrada.');
  });
});
