/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from './route';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import { requireAdmin } from '@/lib/auth';
import { UnauthorizedError } from '@/domain/errors';

jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
  requireAdmin: jest.fn(),
  getCurrentBranchId: jest.fn().mockResolvedValue(1),
}));

jest.mock('@/application/services/cashRegisterService', () => ({
  restoreCashRegister: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockedRequireAdmin = requireAdmin as jest.MockedFunction<typeof requireAdmin>;
const mockedRestore = cashRegisterService.restoreCashRegister as jest.MockedFunction<
  typeof cashRegisterService.restoreCashRegister
>;

function createRequest(id: string) {
  return new NextRequest(`http://localhost:3000/api/caja/${id}/restaurar`, { method: 'POST' });
}

describe('POST /api/caja/[id]/restaurar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const session = { user: { name: 'Admin', role: 'admin' } } as any;
    mockedRequireAdmin.mockResolvedValue(session);
  });

  test('devuelve 401 sin autenticación admin', async () => {
    mockedRequireAdmin.mockRejectedValue(new UnauthorizedError('No admin'));
    const response = await POST(createRequest('1'), { params: Promise.resolve({ id: '1' }) });
    expect(response.status).toBe(401);
  });

  test('devuelve 400 con ID inválido', async () => {
    const response = await POST(createRequest('abc'), { params: Promise.resolve({ id: 'abc' }) });
    const body = (await response.json()) as { error: string };
    expect(response.status).toBe(400);
    expect(body.error).toBe('ID de caja inválido.');
  });

  test('restaura la caja eliminada', async () => {
    const caja = { id: 7, status: 'closed' } as any;
    mockedRestore.mockResolvedValue(caja);
    const response = await POST(createRequest('7'), { params: Promise.resolve({ id: '7' }) });
    const body = (await response.json()) as typeof caja;
    expect(response.status).toBe(200);
    expect(body.id).toBe(7);
    expect(mockedRestore).toHaveBeenCalledWith(expect.any(Number), 7);
  });
});
