/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET, POST } from './route';
import * as productService from '@/application/services/productService';
import { requireAuth, requireAdmin, getCurrentBranchId } from '@/lib/auth';
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/domain/errors';

jest.mock('@/application/services/productService');
jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
  requireAdmin: jest.fn(),
  getCurrentBranchId: jest.fn(),
}));
jest.mock('@/lib/logger', () => ({
  logError: jest.fn(),
}));

const mockedProductService = productService as jest.Mocked<typeof productService>;
const mockedRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;
const mockedRequireAdmin = requireAdmin as jest.MockedFunction<typeof requireAdmin>;
const mockedGetCurrentBranchId =
  getCurrentBranchId as jest.MockedFunction<typeof getCurrentBranchId>;

const BRANCH_ID = 1;

describe('productos /api/productos', () => {
  let session: Awaited<ReturnType<typeof requireAuth>>;

  beforeEach(() => {
    jest.clearAllMocks();
    session = {
      user: { name: 'admin', role: 'admin', branchId: BRANCH_ID },
    } as Awaited<ReturnType<typeof requireAuth>>;
    mockedRequireAuth.mockResolvedValue(session);
    mockedRequireAdmin.mockImplementation(async () => {
      const s = await requireAuth();
      if (s.user.role !== 'admin') {
        throw new ForbiddenError('Se requieren permisos de administrador.');
      }
      return s;
    });
    mockedGetCurrentBranchId.mockResolvedValue(BRANCH_ID);
  });

  function buildRequest(
    path = '',
    init?: ConstructorParameters<typeof NextRequest>[1]
  ): NextRequest {
    return new NextRequest(
      `http://localhost:3000/api/productos${path}`,
      init
    );
  }

  describe('GET /api/productos', () => {
    test('devuelve 401 cuando el usuario no está autenticado', async () => {
      mockedRequireAuth.mockRejectedValue(
        new UnauthorizedError('Se requiere iniciar sesión.')
      );

      const response = await GET(buildRequest());
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(401);
      expect(body.error).toBe('Se requiere iniciar sesión.');
    });

    test('devuelve la lista de productos activos con status 200', async () => {
      const products = [{ id: 1, name: 'Pancho', branchId: BRANCH_ID }];
      mockedProductService.listActiveProducts.mockResolvedValue(
        products as unknown as Awaited<
          ReturnType<typeof productService.listActiveProducts>
        >
      );

      const response = await GET(buildRequest());
      const body = (await response.json()) as unknown[];

      expect(response.status).toBe(200);
      expect(body).toEqual(products);
      expect(mockedProductService.listActiveProducts).toHaveBeenCalledWith(
        BRANCH_ID
      );
    });

    test('incluye disponibilidad cuando se solicita', async () => {
      const products = [
        { id: 1, name: 'Pancho', availability: 5, branchId: BRANCH_ID },
      ];
      mockedProductService.listActiveProductsWithAvailability.mockResolvedValue(
        products as unknown as Awaited<
          ReturnType<typeof productService.listActiveProductsWithAvailability>
        >
      );

      const response = await GET(buildRequest('?includeAvailability=true'));
      const body = (await response.json()) as unknown[];

      expect(response.status).toBe(200);
      expect(body).toEqual(products);
      expect(
        mockedProductService.listActiveProductsWithAvailability
      ).toHaveBeenCalledWith(BRANCH_ID);
    });

    test('devuelve 404 cuando el servicio lanza NotFoundError', async () => {
      mockedProductService.listActiveProducts.mockRejectedValue(
        new NotFoundError('Producto', 1)
      );

      const response = await GET(buildRequest());
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(404);
      expect(body.error).toBe('Producto con ID 1 no encontrado.');
    });

    test('devuelve 503 ante un error de conexión a la base de datos', async () => {
      const dbError = Object.assign(new Error('connection refused'), {
        code: 'ECONNREFUSED',
      });
      mockedProductService.listActiveProducts.mockRejectedValue(dbError);

      const response = await GET(buildRequest());
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(503);
      expect(body.error).toBe('Error de conexión con la base de datos');
    });

    test('devuelve 500 ante cualquier error inesperado del servicio', async () => {
      mockedProductService.listActiveProducts.mockRejectedValue(
        new Error('Error desconocido')
      );

      const response = await GET(buildRequest());
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(500);
      expect(body.error).toBe('Error interno del servidor');
    });
  });

  describe('POST /api/productos', () => {
    const validBody = {
      name: 'Pancho',
      description: '',
      type: 'service',
      criticalSupplyType: null,
      price: 100,
      unit: 'unidad',
      stock: 0,
      minStock: 0,
      isActive: true,
    };

    test('devuelve 401 cuando la autenticación falla', async () => {
      mockedRequireAuth.mockRejectedValue(
        new UnauthorizedError('Se requiere iniciar sesión.')
      );

      const response = await POST(
        buildRequest('', {
          method: 'POST',
          body: JSON.stringify(validBody),
        })
      );
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(401);
      expect(body.error).toBe('Se requiere iniciar sesión.');
    });

    test('devuelve 403 cuando el usuario es operador', async () => {
      session = {
        user: { name: 'operator', role: 'operator', branchId: BRANCH_ID },
      } as Awaited<ReturnType<typeof requireAuth>>;
      mockedRequireAuth.mockResolvedValue(session);

      const response = await POST(
        buildRequest('', {
          method: 'POST',
          body: JSON.stringify(validBody),
        })
      );
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(403);
      expect(body.error).toBe('Se requieren permisos de administrador.');
    });

    test('crea un producto y devuelve status 201', async () => {
      const created = { id: 1, ...validBody, branchId: BRANCH_ID };
      mockedProductService.createProduct.mockResolvedValue(
        created as unknown as Awaited<ReturnType<typeof productService.createProduct>>
      );

      const response = await POST(
        buildRequest('', {
          method: 'POST',
          body: JSON.stringify(validBody),
        })
      );
      const body = (await response.json()) as unknown;

      expect(response.status).toBe(201);
      expect(body).toEqual(created);
      expect(mockedProductService.createProduct).toHaveBeenCalledWith(
        BRANCH_ID,
        expect.objectContaining({ name: 'Pancho', type: 'service' })
      );
    });

    test('devuelve 400 cuando el cuerpo es inválido', async () => {
      const response = await POST(
        buildRequest('', {
          method: 'POST',
          body: JSON.stringify({ name: '' }),
        })
      );
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(400);
      expect(body.error).toBeTruthy();
    });

    test('devuelve 400 ante un ValidationError del servicio', async () => {
      mockedProductService.createProduct.mockRejectedValue(
        new ValidationError('El producto no es válido.')
      );

      const response = await POST(
        buildRequest('', {
          method: 'POST',
          body: JSON.stringify(validBody),
        })
      );
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(400);
      expect(body.error).toBe('El producto no es válido.');
    });

    test('devuelve 503 ante un error de conexión a la base de datos', async () => {
      const dbError = Object.assign(new Error('connection refused'), {
        code: 'ECONNREFUSED',
      });
      mockedProductService.createProduct.mockRejectedValue(dbError);

      const response = await POST(
        buildRequest('', {
          method: 'POST',
          body: JSON.stringify(validBody),
        })
      );
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(503);
      expect(body.error).toBe('Error de conexión con la base de datos');
    });

    test('devuelve 500 ante cualquier error inesperado del servicio', async () => {
      mockedProductService.createProduct.mockRejectedValue(
        new Error('Error desconocido')
      );

      const response = await POST(
        buildRequest('', {
          method: 'POST',
          body: JSON.stringify(validBody),
        })
      );
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(500);
      expect(body.error).toBe('Error interno del servidor');
    });
  });
});
