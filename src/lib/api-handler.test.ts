import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withApiErrorHandling } from './api-handler';
import {
  DomainError,
  ForbiddenError,
  InsufficientStockError,
  NotFoundError,
  UnauthorizedError,
} from '@/domain/errors';
import { DatabaseConnectionError } from '@/domain/errors';

jest.mock('./logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

function createRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/test');
}

describe('withApiErrorHandling', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    Object.assign(process.env, { NODE_ENV: originalNodeEnv });
  });

  test('devuelve la respuesta del handler sin modificar', async () => {
    const handler = jest.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    const wrapped = withApiErrorHandling(handler, 'test-route');

    const response = await wrapped(createRequest());

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('ok');
  });

  test('convierte UnauthorizedError en 401', async () => {
    const handler = jest.fn().mockRejectedValue(new UnauthorizedError('Token inválido'));
    const wrapped = withApiErrorHandling(handler);

    const response = await wrapped(createRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Token inválido');
  });

  test('convierte ForbiddenError en 403', async () => {
    const handler = jest.fn().mockRejectedValue(new ForbiddenError('Sin permisos'));
    const wrapped = withApiErrorHandling(handler);

    const response = await wrapped(createRequest());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Sin permisos');
  });

  test('convierte ZodError en 400 con detalles', async () => {
    const schema = z.object({ name: z.string().min(1) });
    const handler = jest.fn().mockImplementation(() => {
      schema.parse({ name: '' });
    });
    const wrapped = withApiErrorHandling(handler);

    const response = await wrapped(createRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Too small');
    expect(Array.isArray(body.details)).toBe(true);
  });

  test('convierte NotFoundError en 404', async () => {
    const handler = jest.fn().mockRejectedValue(new NotFoundError('Producto', 123));
    const wrapped = withApiErrorHandling(handler);

    const response = await wrapped(createRequest());
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Producto con ID 123 no encontrado.');
  });

  test('convierte InsufficientStockError en 409', async () => {
    const handler = jest
      .fn()
      .mockRejectedValue(new InsufficientStockError('Pan', 2, 5, 'Salchicha'));
    const wrapped = withApiErrorHandling(handler);

    const response = await wrapped(createRequest());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain('Stock insuficiente');
  });

  test('convierte DomainError genérico en 400', async () => {
    const handler = jest.fn().mockRejectedValue(new DomainError('Error de dominio'));
    const wrapped = withApiErrorHandling(handler);

    const response = await wrapped(createRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Error de dominio');
  });

  test('convierte DatabaseConnectionError en 503', async () => {
    const handler = jest.fn().mockRejectedValue(new DatabaseConnectionError());
    const wrapped = withApiErrorHandling(handler);

    const response = await wrapped(createRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe('Error de conexión con la base de datos');
  });

  test('convierte ECONNREFUSED en 503', async () => {
    const error = new Error('connect ECONNREFUSED');
    (error as { code?: string }).code = 'ECONNREFUSED';
    const handler = jest.fn().mockRejectedValue(error);
    const wrapped = withApiErrorHandling(handler);

    const response = await wrapped(createRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe('Error de conexión con la base de datos');
  });

  test('convierte aborto del cliente en 499', async () => {
    Object.assign(process.env, { NODE_ENV: 'test' });
    const error = new Error('The destination stream closed early.');
    const handler = jest.fn().mockRejectedValue(error);
    const wrapped = withApiErrorHandling(handler);

    const response = await wrapped(createRequest());

    expect(response.status).toBe(499);
  });

  test('convierte errores desconocidos en 500', async () => {
    const handler = jest.fn().mockRejectedValue(new Error('Error inesperado'));
    const wrapped = withApiErrorHandling(handler);

    const response = await wrapped(createRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Error interno del servidor');
  });
});
