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

describe('ventas /api/ventas/disponibilidad', () => {
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
    init?: ConstructorParameters<typeof NextRequest>[1]
  ): NextRequest {
    return new NextRequest(
      'http://localhost:3000/api/ventas/disponibilidad',
      init
    );
  }

  const validBody = {
    items: [{ productId: 1, quantity: 2 }],
    productIds: [1],
  };

  test('devuelve 401 cuando el usuario no está autenticado', async () => {
    mockedRequireAuth.mockRejectedValue(
      new UnauthorizedError('Se requiere iniciar sesión.')
    );

    const response = await POST(
      buildRequest({ method: 'POST', body: JSON.stringify(validBody) })
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe('Se requiere iniciar sesión.');
  });

  test('devuelve la disponibilidad del carrito con status 200', async () => {
    const result = {
      availabilityByProduct: { 1: 5 },
      consumedBySupply: {},
      shortageByProduct: {},
    };
    mockedSaleService.validateCartAvailability.mockResolvedValue(
      result as unknown as Awaited<
        ReturnType<typeof saleService.validateCartAvailability>
      >
    );

    const response = await POST(
      buildRequest({ method: 'POST', body: JSON.stringify(validBody) })
    );
    const body = (await response.json()) as unknown;

    expect(response.status).toBe(200);
    expect(body).toEqual(result);
    expect(mockedSaleService.validateCartAvailability).toHaveBeenCalledWith(
      BRANCH_ID,
      validBody.items,
      validBody.productIds
    );
  });

  test('devuelve 400 cuando el cuerpo es inválido', async () => {
    const response = await POST(
      buildRequest({
        method: 'POST',
        body: JSON.stringify({ items: [{ productId: 'invalid', quantity: -1 }] }),
      })
    );

    expect(response.status).toBe(400);
  });

  test('devuelve 404 cuando un producto no existe', async () => {
    mockedSaleService.validateCartAvailability.mockRejectedValue(
      new NotFoundError('Producto', 99)
    );

    const response = await POST(
      buildRequest({ method: 'POST', body: JSON.stringify(validBody) })
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe('Producto con ID 99 no encontrado.');
  });

  test('devuelve 400 ante un ValidationError del servicio', async () => {
    mockedSaleService.validateCartAvailability.mockRejectedValue(
      new ValidationError('El carrito no es válido.')
    );

    const response = await POST(
      buildRequest({ method: 'POST', body: JSON.stringify(validBody) })
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('El carrito no es válido.');
  });

  test('devuelve 503 ante un error de conexión a la base de datos', async () => {
    const dbError = Object.assign(new Error('connection refused'), {
      code: 'ECONNREFUSED',
    });
    mockedSaleService.validateCartAvailability.mockRejectedValue(dbError);

    const response = await POST(
      buildRequest({ method: 'POST', body: JSON.stringify(validBody) })
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Error de conexión con la base de datos');
  });

  test('devuelve 500 ante cualquier error inesperado', async () => {
    mockedSaleService.validateCartAvailability.mockRejectedValue(
      new Error('Error desconocido')
    );

    const response = await POST(
      buildRequest({ method: 'POST', body: JSON.stringify(validBody) })
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(body.error).toBe('Error interno del servidor');
  });
});
