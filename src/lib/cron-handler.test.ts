/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { withCronAuth } from './cron-handler';
import { logger, logError } from './logger';

jest.mock('./logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
  logError: jest.fn(),
}));

const mockedLogger = logger as jest.Mocked<typeof logger>;
const mockedLogError = logError as jest.MockedFunction<typeof logError>;

const ORIGINAL_CRON_SECRET = process.env.CRON_SECRET;

beforeAll(() => {
  process.env.CRON_SECRET = 'secreto-cron';
});

afterAll(() => {
  process.env.CRON_SECRET = ORIGINAL_CRON_SECRET;
});

function buildRequest(authHeader?: string): NextRequest {
  return new NextRequest('http://localhost:3000/api/cron/test', {
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

describe('withCronAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve 401 sin autorización y no ejecuta el handler', async () => {
    const handler = jest.fn();
    const GET = withCronAuth('cron/test', handler);

    const response = await GET(buildRequest());

    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
    expect(mockedLogger.info).not.toHaveBeenCalled();
  });

  test('devuelve 401 si CRON_SECRET no está configurado', async () => {
    delete process.env.CRON_SECRET;
    const handler = jest.fn();
    const GET = withCronAuth('cron/test', handler);

    const response = await GET(buildRequest('Bearer x'));

    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
    process.env.CRON_SECRET = 'secreto-cron';
  });

  test('envuelve el payload con ok:true y loguea inicio/fin con duración', async () => {
    const handler = jest.fn().mockResolvedValue({ deleted: 7 });
    const GET = withCronAuth('cron/test', handler);

    const response = await GET(buildRequest('Bearer secreto-cron'));
    const body = (await response.json()) as { ok: boolean; deleted: number };

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, deleted: 7 });
    expect(mockedLogger.info).toHaveBeenCalledWith(
      'cron/test: inicio',
      expect.objectContaining({ source: 'cron' })
    );
    expect(mockedLogger.info).toHaveBeenCalledWith(
      'cron/test: fin',
      expect.objectContaining({
        source: 'cron',
        durationMs: expect.any(Number),
        deleted: 7,
      })
    );
  });

  test('devuelve 500 y loguea el error cuando el handler falla', async () => {
    const handler = jest.fn().mockRejectedValue(new Error('boom'));
    const GET = withCronAuth('cron/test', handler);

    const response = await GET(buildRequest('Bearer secreto-cron'));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(body.error).toBe('Error interno del servidor');
    expect(mockedLogError).toHaveBeenCalledWith(
      'cron/test: error',
      expect.any(Error),
      expect.objectContaining({ source: 'cron' })
    );
  });
});
