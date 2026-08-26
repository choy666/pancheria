/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from './route';
import { requireAdmin } from '@/lib/auth';
import * as storage from '@/lib/storage';
import { UnauthorizedError } from '@/domain/errors';

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

const mockedRequireAdmin = requireAdmin as jest.MockedFunction<
  typeof requireAdmin
>;

describe('POST /api/videos/upload', () => {
  const saveFile = jest.fn().mockResolvedValue('/api/videos/abc123.mp4/stream');
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    const session = { user: { name: 'admin', role: 'admin' } } as any;
    mockedRequireAdmin.mockResolvedValue(session);

    process.env.STORAGE_PROVIDER = 'local';
    process.env.NEXT_PUBLIC_VIDEO_ALLOWED_MIME_TYPES =
      'video/mp4,video/webm,video/ogg';
    process.env.NEXT_PUBLIC_VIDEO_MAX_SIZE_MB = '100';

    jest
      .spyOn(storage, 'getStorageProvider')
      .mockReturnValue({ saveFile } as unknown as storage.StorageProvider);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  function buildFormData(key: string, file?: File): FormData {
    const form = new FormData();
    form.append('key', key);
    if (file) {
      form.append('file', file);
    }
    return form;
  }

  test('devuelve 401 cuando el usuario no es admin', async () => {
    mockedRequireAdmin.mockRejectedValue(
      new UnauthorizedError('Se requiere ser administrador.')
    );

    const request = new NextRequest('http://localhost:3000/api/videos/upload', {
      method: 'POST',
      body: buildFormData('abc123.mp4'),
    });

    const response = await POST(request, { params: Promise.resolve({}) });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe('Se requiere ser administrador.');
  });

  test('devuelve 400 si el storage no es local', async () => {
    process.env.STORAGE_PROVIDER = 'vercel-blob';

    const request = new NextRequest('http://localhost:3000/api/videos/upload', {
      method: 'POST',
      body: buildFormData('abc123.mp4', new File([], 'video.mp4', { type: 'video/mp4' })),
    });

    const response = await POST(request, { params: Promise.resolve({}) });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe(
      'La subida directa solo está disponible en modo local.'
    );
  });

  test('devuelve 400 si faltan campos', async () => {
    const request = new NextRequest('http://localhost:3000/api/videos/upload', {
      method: 'POST',
      body: buildFormData('abc123.mp4'),
    });

    const response = await POST(request, { params: Promise.resolve({}) });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('Faltan el identificador o el archivo.');
  });

  test('devuelve 400 si el key es inválido', async () => {
    const request = new NextRequest('http://localhost:3000/api/videos/upload', {
      method: 'POST',
      body: buildFormData(
        '../escape.mp4',
        new File([], 'video.mp4', { type: 'video/mp4' })
      ),
    });

    const response = await POST(request, { params: Promise.resolve({}) });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('El identificador del video no es válido.');
  });

  test('devuelve 400 si el tipo de archivo no está permitido', async () => {
    const request = new NextRequest('http://localhost:3000/api/videos/upload', {
      method: 'POST',
      body: buildFormData(
        'abc123.mp4',
        new File([], 'video.avi', { type: 'video/avi' })
      ),
    });

    const response = await POST(request, { params: Promise.resolve({}) });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain('no está permitido');
  });

  test('devuelve 400 si el archivo supera el tamaño máximo', async () => {
    const hugeFile = new File(
      [new Uint8Array(200 * 1024 * 1024)],
      'video.mp4',
      { type: 'video/mp4' }
    );

    const request = new NextRequest('http://localhost:3000/api/videos/upload', {
      method: 'POST',
      body: buildFormData('abc123.mp4', hugeFile),
    });

    const response = await POST(request, { params: Promise.resolve({}) });

    expect(response.status).toBe(400);
  });

  test('guarda el archivo y devuelve la URL pública', async () => {
    const file = new File([new Uint8Array(100)], 'video.mp4', {
      type: 'video/mp4',
    });

    const request = new NextRequest('http://localhost:3000/api/videos/upload', {
      method: 'POST',
      body: buildFormData('abc123.mp4', file),
    });

    const response = await POST(request, { params: Promise.resolve({}) });
    const body = (await response.json()) as { url: string };

    expect(response.status).toBe(200);
    expect(body.url).toBe('/api/videos/abc123.mp4/stream');
    expect(saveFile).toHaveBeenCalledWith('abc123.mp4', file);
  });
});
