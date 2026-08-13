/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET, POST } from './route';
import * as recipeService from '@/application/services/recipeService';
import { requireAuth, requireAdmin, getCurrentBranchId } from '@/lib/auth';
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/domain/errors';

jest.mock('@/application/services/recipeService');
jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
  requireAdmin: jest.fn(),
  getCurrentBranchId: jest.fn(),
}));
jest.mock('@/lib/logger', () => ({
  logError: jest.fn(),
}));

const mockedRecipeService = recipeService as jest.Mocked<typeof recipeService>;
const mockedRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;
const mockedRequireAdmin = requireAdmin as jest.MockedFunction<typeof requireAdmin>;
const mockedGetCurrentBranchId =
  getCurrentBranchId as jest.MockedFunction<typeof getCurrentBranchId>;

const BRANCH_ID = 1;

describe('recetas /api/recetas', () => {
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
    search = '',
    init?: ConstructorParameters<typeof NextRequest>[1]
  ): NextRequest {
    return new NextRequest(
      `http://localhost:3000/api/recetas${search ? `?${search}` : ''}`,
      init
    );
  }

  describe('GET /api/recetas', () => {
    test('devuelve 401 cuando la autenticación falla', async () => {
      mockedRequireAuth.mockRejectedValue(
        new UnauthorizedError('Se requiere iniciar sesión.')
      );

      const response = await GET(buildRequest('productId=1'));
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(401);
      expect(body.error).toBe('Se requiere iniciar sesión.');
    });

    test('devuelve 403 cuando el usuario es operador', async () => {
      session = {
        user: { name: 'operator', role: 'operator', branchId: BRANCH_ID },
      } as Awaited<ReturnType<typeof requireAuth>>;
      mockedRequireAuth.mockResolvedValue(session);

      const response = await GET(buildRequest('productId=1'));
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(403);
      expect(body.error).toBe('Se requieren permisos de administrador.');
    });

    test('devuelve 400 cuando falta el productId', async () => {
      const response = await GET(buildRequest(''));
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(400);
      expect(body.error).toBe('Se requiere un productId válido');
    });

    test('devuelve 400 cuando el productId es inválido', async () => {
      const response = await GET(buildRequest('productId=abc'));
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(400);
      expect(body.error).toBe('Se requiere un productId válido');
    });

    test('devuelve la receta con status 200', async () => {
      const recipe = [
        { compoundProductId: 1, supplyId: 2, quantity: 1, autoDiscount: true },
      ];
      mockedRecipeService.getRecipeByProductId.mockResolvedValue(
        recipe as unknown as Awaited<
          ReturnType<typeof recipeService.getRecipeByProductId>
        >
      );

      const response = await GET(buildRequest('productId=1'));
      const body = (await response.json()) as unknown[];

      expect(response.status).toBe(200);
      expect(body).toEqual(recipe);
      expect(mockedRecipeService.getRecipeByProductId).toHaveBeenCalledWith(
        BRANCH_ID,
        1
      );
    });

    test('devuelve 404 cuando el producto compuesto no existe', async () => {
      mockedRecipeService.getRecipeByProductId.mockRejectedValue(
        new NotFoundError('Producto compuesto', 99)
      );

      const response = await GET(buildRequest('productId=99'));
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(404);
      expect(body.error).toBe('Producto compuesto con ID 99 no encontrado.');
    });

    test('devuelve 503 ante un error de conexión a la base de datos', async () => {
      const dbError = Object.assign(new Error('connection refused'), {
        code: 'ECONNREFUSED',
      });
      mockedRecipeService.getRecipeByProductId.mockRejectedValue(dbError);

      const response = await GET(buildRequest('productId=1'));
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(503);
      expect(body.error).toBe('Error de conexión con la base de datos');
    });

    test('devuelve 500 ante cualquier error inesperado', async () => {
      mockedRecipeService.getRecipeByProductId.mockRejectedValue(
        new Error('Error desconocido')
      );

      const response = await GET(buildRequest('productId=1'));
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(500);
      expect(body.error).toBe('Error interno del servidor');
    });
  });

  describe('POST /api/recetas', () => {
    const validBody = {
      compoundProductId: 1,
      items: [{ supplyId: 2, quantity: 1, autoDiscount: true }],
    };

    test('devuelve 401 cuando la autenticación falla', async () => {
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

    test('devuelve 403 cuando el usuario es operador', async () => {
      session = {
        user: { name: 'operator', role: 'operator', branchId: BRANCH_ID },
      } as Awaited<ReturnType<typeof requireAuth>>;
      mockedRequireAuth.mockResolvedValue(session);

      const response = await POST(
        buildRequest('', { method: 'POST', body: JSON.stringify(validBody) })
      );
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(403);
      expect(body.error).toBe('Se requieren permisos de administrador.');
    });

    test('guarda la receta y devuelve status 201', async () => {
      const saved = [
        { compoundProductId: 1, supplyId: 2, quantity: 1, autoDiscount: true },
      ];
      mockedRecipeService.saveRecipe.mockResolvedValue(
        saved as unknown as Awaited<ReturnType<typeof recipeService.saveRecipe>>
      );

      const response = await POST(
        buildRequest('', { method: 'POST', body: JSON.stringify(validBody) })
      );
      const body = (await response.json()) as unknown[];

      expect(response.status).toBe(201);
      expect(body).toEqual(saved);
      expect(mockedRecipeService.saveRecipe).toHaveBeenCalledWith(
        BRANCH_ID,
        1,
        validBody.items
      );
    });

    test('devuelve 400 cuando el cuerpo es inválido', async () => {
      const response = await POST(
        buildRequest('', {
          method: 'POST',
          body: JSON.stringify({ compoundProductId: 1, items: [] }),
        })
      );

      expect(response.status).toBe(400);
    });

    test('devuelve 400 ante un ValidationError del servicio', async () => {
      mockedRecipeService.saveRecipe.mockRejectedValue(
        new ValidationError(
          'La receta debe incluir al menos un insumo crítico con descuento automático.'
        )
      );

      const response = await POST(
        buildRequest('', { method: 'POST', body: JSON.stringify(validBody) })
      );
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(400);
      expect(body.error).toBe(
        'La receta debe incluir al menos un insumo crítico con descuento automático.'
      );
    });

    test('devuelve 503 ante un error de conexión a la base de datos', async () => {
      const dbError = Object.assign(new Error('connection refused'), {
        code: 'ECONNREFUSED',
      });
      mockedRecipeService.saveRecipe.mockRejectedValue(dbError);

      const response = await POST(
        buildRequest('', { method: 'POST', body: JSON.stringify(validBody) })
      );
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(503);
      expect(body.error).toBe('Error de conexión con la base de datos');
    });

    test('devuelve 500 ante cualquier error inesperado', async () => {
      mockedRecipeService.saveRecipe.mockRejectedValue(
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
