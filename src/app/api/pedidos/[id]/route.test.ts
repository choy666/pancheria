/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from './route';
import * as orderService from '@/application/services/orderService';
import { requireAuth } from '@/lib/auth';
import { UnauthorizedError } from '@/domain/errors';

jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
  requireAdmin: jest.fn(),
  getCurrentBranchId: jest.fn().mockResolvedValue(1),
}));

jest.mock('@/application/services/orderService', () => ({
  getOrderById: jest.fn(),
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
const mockedGetOrder = orderService.getOrderById as jest.MockedFunction<
  typeof orderService.getOrderById
>;

function createRequest(id: string) {
  return new NextRequest(`http://localhost:3000/api/pedidos/${id}`);
}

describe('GET /api/pedidos/[id]', () => {
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
    expect(body.error).toBe('El ID de pedido debe ser un número positivo.');
  });

  test('devuelve 404 si el pedido no existe', async () => {
    mockedGetOrder.mockResolvedValue(null as any);
    const response = await GET(createRequest('42'), { params: Promise.resolve({ id: '42' }) });
    const body = (await response.json()) as { error: string };
    expect(response.status).toBe(404);
    expect(body.error).toBe('Pedido no encontrado.');
  });

  test('devuelve el pedido encontrado', async () => {
    const order = { id: 1, customerName: 'Juan' } as any;
    mockedGetOrder.mockResolvedValue(order);
    const response = await GET(createRequest('1'), { params: Promise.resolve({ id: '1' }) });
    const body = (await response.json()) as { order: typeof order };
    expect(response.status).toBe(200);
    expect(body.order.customerName).toBe('Juan');
  });
});
