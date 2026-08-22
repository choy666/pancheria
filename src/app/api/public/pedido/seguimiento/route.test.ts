/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from './route';
import * as orderService from '@/application/services/orderService';

jest.mock('@/application/services/orderService');

const mockedOrderService = orderService as jest.Mocked<typeof orderService>;

function buildRequest(body: object): NextRequest {
  return new NextRequest('http://localhost:3000/api/public/pedido/seguimiento', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/public/pedido/seguimiento', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve el pedido con token cuando está pendiente', async () => {
    mockedOrderService.trackOrder.mockResolvedValue({
      id: 1,
      orderNumber: 'PED-1-1234567890-abc',
      status: 'pending',
      total: 1200,
      customerName: 'Juan Pérez',
      branchId: 1,
      branchName: 'Sucursal A',
      cancellationToken: 'token',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    });

    const response = await POST(
      buildRequest({ orderNumber: 'PED-1-1234567890-abc', customerName: 'Juan Pérez' })
    );
    const body = (await response.json()) as { order: object };

    expect(response.status).toBe(200);
    expect(body.order).toMatchObject({
      id: 1,
      status: 'pending',
      cancellationToken: 'token',
    });
  });

  test('devuelve 404 cuando no encuentra el pedido', async () => {
    mockedOrderService.trackOrder.mockResolvedValue(null);

    const response = await POST(
      buildRequest({ orderNumber: 'PED-999', customerName: 'Juan Pérez' })
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
