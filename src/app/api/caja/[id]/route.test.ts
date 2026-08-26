/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET, DELETE } from './route';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import { requireAdmin, requireAuth, getCurrentBranchId } from '@/lib/auth';
import { UnauthorizedError } from '@/domain/errors';

jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
  requireAdmin: jest.fn(),
  getCurrentBranchId: jest.fn().mockResolvedValue(1),
}));

jest.mock('@/application/services/cashRegisterService', () => ({
  getCashRegisterById: jest.fn(),
  deleteCashRegister: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockedRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;
const mockedRequireAdmin = requireAdmin as jest.MockedFunction<typeof requireAdmin>;
const mockedGetById = cashRegisterService.getCashRegisterById as jest.MockedFunction<
  typeof cashRegisterService.getCashRegisterById
>;
const mockedDelete = cashRegisterService.deleteCashRegister as jest.MockedFunction<
  typeof cashRegisterService.deleteCashRegister
>;

function createRequest(id: string, method = 'GET') {
  return new NextRequest(`http://localhost:3000/api/caja/${id}`, { method });
}

describe('GET /api/caja/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const session = { user: { name: 'Admin', role: 'admin' } } as any;
    mockedRequireAuth.mockResolvedValue(session);
  });

  test('devuelve 401 sin autenticación', async () => {
    mockedRequireAuth.mockRejectedValue(new UnauthorizedError('No autenticado'));
    const response = await GET(createRequest('1'), { params: Promise.resolve({ id: '1' }) });
    expect(response.status).toBe(401);
  });

  test('devuelve 400 con ID inválido', async () => {
    const response = await GET(createRequest('abc'), { params: Promise.resolve({ id: 'abc' }) });
    const body = (await response.json()) as { error: string };
    expect(response.status).toBe(400);
    expect(body.error).toBe('ID de caja inválido.');
  });

  test('devuelve 404 si la caja no existe', async () => {
    mockedGetById.mockResolvedValue(null);
    const response = await GET(createRequest('42'), { params: Promise.resolve({ id: '42' }) });
    const body = (await response.json()) as { error: string };
    expect(response.status).toBe(404);
    expect(body.error).toBe('Caja no encontrada.');
  });

  test('devuelve la caja encontrada', async () => {
    const caja = { id: 1, status: 'open' } as any;
    mockedGetById.mockResolvedValue(caja);
    const response = await GET(createRequest('1'), { params: Promise.resolve({ id: '1' }) });
    const body = (await response.json()) as typeof caja;
    expect(response.status).toBe(200);
    expect(body.id).toBe(1);
  });
});

describe('DELETE /api/caja/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const session = { user: { name: 'Admin', role: 'admin' } } as any;
    mockedRequireAdmin.mockResolvedValue(session);
  });

  test('devuelve 401 sin autenticación admin', async () => {
    mockedRequireAdmin.mockRejectedValue(new UnauthorizedError('No admin'));
    const response = await DELETE(createRequest('1', 'DELETE'), { params: Promise.resolve({ id: '1' }) });
    expect(response.status).toBe(401);
  });

  test('elimina la caja y devuelve deleted: true', async () => {
    mockedDelete.mockResolvedValue(undefined as any);
    const response = await DELETE(createRequest('3', 'DELETE'), { params: Promise.resolve({ id: '3' }) });
    const body = (await response.json()) as { deleted: boolean };
    expect(response.status).toBe(200);
    expect(body.deleted).toBe(true);
    expect(mockedDelete).toHaveBeenCalledWith(expect.any(Number), 3);
  });
});
