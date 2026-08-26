/**
 * @jest-environment node
 */
import { promises as fs } from 'fs';
import {
  getStorageProvider,
  guessMimeType,
  isValidLocalVideoKey,
  resolveLocalVideoPath,
} from './storage';

const mockWriteFile = jest.fn();
const mockReadFile = jest.fn();
const mockMkdir = jest.fn();

jest.mock('fs', () => ({
  promises: {
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
    readFile: (...args: unknown[]) => mockReadFile(...args),
    mkdir: (...args: unknown[]) => mockMkdir(...args),
  },
}));

jest.mock('nanoid', () => ({
  nanoid: jest.fn().mockReturnValue('abc123'),
}));

const mockS3Client = jest.fn();
const mockCreatePresignedPost = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(function (this: unknown, config: unknown) {
    mockS3Client(config);
    return { config };
  }),
}));

jest.mock('@aws-sdk/s3-presigned-post', () => ({
  createPresignedPost: jest.fn().mockImplementation((...args: unknown[]) => {
    return mockCreatePresignedPost(...args);
  }),
}));

jest.mock('@vercel/blob/client', () => ({
  generateClientTokenFromReadWriteToken: jest
    .fn()
    .mockResolvedValue('client-token'),
}));

jest.mock('./public-url', () => ({
  getPublicBaseUrl: jest.fn().mockReturnValue('http://localhost:3000'),
}));

function createFile(name: string, type: string, size: number): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe('helpers de storage', () => {
  test('guessMimeType detecta tipos por extensión', () => {
    expect(guessMimeType('video.mp4')).toBe('video/mp4');
    expect(guessMimeType('video.webm')).toBe('video/webm');
    expect(guessMimeType('video.ogv')).toBe('video/ogg');
    expect(guessMimeType('video.unknown')).toBe('video/mp4');
  });

  test('isValidLocalVideoKey valida claves seguras', () => {
    expect(isValidLocalVideoKey('video.mp4')).toBe(true);
    expect(isValidLocalVideoKey('mi-video_123.webm')).toBe(true);
    expect(isValidLocalVideoKey('')).toBe(false);
    expect(isValidLocalVideoKey('video')).toBe(false);
    expect(isValidLocalVideoKey('../etc/passwd.mp4')).toBe(false);
    expect(isValidLocalVideoKey('video.exe')).toBe(false);
  });

  test('resolveLocalVideoPath resuelve rutas dentro del directorio base', () => {
    const resolved = resolveLocalVideoPath('video.mp4', '/tmp/videos');
    expect(resolved).toMatch(/tmp[/\\]videos[/\\]video\.mp4$/);
  });

  test('resolveLocalVideoPath rechaza claves inválidas', () => {
    expect(() => resolveLocalVideoPath('../escape.mp4', '/tmp/videos')).toThrow(
      'Identificador de video inválido.'
    );
  });
});

describe('LocalStorageProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.LOCAL_STORAGE_PATH = '/tmp/videos';
  });

  test('prepareUpload genera instrucciones locales', async () => {
    const provider = getStorageProvider('local');
    const file = createFile('video.mp4', 'video/mp4', 100);

    const instructions = await provider.prepareUpload(file, 10);

    expect(instructions.method).toBe('POST');
    expect(instructions.url).toBe('http://localhost:3000/api/videos/upload');
    expect(instructions.key).toBe('abc123.mp4');
    expect(instructions.publicUrl).toContain('/api/videos/abc123.mp4/stream');
  });

  test('getPublicUrl construye URL local', () => {
    const provider = getStorageProvider('local');
    expect(provider.getPublicUrl('abc123.mp4')).toContain(
      '/api/videos/abc123.mp4/stream'
    );
    expect(provider.getPublicUrl('https://example.com/video.mp4')).toBe(
      'https://example.com/video.mp4'
    );
  });

  test('saveFile escribe el archivo en disco', async () => {
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);

    const provider = getStorageProvider('local');
    const file = createFile('video.mp4', 'video/mp4', 100);

    const url = await provider.saveFile!('abc123.mp4', file);

    expect(mockMkdir).toHaveBeenCalled();
    expect(mockWriteFile).toHaveBeenCalled();
    expect(url).toContain('abc123.mp4');
  });

  test('readFile devuelve el buffer y el MIME', async () => {
    mockReadFile.mockResolvedValue(Buffer.from('video'));

    const provider = getStorageProvider('local');
    const result = await provider.readFile!('abc123.mp4');

    expect(result).toEqual({
      buffer: expect.any(Buffer),
      mimeType: 'video/mp4',
    });
  });
});

describe('VercelBlobStorageProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
  });

  test('prepareUpload genera token de cliente', async () => {
    const provider = getStorageProvider('vercel-blob');
    const file = createFile('video.mp4', 'video/mp4', 100);

    const instructions = await provider.prepareUpload(file, 10);

    expect(instructions.method).toBe('POST');
    expect(instructions.url).toBe('https://blob.vercel-storage.com');
    expect(instructions.token).toBe('client-token');
  });

  test('falla si falta el token', async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const provider = getStorageProvider('vercel-blob');
    const file = createFile('video.mp4', 'video/mp4', 100);

    await expect(provider.prepareUpload(file, 10)).rejects.toThrow(
      'Falta BLOB_READ_WRITE_TOKEN'
    );
  });

  test('getPublicUrl devuelve URL de Vercel Blob', () => {
    const provider = getStorageProvider('vercel-blob');
    expect(provider.getPublicUrl('videos/abc123.mp4')).toBe(
      'https://blob.vercel-storage.com/videos/abc123.mp4'
    );
  });
});

describe('S3R2StorageProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.S3_ACCESS_KEY_ID = 's3-key';
    process.env.S3_SECRET_ACCESS_KEY = 's3-secret';
    process.env.S3_BUCKET = 's3-bucket';
    process.env.S3_REGION = 'us-east-1';
    mockCreatePresignedPost.mockResolvedValue({
      url: 'https://s3.amazonaws.com/s3-bucket',
      fields: { key: 'videos/abc123.mp4' },
    });
  });

  test('prepareUpload genera un presigned POST para S3', async () => {
    const provider = getStorageProvider('s3');
    const file = createFile('video.mp4', 'video/mp4', 100);

    const instructions = await provider.prepareUpload(file, 10);

    expect(mockS3Client).toHaveBeenCalledWith(
      expect.objectContaining({
        region: 'us-east-1',
        credentials: {
          accessKeyId: 's3-key',
          secretAccessKey: 's3-secret',
        },
      })
    );
    expect(instructions.method).toBe('POST');
    expect(instructions.url).toBe('https://s3.amazonaws.com/s3-bucket');
  });

  test('prepareUpload genera un presigned POST para R2', async () => {
    delete process.env.S3_ACCESS_KEY_ID;
    delete process.env.S3_SECRET_ACCESS_KEY;
    delete process.env.S3_BUCKET;
    delete process.env.S3_REGION;

    process.env.R2_ACCESS_KEY_ID = 'r2-key';
    process.env.R2_SECRET_ACCESS_KEY = 'r2-secret';
    process.env.R2_BUCKET_NAME = 'r2-bucket';
    process.env.R2_REGION = 'auto';
    process.env.R2_ACCOUNT_ID = 'account-id';

    const provider = getStorageProvider('r2');
    const file = createFile('video.mp4', 'video/mp4', 100);

    const instructions = await provider.prepareUpload(file, 10);

    expect(mockS3Client).toHaveBeenCalledWith(
      expect.objectContaining({
        region: 'auto',
        endpoint: 'https://account-id.r2.cloudflarestorage.com',
        credentials: {
          accessKeyId: 'r2-key',
          secretAccessKey: 'r2-secret',
        },
      })
    );
    expect(instructions.method).toBe('POST');
  });

  test('falla si faltan credenciales', async () => {
    delete process.env.S3_ACCESS_KEY_ID;
    delete process.env.S3_SECRET_ACCESS_KEY;
    delete process.env.S3_BUCKET;
    delete process.env.S3_REGION;
    delete process.env.S3_ENDPOINT;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET_NAME;
    delete process.env.R2_REGION;
    delete process.env.R2_ACCOUNT_ID;

    const provider = getStorageProvider('s3');
    const file = createFile('video.mp4', 'video/mp4', 100);

    await expect(provider.prepareUpload(file, 10)).rejects.toThrow(
      'Faltan credenciales de S3/R2'
    );
  });
});

describe('getStorageProvider', () => {
  test('reutiliza la misma instancia de local', () => {
    const a = getStorageProvider('local');
    const b = getStorageProvider('local');
    expect(a).toBe(b);
  });

  test('lanza error para proveedores no soportados', () => {
    // @ts-expect-error forzar valor inválido
    expect(() => getStorageProvider('invalid')).toThrow(
      'Proveedor de almacenamiento no soportado'
    );
  });
});
