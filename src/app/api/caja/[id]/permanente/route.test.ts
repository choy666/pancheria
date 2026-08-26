/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { DELETE } from './route';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import { requireAdmin } from '@/lib/auth';
import { UnauthorizedError } from '@/domain/errors';

jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
  requireAdmin: jest.fn(),
  getCurrentBranchId: jest.fn().mockResolvedValue(1),
}));

jest.mock('@/application/services/cashRegisterService', () => ({
  permanentlyDeleteCashRegister: jest.fn(),
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
const mockedPermanentlyDelete = cashRegisterService.permanentlyDeleteCashRegister as jest.MockedFunction<
  typeof cashRegisterService.permanentlyDeleteCashRegister
>;

function createRequest(id: string) {
  return new NextRequest(`http://localhost:3000/api/caja/${id}/permanente`, { method: 'DELETE' });
}

describe('DELETE /api/caja/[id]/permanente', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const session = { user: { name: 'Admin', role: 'admin' } } as any;
    mockedRequireAdmin.mockResolvedValue(session);
  });

  test('devuelve 401 sin autenticación admin', async () => {
    mockedRequireAdmin.mockRejectedValue(new UnauthorizedError('No admin'));
    const response = await DELETE(createRequest('1'), { params: Promise.resolve({ id: '1' }) });
    expect(response.status).toBe(401);
  });

  test('devuelve 400 con ID inválido', async () => {
    const response = await DELETE(createRequest('abc'), { params: Promise.resolve({ id: 'abc' }) });
    const body = (await response.json()) as { error: string };
    expect(response.status).toBe(400);
    expect(body.error).toBe('ID de caja inválido.');
  });

  test('elimina permanentemente la caja', async () => {
    mockedPermanentlyDelete.mockResolvedValue({ id: 5 } as any);
    const response = await DELETE(createRequest('5'), { params: Promise.resolve({ id: '5' }) });
    const body = (await response.json()) as { id: number };
    expect(response.status).toBe(200);
    expect(body.id).toBe(5);
    expect(mockedPermanentlyDelete).toHaveBeenCalledWith(expect.any(Number), 5);
  });
});
