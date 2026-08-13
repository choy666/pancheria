/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from './route';
import * as saleService from '@/application/services/saleService';
import { requireAuth, getCurrentBranchId } from '@/lib/auth';
import {
  UnauthorizedError,
  NotFoundError,
  ValidationError,
} from '@/domain/errors';

jest.mock('@/application/services/saleService');
jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
  getCurrentBranchId: jest.fn(),
}));
jest.mock('@/lib/logger', () => ({
  logError: jest.fn(),
}));

const mockedSaleService = saleService as jest.Mocked<typeof saleService>;
const mockedRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;
const mockedGetCurrentBranchId =
  getCurrentBranchId as jest.MockedFunction<typeof getCurrentBranchId>;

const BRANCH_ID = 1;

describe('ventas /api/ventas/[id]/anular', () => {
  let session: Awaited<ReturnType<typeof requireAuth>>;

  beforeEach(() => {
    jest.clearAllMocks();
    session = {
      user: { name: 'operator', role: 'operator', branchId: BRANCH_ID },
    } as Awaited<ReturnType<typeof requireAuth>>;
    mockedRequireAuth.mockResolvedValue(session);
    mockedGetCurrentBranchId.mockResolvedValue(BRANCH_ID);
  });

  function buildRequest(
    id: string,
    init?: ConstructorParameters<typeof NextRequest>[1]
  ): [NextRequest, { params: Promise<{ id: string }> }] {
    return [
      new NextRequest(`http://localhost:3000/api/ventas/${id}/anular`, init),
      { params: Promise.resolve({ id }) },
    ];
  }

  const validBody = { reason: 'Cliente arrepentido' };

  test('devuelve 401 cuando el usuario no está autenticado', async () => {
    mockedRequireAuth.mockRejectedValue(
      new UnauthorizedError('Se requiere iniciar sesión.')
    );

    const [request, routeParams] = buildRequest('1', {
      method: 'POST',
      body: JSON.stringify(validBody),
    });
    const response = await POST(request, routeParams);
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe('Se requiere iniciar sesión.');
  });

  test('devuelve 400 cuando el ID de venta es inválido', async () => {
    const [request, routeParams] = buildRequest('abc', {
      method: 'POST',
      body: JSON.stringify(validBody),
    });
    const response = await POST(request, routeParams);
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('ID de venta inválido.');
  });

  test('devuelve 400 cuando el motivo es inválido', async () => {
    const [request, routeParams] = buildRequest('1', {
      method: 'POST',
      body: JSON.stringify({ reason: 'no' }),
    });
    const response = await POST(request, routeParams);

    expect(response.status).toBe(400);
  });

  test('anula la venta y devuelve status 200', async () => {
    const cancelled = { id: 1, status: 'cancelled' };
    mockedSaleService.cancelSale.mockResolvedValue(
      cancelled as unknown as Awaited<ReturnType<typeof saleService.cancelSale>>
    );

    const [request, routeParams] = buildRequest('1', {
      method: 'POST',
      body: JSON.stringify(validBody),
    });
    const response = await POST(request, routeParams);
    const body = (await response.json()) as unknown;

    expect(response.status).toBe(200);
    expect(body).toEqual(cancelled);
    expect(mockedSaleService.cancelSale).toHaveBeenCalledWith(
      BRANCH_ID,
      1,
      validBody.reason
    );
  });

  test('devuelve 404 cuando la venta no existe', async () => {
    mockedSaleService.cancelSale.mockRejectedValue(
      new NotFoundError('Venta', 99)
    );

    const [request, routeParams] = buildRequest('99', {
      method: 'POST',
      body: JSON.stringify(validBody),
    });
    const response = await POST(request, routeParams);
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe('Venta con ID 99 no encontrado.');
  });

  test('devuelve 400 cuando la caja está cerrada o eliminada', async () => {
    mockedSaleService.cancelSale.mockRejectedValue(
      new ValidationError(
        'No se puede anular una venta de una caja cerrada o eliminada.'
      )
    );

    const [request, routeParams] = buildRequest('1', {
      method: 'POST',
      body: JSON.stringify(validBody),
    });
    const response = await POST(request, routeParams);
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe(
      'No se puede anular una venta de una caja cerrada o eliminada.'
    );
  });

  test('devuelve 503 ante un error de conexión a la base de datos', async () => {
    const dbError = Object.assign(new Error('connection refused'), {
      code: 'ECONNREFUSED',
    });
    mockedSaleService.cancelSale.mockRejectedValue(dbError);

    const [request, routeParams] = buildRequest('1', {
      method: 'POST',
      body: JSON.stringify(validBody),
    });
    const response = await POST(request, routeParams);
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Error de conexión con la base de datos');
  });

  test('devuelve 500 ante cualquier error inesperado', async () => {
    mockedSaleService.cancelSale.mockRejectedValue(
      new Error('Error desconocido')
    );

    const [request, routeParams] = buildRequest('1', {
      method: 'POST',
      body: JSON.stringify(validBody),
    });
    const response = await POST(request, routeParams);
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(body.error).toBe('Error interno del servidor');
  });
});
