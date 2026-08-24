/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET, POST } from './route';
import * as saleService from '@/application/services/saleService';
import * as saleRepository from '@/repositories/saleRepository';
import { requireAuth, getCurrentBranchId } from '@/lib/auth';
import {
  UnauthorizedError,
  NotFoundError,
  ValidationError,
  InsufficientStockError,
} from '@/domain/errors';

jest.mock('@/application/services/saleService');
jest.mock('@/repositories/saleRepository');
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
  logError: jest.fn(),
}));

const mockedSaleService = saleService as jest.Mocked<typeof saleService>;
const mockedSaleRepository =
  saleRepository as jest.Mocked<typeof saleRepository>;
const mockedRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;
const mockedGetCurrentBranchId =
  getCurrentBranchId as jest.MockedFunction<typeof getCurrentBranchId>;

const BRANCH_ID = 1;

describe('ventas /api/ventas', () => {
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
    path = '',
    init?: ConstructorParameters<typeof NextRequest>[1]
  ): NextRequest {
    return new NextRequest(
      `http://localhost:3000/api/ventas${path ? `?${path}` : ''}`,
      init
    );
  }

  describe('GET /api/ventas', () => {
    const paginatedResponse = {
      items: [],
      total: 0,
      page: 1,
      limit: 10,
    };

    test('devuelve 401 cuando el usuario no está autenticado', async () => {
      mockedRequireAuth.mockRejectedValue(
        new UnauthorizedError('Se requiere iniciar sesión.')
      );

      const response = await GET(buildRequest('date=2025-01-15'));
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(401);
      expect(body.error).toBe('Se requiere iniciar sesión.');
    });

    test('devuelve las ventas por fecha con status 200', async () => {
      mockedSaleRepository.findByDateRange.mockResolvedValue(
        paginatedResponse as unknown as Awaited<
          ReturnType<typeof saleRepository.findByDateRange>
        >
      );

      const response = await GET(buildRequest('date=2025-01-15'));
      const body = (await response.json()) as { items: unknown[] };

      expect(response.status).toBe(200);
      expect(body.items).toEqual([]);
      expect(mockedSaleRepository.findByDateRange).toHaveBeenCalledWith(
        BRANCH_ID,
        expect.any(Date),
        expect.any(Date),
        'active',
        { page: 1, limit: 10 }
      );
    });

    test('devuelve las ventas por caja con status 200', async () => {
      mockedSaleRepository.findByCashRegisterId.mockResolvedValue(
        paginatedResponse as unknown as Awaited<
          ReturnType<typeof saleRepository.findByCashRegisterId>
        >
      );

      const response = await GET(buildRequest('cashRegisterId=5'));
      const body = (await response.json()) as { items: unknown[] };

      expect(response.status).toBe(200);
      expect(body.items).toEqual([]);
      expect(mockedSaleRepository.findByCashRegisterId).toHaveBeenCalledWith(
        BRANCH_ID,
        5,
        undefined,
        { page: 1, limit: 10 }
      );
    });

    test('devuelve 400 cuando el ID de caja es inválido', async () => {
      const response = await GET(buildRequest('cashRegisterId=abc'));
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(400);
      expect(body.error).toBe('El ID de caja debe ser un número positivo.');
    });

    test('devuelve 404 cuando el repositorio lanza NotFoundError', async () => {
      mockedSaleRepository.findByDateRange.mockRejectedValue(
        new NotFoundError('Venta', 1)
      );

      const response = await GET(buildRequest('date=2025-01-15'));
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(404);
      expect(body.error).toBe('Venta con ID 1 no encontrado.');
    });

    test('devuelve 400 ante un ValidationError del repositorio', async () => {
      mockedSaleRepository.findByDateRange.mockRejectedValue(
        new ValidationError('Rango de fechas inválido.')
      );

      const response = await GET(buildRequest('date=2025-01-15'));
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(400);
      expect(body.error).toBe('Rango de fechas inválido.');
    });

    test('devuelve 503 ante un error de conexión a la base de datos', async () => {
      const dbError = Object.assign(new Error('connection refused'), {
        code: 'ECONNREFUSED',
      });
      mockedSaleRepository.findByDateRange.mockRejectedValue(dbError);

      const response = await GET(buildRequest('date=2025-01-15'));
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(503);
      expect(body.error).toBe('Error de conexión con la base de datos');
    });

    test('devuelve 500 ante cualquier error inesperado', async () => {
      mockedSaleRepository.findByDateRange.mockRejectedValue(
        new Error('Error desconocido')
      );

      const response = await GET(buildRequest('date=2025-01-15'));
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(500);
      expect(body.error).toBe('Error interno del servidor');
    });
  });

  describe('POST /api/ventas', () => {
    const validBody = {
      items: [{ productId: 1, quantity: 2 }],
      paymentMethod: 'cash',
      idempotencyKey: 'key-1',
    };

    test('devuelve 401 cuando el usuario no está autenticado', async () => {
      mockedRequireAuth.mockRejectedValue(
        new UnauthorizedError('Se requiere iniciar sesión.')
      );

      const response = await POST(
        buildRequest('', { method: 'POST', body: JSON.stringify(validBody) })
      );
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(401);
      expect(body.error).toBe('Se requiere iniciar sesión.');
    });

    test('confirma la venta y devuelve status 201', async () => {
      const sale = { id: 1, branchId: BRANCH_ID, ...validBody };
      mockedSaleService.confirmSale.mockResolvedValue(
        sale as unknown as Awaited<ReturnType<typeof saleService.confirmSale>>
      );

      const response = await POST(
        buildRequest('', { method: 'POST', body: JSON.stringify(validBody) })
      );
      const body = (await response.json()) as unknown;

      expect(response.status).toBe(201);
      expect(body).toEqual(sale);
      expect(mockedSaleService.confirmSale).toHaveBeenCalledWith({
        branchId: BRANCH_ID,
        ...validBody,
      });
    });

    test('devuelve 400 cuando el cuerpo es inválido', async () => {
      const response = await POST(
        buildRequest('', {
          method: 'POST',
          body: JSON.stringify({ items: [] }),
        })
      );

      expect(response.status).toBe(400);
    });

    test('devuelve 404 cuando un producto no existe', async () => {
      mockedSaleService.confirmSale.mockRejectedValue(
        new NotFoundError('Producto', 99)
      );

      const response = await POST(
        buildRequest('', { method: 'POST', body: JSON.stringify(validBody) })
      );
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(404);
      expect(body.error).toBe('Producto con ID 99 no encontrado.');
    });

    test('devuelve 409 cuando no hay stock suficiente', async () => {
      mockedSaleService.confirmSale.mockRejectedValue(
        new InsufficientStockError('Pancho', 1, 3, 'Pan')
      );

      const response = await POST(
        buildRequest('', { method: 'POST', body: JSON.stringify(validBody) })
      );
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(409);
      expect(body.error).toContain('Stock insuficiente');
    });

    test('devuelve 400 ante un ValidationError del servicio', async () => {
      mockedSaleService.confirmSale.mockRejectedValue(
        new ValidationError('No hay una caja abierta.')
      );

      const response = await POST(
        buildRequest('', { method: 'POST', body: JSON.stringify(validBody) })
      );
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(400);
      expect(body.error).toBe('No hay una caja abierta.');
    });

    test('devuelve 503 ante un error de conexión a la base de datos', async () => {
      const dbError = Object.assign(new Error('connection refused'), {
        code: 'ECONNREFUSED',
      });
      mockedSaleService.confirmSale.mockRejectedValue(dbError);

      const response = await POST(
        buildRequest('', { method: 'POST', body: JSON.stringify(validBody) })
      );
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(503);
      expect(body.error).toBe('Error de conexión con la base de datos');
    });

    test('devuelve 500 ante cualquier error inesperado', async () => {
      mockedSaleService.confirmSale.mockRejectedValue(
        new Error('Error desconocido')
      );

      const response = await POST(
        buildRequest('', { method: 'POST', body: JSON.stringify(validBody) })
      );
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(500);
      expect(body.error).toBe('Error interno del servidor');
    });
  });
});
