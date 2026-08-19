/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from './route';
import * as orderService from '@/application/services/orderService';
import { getDefaultBranchId } from '@/lib/branch-resolver';

jest.mock('@/application/services/orderService');
jest.mock('@/lib/branch-resolver', () => ({
  ...jest.requireActual('@/lib/branch-resolver'),
  getDefaultBranchId: jest.fn(),
}));
jest.mock('@/lib/logger', () => ({
  logError: jest.fn(),
}));

const mockedOrderService = orderService as jest.Mocked<typeof orderService>;
const mockedGetDefaultBranchId = getDefaultBranchId as jest.MockedFunction<
  typeof getDefaultBranchId
>;

const BRANCH_ID = 1;

function buildRequest(
  id: number | string,
  path = '',
  init?: ConstructorParameters<typeof NextRequest>[1]
): [NextRequest, { params: Promise<{ id: string }> }] {
  return [
    new NextRequest(
      `http://localhost:3000/api/public/pedido/${id}/cancelar${
        path ? `?${path}` : ''
      }`,
      init
    ),
    { params: Promise.resolve({ id: String(id) }) },
  ];
}

describe('POST /api/public/pedido/[id]/cancelar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetDefaultBranchId.mockResolvedValue(BRANCH_ID);
    mockedOrderService.cancelOrder.mockResolvedValue({
      id: 1,
      branchId: BRANCH_ID,
      orderNumber: 'PED-1-1234567890-abcdef',
      status: 'cancelled',
    } as any);
  });

  test('cancela el pedido con branchId explícito', async () => {
    const [request, routeParams] = buildRequest(
      1,
      `branchId=${BRANCH_ID}`,
      {
        method: 'POST',
        body: JSON.stringify({
          reason: 'Cancelado por el cliente',
          token: 'token',
        }),
      }
    );

    const response = await POST(request, routeParams);

    expect(response.status).toBe(200);
    expect(mockedGetDefaultBranchId).not.toHaveBeenCalled();
    expect(mockedOrderService.cancelOrder).toHaveBeenCalledWith(
      BRANCH_ID,
      1,
      'Cancelado por el cliente',
      'token'
    );
  });

  test('usa la sucursal por defecto si no hay branchId', async () => {
    const [request, routeParams] = buildRequest(1, '', {
      method: 'POST',
      body: JSON.stringify({
        reason: 'Cancelado por el cliente',
        token: 'token',
      }),
    });

    const response = await POST(request, routeParams);

    expect(response.status).toBe(200);
    expect(mockedGetDefaultBranchId).toHaveBeenCalled();
    expect(mockedOrderService.cancelOrder).toHaveBeenCalledWith(
      BRANCH_ID,
      1,
      'Cancelado por el cliente',
      'token'
    );
  });

  test('devuelve 400 si el id de pedido no es válido', async () => {
    const [request, routeParams] = buildRequest('abc', `branchId=${BRANCH_ID}`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Cancelado', token: 'token' }),
    });

    const response = await POST(request, routeParams);

    expect(response.status).toBe(400);
    expect(mockedOrderService.cancelOrder).not.toHaveBeenCalled();
  });

  test('devuelve 400 si falta el token de cancelación', async () => {
    const [request, routeParams] = buildRequest(1, `branchId=${BRANCH_ID}`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Cancelado' }),
    });

    const response = await POST(request, routeParams);

    expect(response.status).toBe(400);
    expect(mockedOrderService.cancelOrder).not.toHaveBeenCalled();
  });

  test('devuelve 400 si no se puede resolver la sucursal por defecto', async () => {
    mockedGetDefaultBranchId.mockResolvedValue(null);

    const [request, routeParams] = buildRequest(1, '', {
      method: 'POST',
      body: JSON.stringify({ reason: 'Cancelado', token: 'token' }),
    });

    const response = await POST(request, routeParams);
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain('sucursal activa');
    expect(mockedOrderService.cancelOrder).not.toHaveBeenCalled();
  });
});
