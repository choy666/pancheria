/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from './route';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import { requireAuth, getCurrentBranchId } from '@/lib/auth';
import { UnauthorizedError, ValidationError } from '@/domain/errors';

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
  return new NextRequest('http://localhost:3000/api/caja/abrir', {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('POST /api/caja/abrir', () => {
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

  test('abre una caja y devuelve 201', async () => {
    const cashRegister = {
      id: 1,
      branchId: BRANCH_ID,
      openedBy: 'operador',
      status: 'open',
      initialAmount: 0,
    };
    mockedCashRegisterService.openCashRegister.mockResolvedValue(
      cashRegister as any
    );

    const response = await POST(buildRequest(), { params: Promise.resolve({}) });
    const body = (await response.json()) as unknown;

    expect(response.status).toBe(201);
    expect(body).toEqual(cashRegister);
    expect(mockedCashRegisterService.openCashRegister).toHaveBeenCalledWith({
      branchId: BRANCH_ID,
      openedBy: 'operador',
      initialAmount: undefined,
    });
  });

  test('abre una caja con monto inicial', async () => {
    const cashRegister = {
      id: 1,
      branchId: BRANCH_ID,
      openedBy: 'operador',
      status: 'open',
      initialAmount: 1000,
    };
    mockedCashRegisterService.openCashRegister.mockResolvedValue(
      cashRegister as any
    );

    const response = await POST(buildRequest({ initialAmount: 1000 }), { params: Promise.resolve({}) });
    const body = (await response.json()) as unknown;

    expect(response.status).toBe(201);
    expect(body).toEqual(cashRegister);
    expect(mockedCashRegisterService.openCashRegister).toHaveBeenCalledWith({
      branchId: BRANCH_ID,
      openedBy: 'operador',
      initialAmount: 1000,
    });
  });

  test('devuelve 400 cuando ya hay una caja abierta', async () => {
    mockedCashRegisterService.openCashRegister.mockRejectedValue(
      new ValidationError('Ya existe una caja abierta.')
    );

    const response = await POST(buildRequest(), { params: Promise.resolve({}) });

    expect(response.status).toBe(400);
  });

  test('devuelve 503 ante un error de conexión a la base de datos', async () => {
    const dbError = Object.assign(new Error('connection refused'), {
      code: 'ECONNREFUSED',
    });
    mockedCashRegisterService.openCashRegister.mockRejectedValue(dbError);

    const response = await POST(buildRequest(), { params: Promise.resolve({}) });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Error de conexión con la base de datos');
  });
});
