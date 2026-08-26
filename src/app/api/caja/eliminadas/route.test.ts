/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET, DELETE } from './route';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import { requireAdmin } from '@/lib/auth';
import { UnauthorizedError } from '@/domain/errors';

jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
  requireAdmin: jest.fn(),
  getCurrentBranchId: jest.fn().mockResolvedValue(1),
}));

jest.mock('@/application/services/cashRegisterService', () => ({
  listDeletedCashRegisterHistory: jest.fn(),
  emptyTrash: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/config/caja', () => ({
  ...jest.requireActual('@/config/caja'),
  getDefaultCajaHistoryDays: jest.fn().mockReturnValue(30),
}));

const mockedRequireAdmin = requireAdmin as jest.MockedFunction<typeof requireAdmin>;
const mockedListDeleted = cashRegisterService.listDeletedCashRegisterHistory as jest.MockedFunction<
  typeof cashRegisterService.listDeletedCashRegisterHistory
>;
const mockedEmptyTrash = cashRegisterService.emptyTrash as jest.MockedFunction<
  typeof cashRegisterService.emptyTrash
>;

function createRequest(method = 'GET', query = '') {
  return new NextRequest(`http://localhost:3000/api/caja/eliminadas${query}`, { method });
}

const emptyContext = { params: Promise.resolve({}) };

describe('GET /api/caja/eliminadas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const session = { user: { name: 'Admin', role: 'admin' } } as any;
    mockedRequireAdmin.mockResolvedValue(session);
  });

  test('devuelve 401 sin autenticación admin', async () => {
    mockedRequireAdmin.mockRejectedValue(new UnauthorizedError('No admin'));
    const response = await GET(createRequest(), emptyContext);
    expect(response.status).toBe(401);
  });

  test('lista cajas eliminadas con rango por defecto', async () => {
    mockedListDeleted.mockResolvedValue({
      items: [{ id: 1 }],
      total: 1,
      page: 1,
      limit: 10,
    } as any);
    const response = await GET(createRequest(), emptyContext);
    const body = (await response.json()) as { items: unknown[] };
    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(mockedListDeleted).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Date),
      expect.any(Date),
      expect.any(Object)
    );
  });

  test('respeta parámetros start y end', async () => {
    mockedListDeleted.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 10,
    } as any);
    const response = await GET(createRequest('GET', '?start=2026-01-01&end=2026-01-31'), emptyContext);
    expect(response.status).toBe(200);
    expect(mockedListDeleted).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Date),
      expect.any(Date),
      expect.any(Object)
    );
  });
});

describe('DELETE /api/caja/eliminadas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const session = { user: { name: 'Admin', role: 'admin' } } as any;
    mockedRequireAdmin.mockResolvedValue(session);
  });

  test('vacia la papelera de cajas eliminadas', async () => {
    mockedEmptyTrash.mockResolvedValue({ deleted: 2 });
    const response = await DELETE(createRequest('DELETE'), emptyContext);
    const body = (await response.json()) as { deleted: number };
    expect(response.status).toBe(200);
    expect(body.deleted).toBe(2);
    expect(mockedEmptyTrash).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Date),
      expect.any(Date)
    );
  });
});
