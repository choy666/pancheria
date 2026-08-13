/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET, PUT, DELETE } from './route';
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

describe('productos /api/productos/[id]', () => {
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
    id: string,
    init?: ConstructorParameters<typeof NextRequest>[1],
    role: 'admin' | 'operator' = 'admin'
  ): [NextRequest, { params: Promise<{ id: string }> }] {
    if (role !== 'admin') {
      session = {
        user: { name: 'operator', role: 'operator', branchId: BRANCH_ID },
      } as Awaited<ReturnType<typeof requireAuth>>;
      mockedRequireAuth.mockResolvedValue(session);
    }
    return [
      new NextRequest(
        `http://localhost:3000/api/productos/${id}`,
        init
      ),
      { params: Promise.resolve({ id }) },
    ];
  }

  describe('GET /api/productos/[id]', () => {
    test('devuelve 401 cuando la autenticación falla', async () => {
      mockedRequireAuth.mockRejectedValue(
        new UnauthorizedError('Se requiere iniciar sesión.')
      );

      const [request, routeParams] = buildRequest('1');
      const response = await GET(request, routeParams);
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(401);
      expect(body.error).toBe('Se requiere iniciar sesión.');
    });

    test('devuelve 403 cuando el usuario es operador', async () => {
      const [request, routeParams] = buildRequest('1', undefined, 'operator');
      const response = await GET(request, routeParams);
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(403);
      expect(body.error).toBe('Se requieren permisos de administrador.');
    });

    test('devuelve 400 cuando el ID es inválido', async () => {
      const [request, routeParams] = buildRequest('abc');
      const response = await GET(request, routeParams);
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(400);
      expect(body.error).toBe('ID de producto inválido.');
    });

    test('devuelve el producto con status 200', async () => {
      const product = { id: 1, name: 'Pancho', branchId: BRANCH_ID };
      mockedProductService.getProductById.mockResolvedValue(
        product as unknown as Awaited<ReturnType<typeof productService.getProductById>>
      );

      const [request, routeParams] = buildRequest('1');
      const response = await GET(request, routeParams);
      const body = (await response.json()) as unknown;

      expect(response.status).toBe(200);
      expect(body).toEqual(product);
      expect(mockedProductService.getProductById).toHaveBeenCalledWith(
        BRANCH_ID,
        1
      );
    });

    test('devuelve 404 cuando el producto no existe', async () => {
      mockedProductService.getProductById.mockRejectedValue(
        new NotFoundError('Producto', 99)
      );

      const [request, routeParams] = buildRequest('99');
      const response = await GET(request, routeParams);
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(404);
      expect(body.error).toBe('Producto con ID 99 no encontrado.');
    });

    test('devuelve 503 ante un error de conexión a la base de datos', async () => {
      const dbError = Object.assign(new Error('connection refused'), {
        code: 'ECONNREFUSED',
      });
      mockedProductService.getProductById.mockRejectedValue(dbError);

      const [request, routeParams] = buildRequest('1');
      const response = await GET(request, routeParams);
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(503);
      expect(body.error).toBe('Error de conexión con la base de datos');
    });

    test('devuelve 500 ante cualquier error inesperado', async () => {
      mockedProductService.getProductById.mockRejectedValue(
        new Error('Error desconocido')
      );

      const [request, routeParams] = buildRequest('1');
      const response = await GET(request, routeParams);
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(500);
      expect(body.error).toBe('Error interno del servidor');
    });
  });

  describe('PUT /api/productos/[id]', () => {
    const validBody = { name: 'Pancho actualizado' };

    test('devuelve 401 cuando la autenticación falla', async () => {
      mockedRequireAuth.mockRejectedValue(
        new UnauthorizedError('Se requiere iniciar sesión.')
      );

      const [request, routeParams] = buildRequest('1', {
        method: 'PUT',
        body: JSON.stringify(validBody),
      });
      const response = await PUT(request, routeParams);
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(401);
      expect(body.error).toBe('Se requiere iniciar sesión.');
    });

    test('devuelve 403 cuando el usuario es operador', async () => {
      const [request, routeParams] = buildRequest(
        '1',
        {
          method: 'PUT',
          body: JSON.stringify(validBody),
        },
        'operator'
      );
      const response = await PUT(request, routeParams);
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(403);
      expect(body.error).toBe('Se requieren permisos de administrador.');
    });

    test('devuelve 400 cuando el ID es inválido', async () => {
      const [request, routeParams] = buildRequest('abc', {
        method: 'PUT',
        body: JSON.stringify(validBody),
      });
      const response = await PUT(request, routeParams);
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(400);
      expect(body.error).toBe('ID de producto inválido.');
    });

    test('actualiza el producto y devuelve status 200', async () => {
      const updated = { id: 1, name: 'Pancho actualizado', branchId: BRANCH_ID };
      mockedProductService.updateProduct.mockResolvedValue(
        updated as unknown as Awaited<ReturnType<typeof productService.updateProduct>>
      );

      const [request, routeParams] = buildRequest('1', {
        method: 'PUT',
        body: JSON.stringify(validBody),
      });
      const response = await PUT(request, routeParams);
      const body = (await response.json()) as unknown;

      expect(response.status).toBe(200);
      expect(body).toEqual(updated);
      expect(mockedProductService.updateProduct).toHaveBeenCalledWith(
        BRANCH_ID,
        1,
        expect.objectContaining({ name: 'Pancho actualizado' })
      );
    });

    test('devuelve 400 cuando el cuerpo es inválido', async () => {
      const [request, routeParams] = buildRequest('1', {
        method: 'PUT',
        body: JSON.stringify({ name: '' }),
      });
      const response = await PUT(request, routeParams);

      expect(response.status).toBe(400);
    });

    test('devuelve 400 ante un ValidationError del servicio', async () => {
      mockedProductService.updateProduct.mockRejectedValue(
        new ValidationError('No se puede cambiar el tipo del producto.')
      );

      const [request, routeParams] = buildRequest('1', {
        method: 'PUT',
        body: JSON.stringify(validBody),
      });
      const response = await PUT(request, routeParams);
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(400);
      expect(body.error).toBe('No se puede cambiar el tipo del producto.');
    });

    test('devuelve 404 cuando el producto no existe', async () => {
      mockedProductService.updateProduct.mockRejectedValue(
        new NotFoundError('Producto', 99)
      );

      const [request, routeParams] = buildRequest('99', {
        method: 'PUT',
        body: JSON.stringify(validBody),
      });
      const response = await PUT(request, routeParams);
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(404);
      expect(body.error).toBe('Producto con ID 99 no encontrado.');
    });

    test('devuelve 503 ante un error de conexión a la base de datos', async () => {
      const dbError = Object.assign(new Error('connection refused'), {
        code: 'ECONNREFUSED',
      });
      mockedProductService.updateProduct.mockRejectedValue(dbError);

      const [request, routeParams] = buildRequest('1', {
        method: 'PUT',
        body: JSON.stringify(validBody),
      });
      const response = await PUT(request, routeParams);
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(503);
      expect(body.error).toBe('Error de conexión con la base de datos');
    });

    test('devuelve 500 ante cualquier error inesperado', async () => {
      mockedProductService.updateProduct.mockRejectedValue(
        new Error('Error desconocido')
      );

      const [request, routeParams] = buildRequest('1', {
        method: 'PUT',
        body: JSON.stringify(validBody),
      });
      const response = await PUT(request, routeParams);
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(500);
      expect(body.error).toBe('Error interno del servidor');
    });
  });

  describe('DELETE /api/productos/[id]', () => {
    test('devuelve 401 cuando la autenticación falla', async () => {
      mockedRequireAuth.mockRejectedValue(
        new UnauthorizedError('Se requiere iniciar sesión.')
      );

      const [request, routeParams] = buildRequest('1');
      const response = await DELETE(request, routeParams);
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(401);
      expect(body.error).toBe('Se requiere iniciar sesión.');
    });

    test('devuelve 403 cuando el usuario es operador', async () => {
      const [request, routeParams] = buildRequest('1', undefined, 'operator');
      const response = await DELETE(request, routeParams);
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(403);
      expect(body.error).toBe('Se requieren permisos de administrador.');
    });

    test('devuelve 400 cuando el ID es inválido', async () => {
      const [request, routeParams] = buildRequest('abc');
      const response = await DELETE(request, routeParams);
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(400);
      expect(body.error).toBe('ID de producto inválido.');
    });

    test('elimina el producto y devuelve status 200', async () => {
      mockedProductService.deleteProduct.mockResolvedValue(
        { id: 1, name: 'Pancho' } as unknown as Awaited<
          ReturnType<typeof productService.deleteProduct>
        >
      );

      const [request, routeParams] = buildRequest('1');
      const response = await DELETE(request, routeParams);
      const body = (await response.json()) as { success: boolean };

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockedProductService.deleteProduct).toHaveBeenCalledWith(
        BRANCH_ID,
        1
      );
    });

    test('devuelve 404 cuando el producto no existe', async () => {
      mockedProductService.deleteProduct.mockRejectedValue(
        new NotFoundError('Producto', 99)
      );

      const [request, routeParams] = buildRequest('99');
      const response = await DELETE(request, routeParams);
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(404);
      expect(body.error).toBe('Producto con ID 99 no encontrado.');
    });

    test('devuelve 400 ante un ValidationError del servicio', async () => {
      mockedProductService.deleteProduct.mockRejectedValue(
        new ValidationError(
          "No se puede eliminar 'Pancho' porque forma parte de la promo activa 'Promo'."
        )
      );

      const [request, routeParams] = buildRequest('1');
      const response = await DELETE(request, routeParams);
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(400);
      expect(body.error).toContain('No se puede eliminar');
    });

    test('devuelve 503 ante un error de conexión a la base de datos', async () => {
      const dbError = Object.assign(new Error('connection refused'), {
        code: 'ECONNREFUSED',
      });
      mockedProductService.deleteProduct.mockRejectedValue(dbError);

      const [request, routeParams] = buildRequest('1');
      const response = await DELETE(request, routeParams);
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(503);
      expect(body.error).toBe('Error de conexión con la base de datos');
    });

    test('devuelve 500 ante cualquier error inesperado', async () => {
      mockedProductService.deleteProduct.mockRejectedValue(
        new Error('Error desconocido')
      );

      const [request, routeParams] = buildRequest('1');
      const response = await DELETE(request, routeParams);
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(500);
      expect(body.error).toBe('Error interno del servidor');
    });
  });
});
