/**
 * @jest-environment node
 */
import { Readable } from 'stream';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { requireAdmin } from '@/lib/auth';
import * as storage from '@/lib/storage';
import { UnauthorizedError } from '@/domain/errors';

jest.mock('fs', () => ({
  createReadStream: jest.fn(),
  statSync: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
  requireAdmin: jest.fn(),
  getCurrentBranchId: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { createReadStream, statSync } from 'fs';

const mockedCreateReadStream = createReadStream as jest.MockedFunction<
  typeof createReadStream
>;
const mockedStatSync = statSync as jest.MockedFunction<typeof statSync>;

const mockedRequireAdmin = requireAdmin as jest.MockedFunction<
  typeof requireAdmin
>;

describe('GET /api/videos/[id]/stream', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    const session = { user: { name: 'admin', role: 'admin' } } as any;
    mockedRequireAdmin.mockResolvedValue(session);

    process.env.STORAGE_PROVIDER = 'local';
    process.env.LOCAL_STORAGE_PATH = '/tmp/videos';

    jest.spyOn(storage, 'getStorageProvider').mockReturnValue({
      getPublicUrl: jest.fn().mockReturnValue('https://remote.example.com/video.mp4'),
    } as unknown as storage.StorageProvider);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  function buildRequest(id: string, headers?: Record<string, string>): NextRequest {
    return new NextRequest(
      `http://localhost:3000/api/videos/${encodeURIComponent(id)}/stream`,
      { headers }
    );
  }

  test('devuelve 401 cuando el usuario no es admin', async () => {
    mockedRequireAdmin.mockRejectedValue(
      new UnauthorizedError('Se requiere ser administrador.')
    );

    const response = await GET(buildRequest('abc123.mp4'), {
      params: Promise.resolve({ id: 'abc123.mp4' }),
    });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe('Se requiere ser administrador.');
  });

  test('redirige si el proveedor no es local', async () => {
    process.env.STORAGE_PROVIDER = 'vercel-blob';

    const response = await GET(buildRequest('abc123.mp4'), {
      params: Promise.resolve({ id: 'abc123.mp4' }),
    });

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://remote.example.com/video.mp4'
    );
  });

  test('devuelve 404 si el key es inválido', async () => {
    const response = await GET(buildRequest('../etc/passwd.mp4'), {
      params: Promise.resolve({ id: '../etc/passwd.mp4' }),
    });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe('Video no encontrado.');
  });

  test('devuelve 404 si el archivo no existe', async () => {
    mockedStatSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });

    const response = await GET(buildRequest('abc123.mp4'), {
      params: Promise.resolve({ id: 'abc123.mp4' }),
    });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe('Video no encontrado.');
  });

  test('devuelve el video completo', async () => {
    mockedStatSync.mockReturnValue({ size: 100 } as any);

    const readable = new Readable({
      read() {
        this.push(Buffer.from('video'));
        this.push(null);
      },
    });
    mockedCreateReadStream.mockReturnValue(readable as any);

    const response = await GET(buildRequest('abc123.mp4'), {
      params: Promise.resolve({ id: 'abc123.mp4' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('video/mp4');
    expect(response.headers.get('Accept-Ranges')).toBe('bytes');
    expect(response.headers.get('Content-Length')).toBe('100');
  });

  test('devuelve 206 para un rango válido', async () => {
    mockedStatSync.mockReturnValue({ size: 100 } as any);

    const readable = new Readable({
      read() {
        this.push(Buffer.from('chunk'));
        this.push(null);
      },
    });
    mockedCreateReadStream.mockReturnValue(readable as any);

    const response = await GET(
      buildRequest('abc123.mp4', { Range: 'bytes=0-4' }),
      { params: Promise.resolve({ id: 'abc123.mp4' }) }
    );

    expect(response.status).toBe(206);
    expect(response.headers.get('Content-Range')).toBe('bytes 0-4/100');
    expect(response.headers.get('Content-Length')).toBe('5');
  });

  test('devuelve 416 para un rango inválido', async () => {
    mockedStatSync.mockReturnValue({ size: 100 } as any);

    const response = await GET(
      buildRequest('abc123.mp4', { Range: 'bytes=100-200' }),
      { params: Promise.resolve({ id: 'abc123.mp4' }) }
    );

    expect(response.status).toBe(416);
  });
});
