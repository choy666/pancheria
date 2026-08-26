/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from './route';
import * as orderService from '@/application/services/orderService';
import { requireAuth, getCurrentBranchId } from '@/lib/auth';
import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@/domain/errors';

jest.mock('@/application/services/orderService');
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

const mockedOrderService = orderService as jest.Mocked<typeof orderService>;
const mockedRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;
const mockedGetCurrentBranchId = getCurrentBranchId as jest.MockedFunction<
  typeof getCurrentBranchId
>;

const BRANCH_ID = 1;

function buildRequest(id: string, body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/pedidos/${id}/cancelar`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );
}

describe('POST /api/pedidos/[id]/cancelar', () => {
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

    const response = await POST(buildRequest('1', {} as any), {
      params: Promise.resolve({ id: '1' }),
    });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe('Se requiere iniciar sesión.');
  });

  test('cancela el pedido y devuelve 200', async () => {
    const order = { id: 1, status: 'cancelled' };
    mockedOrderService.cancelOrder.mockResolvedValue(order as any);

    const response = await POST(
      buildRequest('1', { reason: 'Cancelado por el cliente' }),
      { params: Promise.resolve({ id: '1' }) }
    );
    const body = (await response.json()) as { order: unknown };

    expect(response.status).toBe(200);
    expect(body.order).toEqual(order);
    expect(mockedOrderService.cancelOrder).toHaveBeenCalledWith(
      BRANCH_ID,
      1,
      'Cancelado por el cliente'
    );
  });

  test('devuelve 400 cuando el id es inválido', async () => {
    const response = await POST(buildRequest('abc', {} as any), {
      params: Promise.resolve({ id: 'abc' }),
    });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('El ID de pedido debe ser un número positivo.');
  });

  test('devuelve 400 cuando el motivo es inválido', async () => {
    const response = await POST(
      buildRequest('1', { reason: 'x' }),
      { params: Promise.resolve({ id: '1' }) }
    );

    expect(response.status).toBe(400);
  });

  test('devuelve 404 cuando el pedido no existe', async () => {
    mockedOrderService.cancelOrder.mockRejectedValue(
      new NotFoundError('Pedido', 99)
    );

    const response = await POST(
      buildRequest('99', { reason: 'No disponible' }),
      { params: Promise.resolve({ id: '99' }) }
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe('Pedido con ID 99 no encontrado.');
  });

  test('devuelve 400 ante un ValidationError', async () => {
    mockedOrderService.cancelOrder.mockRejectedValue(
      new ValidationError('El pedido ya fue confirmado.')
    );

    const response = await POST(
      buildRequest('1', { reason: 'Cancelado' }),
      { params: Promise.resolve({ id: '1' }) }
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('El pedido ya fue confirmado.');
  });
});
