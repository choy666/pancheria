/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from './route';
import * as orderService from '@/application/services/orderService';
import { getDefaultBranchId } from '@/lib/branch-resolver';
import { getWhatsAppNumber, getWhatsAppMessageParts } from '@/config/catalog';
import {
  ValidationError,
  NotFoundError,
  InsufficientStockError,
} from '@/domain/errors';

jest.mock('@/application/services/orderService');
jest.mock('@/lib/branch-resolver', () => ({
  ...jest.requireActual('@/lib/branch-resolver'),
  getDefaultBranchId: jest.fn(),
}));
jest.mock('@/config/catalog', () => ({
  getWhatsAppNumber: jest.fn(),
  getWhatsAppMessageParts: jest.fn(),
  getPedidoRefetchIntervalMs: jest.fn().mockReturnValue(30000),
}));
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  logError: jest.fn(),
}));

const mockedOrderService = orderService as jest.Mocked<typeof orderService>;
const mockedGetDefaultBranchId = getDefaultBranchId as jest.MockedFunction<
  typeof getDefaultBranchId
>;
const mockedGetWhatsAppNumber = getWhatsAppNumber as jest.MockedFunction<
  typeof getWhatsAppNumber
>;
const mockedGetWhatsAppMessageParts = getWhatsAppMessageParts as jest.MockedFunction<
  typeof getWhatsAppMessageParts
>;

const BRANCH_ID = 1;

function buildRequest(
  path = '',
  init?: ConstructorParameters<typeof NextRequest>[1]
): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/public/pedido${path ? `?${path}` : ''}`,
    init
  );
}

function createMockOrder() {
  return {
    id: 1,
    branchId: BRANCH_ID,
    orderNumber: 'PED-1-1234567890-abcdef',
    status: 'pending',
    total: 2000,
    customerName: 'Juan Pérez',
    deliveryType: 'pickup',
    address: null,
    notes: null,
    cancellationToken: 'token',
    branch: { id: BRANCH_ID, name: 'Sucursal Test', createdAt: new Date() },
    items: [
      {
        productId: 1,
        quantity: 2,
        unitPrice: 1000,
        subtotal: 2000,
        product: {
          name: 'Gaseosa',
          price: 1000,
          unit: 'unidad',
        },
      },
    ],
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  };
}

describe('POST /api/public/pedido', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetDefaultBranchId.mockResolvedValue(BRANCH_ID);
    mockedGetWhatsAppNumber.mockReturnValue('5493415555555');
    mockedGetWhatsAppMessageParts.mockReturnValue({
      greeting: 'Hola',
      closing: 'Gracias',
    });
  });

  const validBody = {
    items: [{ productId: 1, quantity: 2 }],
    customerName: 'Juan Pérez',
    deliveryType: 'pickup',
    idempotencyKey: 'key-1',
  };

  test('crea el pedido y devuelve el enlace de WhatsApp con status 201', async () => {
    const order = createMockOrder();
    mockedOrderService.createOrder.mockResolvedValue(order as any);

    const response = await POST(
      buildRequest('', { method: 'POST', body: JSON.stringify(validBody) })
    );
    const body = (await response.json()) as {
      order: typeof order & { branchName?: string };
      whatsappUrl: string;
    };

    expect(response.status).toBe(201);
    expect(body.order.orderNumber).toBe(order.orderNumber);
    expect(body.order.branchName).toBe('Sucursal Test');
    expect(body.order.expiresAt).toBeDefined();
    expect(body.whatsappUrl).toContain('https://wa.me/5493415555555');
    expect(mockedOrderService.createOrder).toHaveBeenCalledWith({
      branchId: BRANCH_ID,
      ...validBody,
    });
  });

  test('usa el branchId del query param cuando está presente', async () => {
    mockedOrderService.createOrder.mockResolvedValue(createMockOrder() as any);

    await POST(
      buildRequest('branchId=2', {
        method: 'POST',
        body: JSON.stringify(validBody),
      })
    );

    expect(mockedGetDefaultBranchId).not.toHaveBeenCalled();
    expect(mockedOrderService.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: 2 })
    );
  });

  test('crea el pedido con whatsappUrl nulo si no está configurado el número de WhatsApp', async () => {
    mockedGetWhatsAppNumber.mockImplementation(() => {
      throw new Error('NEXT_PUBLIC_WHATSAPP_NUMBER no está configurado.');
    });

    const order = createMockOrder();
    mockedOrderService.createOrder.mockResolvedValue(order as any);

    const response = await POST(
      buildRequest('', { method: 'POST', body: JSON.stringify(validBody) })
    );
    const body = (await response.json()) as {
      order: typeof order;
      whatsappUrl: string | null;
    };

    expect(response.status).toBe(201);
    expect(body.whatsappUrl).toBeNull();
    expect(mockedOrderService.createOrder).toHaveBeenCalled();
  });

  test('devuelve 400 cuando el cuerpo es inválido', async () => {
    const response = await POST(
      buildRequest('', {
        method: 'POST',
        body: JSON.stringify({ items: [], customerName: '' }),
      })
    );

    expect(response.status).toBe(400);
    expect(mockedOrderService.createOrder).not.toHaveBeenCalled();
  });

  test('devuelve 400 si no se puede resolver la sucursal por defecto', async () => {
    mockedGetDefaultBranchId.mockResolvedValue(null);

    const response = await POST(
      buildRequest('', {
        method: 'POST',
        body: JSON.stringify(validBody),
      })
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain('sucursal activa');
    expect(mockedOrderService.createOrder).not.toHaveBeenCalled();
  });

  test('devuelve 404 cuando la sucursal no existe', async () => {
    mockedOrderService.createOrder.mockRejectedValue(
      new NotFoundError('Sucursal', 999)
    );

    const response = await POST(
      buildRequest('', { method: 'POST', body: JSON.stringify(validBody) })
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toContain('Sucursal');
  });

  test('devuelve 409 cuando no hay stock suficiente', async () => {
    mockedOrderService.createOrder.mockRejectedValue(
      new InsufficientStockError('Gaseosa', 2, 5)
    );

    const response = await POST(
      buildRequest('', { method: 'POST', body: JSON.stringify(validBody) })
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(409);
    expect(body.error).toContain('Stock insuficiente');
  });

  test('devuelve 400 ante un ValidationError del servicio', async () => {
    mockedOrderService.createOrder.mockRejectedValue(
      new ValidationError('El producto no está activo.')
    );

    const response = await POST(
      buildRequest('', { method: 'POST', body: JSON.stringify(validBody) })
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('El producto no está activo.');
  });

  test('devuelve 503 ante un error de conexión a la base de datos', async () => {
    const dbError = Object.assign(new Error('connection refused'), {
      code: 'ECONNREFUSED',
    });
    mockedOrderService.createOrder.mockRejectedValue(dbError);

    const response = await POST(
      buildRequest('', { method: 'POST', body: JSON.stringify(validBody) })
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Error de conexión con la base de datos');
  });
});
