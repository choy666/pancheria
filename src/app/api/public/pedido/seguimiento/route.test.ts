/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from './route';
import * as orderService from '@/application/services/orderService';
import { getDefaultBranchId } from '@/lib/branch-resolver';

jest.mock('@/application/services/orderService');
jest.mock('@/lib/branch-resolver', () => ({
  getDefaultBranchId: jest.fn(),
  DEFAULT_BRANCH_ERROR: 'No se encontró la sucursal activa. Volvé a intentar más tarde.',
}));

const mockedOrderService = orderService as jest.Mocked<typeof orderService>;
const mockedGetDefaultBranchId = getDefaultBranchId as jest.MockedFunction<
  typeof getDefaultBranchId
>;

function buildRequest(body: object): NextRequest {
  return new NextRequest('http://localhost:3000/api/public/pedido/seguimiento', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/public/pedido/seguimiento', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetDefaultBranchId.mockResolvedValue(1);
  });

  test('devuelve el pedido con token cuando está pendiente', async () => {
    mockedOrderService.trackOrder.mockResolvedValue({
      id: 1,
      orderNumber: 'PED-1-1234567890-abc',
      status: 'pending',
      total: 1200,
      customerName: 'Juan Pérez',
      customerPhone: '3415555555',
      branchId: 1,
      branchName: 'Sucursal A',
      cancellationToken: 'token',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    });

    const response = await POST(
      buildRequest({
        orderNumber: 'PED-1-1234567890-abc',
        customerPhone: '3415555555',
      })
    );
    const body = (await response.json()) as { order: object };

    expect(response.status).toBe(200);
    expect(body.order).toMatchObject({
      id: 1,
      status: 'pending',
      cancellationToken: 'token',
    });
    expect(mockedOrderService.trackOrder).toHaveBeenCalledWith(
      1,
      'PED-1-1234567890-abc',
      undefined,
      '3415555555'
    );
  });

  test('propaga el branchId explícito del body', async () => {
    mockedOrderService.trackOrder.mockResolvedValue(null);

    const response = await POST(
      buildRequest({
        orderNumber: 'PED-7',
        customerName: 'Ana',
        branchId: 5,
      })
    );

    expect(response.status).toBe(404);
    expect(mockedOrderService.trackOrder).toHaveBeenCalledWith(
      5,
      'PED-7',
      'Ana',
      undefined
    );
    expect(mockedGetDefaultBranchId).not.toHaveBeenCalled();
  });

  test('devuelve 400 cuando no se puede resolver la sucursal', async () => {
    mockedGetDefaultBranchId.mockResolvedValue(null);

    const response = await POST(
      buildRequest({ orderNumber: 'PED-1', customerName: 'Ana' })
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain('sucursal');
    expect(mockedOrderService.trackOrder).not.toHaveBeenCalled();
  });

  test('devuelve 404 cuando no encuentra el pedido', async () => {
    mockedOrderService.trackOrder.mockResolvedValue(null);

    const response = await POST(
      buildRequest({ orderNumber: 'PED-999', customerPhone: '3415555555' })
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toContain('No se encontró el pedido');
  });

  test('devuelve 400 cuando faltan datos', async () => {
    const response = await POST(buildRequest({ orderNumber: '' }));

    expect(response.status).toBe(400);
    expect(mockedOrderService.trackOrder).not.toHaveBeenCalled();
  });
});
