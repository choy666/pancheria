/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from './route';
import * as orderService from '@/application/services/orderService';
import { requireAuth, getCurrentBranchId } from '@/lib/auth';
import {
  InsufficientStockError,
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
    `http://localhost:3000/api/pedidos/${id}/confirmar`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );
}

describe('POST /api/pedidos/[id]/confirmar', () => {
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

  test('confirma el pedido y devuelve 201', async () => {
    const sale = { id: 10, total: 1500 };
    mockedOrderService.convertOrderToSale.mockResolvedValue(sale as any);

    const response = await POST(
      buildRequest('1', {
        payments: [{ method: 'cash', amount: 1500 }],
        idempotencyKey: 'key-1',
      }),
      { params: Promise.resolve({ id: '1' }) }
    );
    const body = (await response.json()) as { sale: unknown };

    expect(response.status).toBe(201);
    expect(body.sale).toEqual(sale);
    expect(mockedOrderService.convertOrderToSale).toHaveBeenCalledWith({
      branchId: BRANCH_ID,
      orderId: 1,
      payments: [{ method: 'cash', amount: 1500 }],
      idempotencyKey: 'key-1',
    });
  });

  test('devuelve 400 cuando el id es inválido', async () => {
    const response = await POST(buildRequest('abc', {} as any), {
      params: Promise.resolve({ id: 'abc' }),
    });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('El ID de pedido debe ser un número positivo.');
  });

  test('devuelve 400 cuando el cuerpo es inválido', async () => {
    const response = await POST(
      buildRequest('1', {
        payments: [{ method: 'crypto', amount: 100 }],
        idempotencyKey: 'key-1',
      }),
      { params: Promise.resolve({ id: '1' }) }
    );

    expect(response.status).toBe(400);
  });

  test('devuelve 404 cuando el pedido no existe', async () => {
    mockedOrderService.convertOrderToSale.mockRejectedValue(
      new NotFoundError('Pedido', 99)
    );

    const response = await POST(
      buildRequest('99', {
        payments: [{ method: 'cash', amount: 1000 }],
        idempotencyKey: 'key-99',
      }),
      { params: Promise.resolve({ id: '99' }) }
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe('Pedido con ID 99 no encontrado.');
  });

  test('devuelve 409 cuando no hay stock', async () => {
    mockedOrderService.convertOrderToSale.mockRejectedValue(
      new InsufficientStockError('Pancho', 1, 3, 'Pan')
    );

    const response = await POST(
      buildRequest('1', {
        payments: [{ method: 'cash', amount: 1000 }],
        idempotencyKey: 'key-1',
      }),
      { params: Promise.resolve({ id: '1' }) }
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(409);
    expect(body.error).toContain('Stock insuficiente');
  });

  test('devuelve 400 ante un ValidationError', async () => {
    mockedOrderService.convertOrderToSale.mockRejectedValue(
      new ValidationError('No hay una caja abierta.')
    );

    const response = await POST(
      buildRequest('1', {
        payments: [{ method: 'cash', amount: 1000 }],
        idempotencyKey: 'key-1',
      }),
      { params: Promise.resolve({ id: '1' }) }
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('No hay una caja abierta.');
  });
});
