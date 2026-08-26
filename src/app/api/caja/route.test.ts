/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from './route';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import { requireAuth } from '@/lib/auth';
import { UnauthorizedError } from '@/domain/errors';

jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
  requireAdmin: jest.fn(),
  getCurrentBranchId: jest.fn().mockResolvedValue(1),
}));

jest.mock('@/application/services/cashRegisterService', () => ({
  getOpenCashRegister: jest.fn(),
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
const mockedGetOpen = cashRegisterService.getOpenCashRegister as jest.MockedFunction<
  typeof cashRegisterService.getOpenCashRegister
>;

describe('GET /api/caja', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const session = { user: { name: 'Admin', role: 'admin' } } as any;
    mockedRequireAuth.mockResolvedValue(session);
  });

  const emptyContext = { params: Promise.resolve({}) };

  test('devuelve 401 sin autenticación', async () => {
    mockedRequireAuth.mockRejectedValue(new UnauthorizedError('No autenticado'));
    const response = await GET(new NextRequest('http://localhost:3000/api/caja'), emptyContext);
    expect(response.status).toBe(401);
  });

  test('devuelve la caja abierta', async () => {
    const caja = { id: 1, status: 'open' } as any;
    mockedGetOpen.mockResolvedValue(caja);
    const response = await GET(new NextRequest('http://localhost:3000/api/caja'), emptyContext);
    const body = (await response.json()) as typeof caja;
    expect(response.status).toBe(200);
    expect(body.status).toBe('open');
  });

  test('devuelve status closed si no hay caja abierta', async () => {
    mockedGetOpen.mockResolvedValue(null);
    const response = await GET(new NextRequest('http://localhost:3000/api/caja'), emptyContext);
    const body = (await response.json()) as { status: string };
    expect(response.status).toBe(200);
    expect(body.status).toBe('closed');
  });
});
