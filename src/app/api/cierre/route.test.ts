/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET, POST } from './route';
import * as closureService from '@/application/services/closureService';
import { requireAuth, getCurrentBranchId } from '@/lib/auth';
import {
  UnauthorizedError,
  NotFoundError,
  ValidationError,
} from '@/domain/errors';

jest.mock('@/application/services/closureService');
jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
  getCurrentBranchId: jest.fn(),
}));
jest.mock('@/lib/logger', () => ({
  logError: jest.fn(),
}));

const mockedClosureService = closureService as jest.Mocked<typeof closureService>;
const mockedRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;
const mockedGetCurrentBranchId =
  getCurrentBranchId as jest.MockedFunction<typeof getCurrentBranchId>;

const BRANCH_ID = 1;

describe('cierre /api/cierre', () => {
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
    search = '',
    init?: ConstructorParameters<typeof NextRequest>[1]
  ): NextRequest {
    return new NextRequest(
      `http://localhost:3000/api/cierre${search ? `?${search}` : ''}`,
      init
    );
  }

  describe('GET /api/cierre', () => {
    test('devuelve 401 cuando el usuario no está autenticado', async () => {
      mockedRequireAuth.mockRejectedValue(
        new UnauthorizedError('Se requiere iniciar sesión.')
      );

      const response = await GET(buildRequest('date=2025-01-15'));
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(401);
      expect(body.error).toBe('Se requiere iniciar sesión.');
    });

    test('devuelve el cierre con status 200', async () => {
      const closure = {
        id: 1,
        branchId: BRANCH_ID,
        date: new Date('2025-01-15T00:00:00.000Z'),
      };
      mockedClosureService.getClosureByDate.mockResolvedValue(
        closure as unknown as Awaited<ReturnType<typeof closureService.getClosureByDate>>
      );

      const response = await GET(buildRequest('date=2025-01-15'));
      const body = (await response.json()) as unknown;

      expect(response.status).toBe(200);
      expect(body).toEqual({
        id: 1,
        branchId: BRANCH_ID,
        date: '2025-01-15T00:00:00.000Z',
      });
      expect(mockedClosureService.getClosureByDate).toHaveBeenCalledWith(
        BRANCH_ID,
        expect.any(Date)
      );
    });

    test('devuelve null cuando no hay cierre para la fecha', async () => {
      mockedClosureService.getClosureByDate.mockResolvedValue(undefined);

      const response = await GET(buildRequest('date=2025-01-15'));
      const body = (await response.json()) as unknown;

      expect(response.status).toBe(200);
      expect(body).toBeNull();
    });

    test('devuelve 404 cuando el servicio lanza NotFoundError', async () => {
      mockedClosureService.getClosureByDate.mockRejectedValue(
        new NotFoundError('Cierre', 1)
      );

      const response = await GET(buildRequest('date=2025-01-15'));
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(404);
      expect(body.error).toBe('Cierre con ID 1 no encontrado.');
    });

    test('devuelve 503 ante un error de conexión a la base de datos', async () => {
      const dbError = Object.assign(new Error('connection refused'), {
        code: 'ECONNREFUSED',
      });
      mockedClosureService.getClosureByDate.mockRejectedValue(dbError);

      const response = await GET(buildRequest('date=2025-01-15'));
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(503);
      expect(body.error).toBe('Error de conexión con la base de datos');
    });

    test('devuelve 500 ante cualquier error inesperado', async () => {
      mockedClosureService.getClosureByDate.mockRejectedValue(
        new Error('Error desconocido')
      );

      const response = await GET(buildRequest('date=2025-01-15'));
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(500);
      expect(body.error).toBe('Error interno del servidor');
    });
  });

  describe('POST /api/cierre', () => {
    const validBody = { date: '2025-01-15' };

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

    test('genera el cierre y devuelve status 201', async () => {
      const closure = {
        id: 1,
        branchId: BRANCH_ID,
        date: new Date('2025-01-15T00:00:00.000Z'),
      };
      mockedClosureService.generateClosure.mockResolvedValue(
        closure as unknown as Awaited<ReturnType<typeof closureService.generateClosure>>
      );

      const response = await POST(
        buildRequest('', { method: 'POST', body: JSON.stringify(validBody) })
      );
      const body = (await response.json()) as unknown;

      expect(response.status).toBe(201);
      expect(body).toEqual({
        id: 1,
        branchId: BRANCH_ID,
        date: '2025-01-15T00:00:00.000Z',
      });
      expect(mockedClosureService.generateClosure).toHaveBeenCalledWith(
        BRANCH_ID,
        expect.any(Date)
      );
    });

    test('genera el cierre para hoy cuando no se envía fecha', async () => {
      mockedClosureService.generateClosure.mockResolvedValue(
        { id: 1 } as unknown as Awaited<
          ReturnType<typeof closureService.generateClosure>
        >
      );

      await POST(buildRequest('', { method: 'POST', body: JSON.stringify({}) }));

      expect(mockedClosureService.generateClosure).toHaveBeenCalledWith(
        BRANCH_ID,
        expect.any(Date)
      );
    });

    test('devuelve 400 ante un ValidationError del servicio', async () => {
      mockedClosureService.generateClosure.mockRejectedValue(
        new ValidationError('No se puede generar un cierre para una fecha futura.')
      );

      const response = await POST(
        buildRequest('', { method: 'POST', body: JSON.stringify(validBody) })
      );
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(400);
      expect(body.error).toBe(
        'No se puede generar un cierre para una fecha futura.'
      );
    });

    test('devuelve 503 ante un error de conexión a la base de datos', async () => {
      const dbError = Object.assign(new Error('connection refused'), {
        code: 'ECONNREFUSED',
      });
      mockedClosureService.generateClosure.mockRejectedValue(dbError);

      const response = await POST(
        buildRequest('', { method: 'POST', body: JSON.stringify(validBody) })
      );
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(503);
      expect(body.error).toBe('Error de conexión con la base de datos');
    });

    test('devuelve 500 ante cualquier error inesperado', async () => {
      mockedClosureService.generateClosure.mockRejectedValue(
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
