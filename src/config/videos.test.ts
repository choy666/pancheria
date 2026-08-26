import {
  getVideoMaxSizeMb,
  getVideoAllowedMimeTypes,
  getCastReceiverAppId,
  getCastSenderSdkUrl,
  getStorageProvider,
  getVideoMaxSizeBytes,
} from './videos';

jest.mock('@/lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

describe('videos config', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('getVideoMaxSizeMb', () => {
    test('usa el valor por defecto', () => {
      delete process.env.NEXT_PUBLIC_VIDEO_MAX_SIZE_MB;
      expect(getVideoMaxSizeMb()).toBe(100);
    });

    test('respeta el valor configurado', () => {
      process.env.NEXT_PUBLIC_VIDEO_MAX_SIZE_MB = '200';
      expect(getVideoMaxSizeMb()).toBe(200);
    });

    test('ignora valores inválidos', () => {
      process.env.NEXT_PUBLIC_VIDEO_MAX_SIZE_MB = 'abc';
      expect(getVideoMaxSizeMb()).toBe(100);
    });

    test('ignora valores negativos o cero', () => {
      process.env.NEXT_PUBLIC_VIDEO_MAX_SIZE_MB = '-5';
      expect(getVideoMaxSizeMb()).toBe(100);
    });
  });

  describe('getVideoAllowedMimeTypes', () => {
    test('usa los tipos por defecto', () => {
      delete process.env.NEXT_PUBLIC_VIDEO_ALLOWED_MIME_TYPES;
      expect(getVideoAllowedMimeTypes()).toEqual([
        'video/mp4',
        'video/webm',
        'video/ogg',
      ]);
    });

    test('respeta la lista configurada', () => {
      process.env.NEXT_PUBLIC_VIDEO_ALLOWED_MIME_TYPES =
        'video/mp4, video/avi ,video/mkv';
      expect(getVideoAllowedMimeTypes()).toEqual([
        'video/mp4',
        'video/avi',
        'video/mkv',
      ]);
    });
  });

  describe('getCastReceiverAppId', () => {
    test('usa el ID por defecto', () => {
      delete process.env.NEXT_PUBLIC_CAST_RECEIVER_APP_ID;
      expect(getCastReceiverAppId()).toBe('CC1AD845');
    });

    test('respeta el ID configurado', () => {
      process.env.NEXT_PUBLIC_CAST_RECEIVER_APP_ID = 'CUSTOM123';
      expect(getCastReceiverAppId()).toBe('CUSTOM123');
    });
  });

  describe('getCastSenderSdkUrl', () => {
    test('usa la URL por defecto', () => {
      delete process.env.NEXT_PUBLIC_CAST_SENDER_SDK_URL;
      expect(getCastSenderSdkUrl()).toBe(
        'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1'
      );
    });

    test('respeta la URL configurada', () => {
      process.env.NEXT_PUBLIC_CAST_SENDER_SDK_URL =
        'https://custom.example.com/cast_sender.js';
      expect(getCastSenderSdkUrl()).toBe(
        'https://custom.example.com/cast_sender.js'
      );
    });
  });

  describe('getStorageProvider', () => {
    test('usa local por defecto', () => {
      delete process.env.STORAGE_PROVIDER;
      expect(getStorageProvider()).toBe('local');
    });

    test('respeta el proveedor configurado', () => {
      process.env.STORAGE_PROVIDER = 's3';
      expect(getStorageProvider()).toBe('s3');
    });

    test('cae a local si el proveedor es inválido', () => {
      process.env.STORAGE_PROVIDER = 'ftp';
      expect(getStorageProvider()).toBe('local');
    });
  });

  describe('getVideoMaxSizeBytes', () => {
    test('convierte MB a bytes', () => {
      process.env.NEXT_PUBLIC_VIDEO_MAX_SIZE_MB = '10';
      expect(getVideoMaxSizeBytes()).toBe(10 * 1024 * 1024);
    });
  });
});
