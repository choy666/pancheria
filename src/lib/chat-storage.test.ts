/**
 * @jest-environment node
 */
import { saveChatAttachment, readChatAttachment } from './chat-storage';
import { ValidationError } from '@/domain/errors';
import { getStorageProvider } from '@/config/videos';

const mockMkdir = jest.fn();
const mockWriteFile = jest.fn();
const mockReadFile = jest.fn();

jest.mock('fs', () => ({
  promises: {
    mkdir: (...args: unknown[]) => mockMkdir(...args),
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
    readFile: (...args: unknown[]) => mockReadFile(...args),
  },
}));

jest.mock('nanoid', () => ({
  nanoid: jest.fn().mockReturnValue('abc123'),
}));

jest.mock('@/config/videos', () => ({
  getStorageProvider: jest.fn().mockReturnValue('local'),
}));

jest.mock('@vercel/blob', () => ({
  put: jest.fn().mockResolvedValue({
    url: 'https://blob.vercel-storage.com/chat/10/abc123.jpg',
  }),
}));

const mockedGetStorageProvider = getStorageProvider as jest.MockedFunction<
  typeof getStorageProvider
>;

function createFile(name: string, type: string, size: number): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe('chat-storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetStorageProvider.mockReturnValue('local');
    process.env.LOCAL_STORAGE_PATH = '/tmp/videos';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  });

  describe('saveChatAttachment', () => {
    test('guarda un adjunto local con extensión según el MIME', async () => {
      const file = createFile('foto.jpg', 'image/jpeg', 100);

      const result = await saveChatAttachment(file, 10);

      expect(mockMkdir).toHaveBeenCalledWith(
        expect.stringMatching(/tmp[/\\]videos[/\\]chat[/\\]10/),
        { recursive: true }
      );
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringMatching(/tmp[/\\]videos[/\\]chat[/\\]10[/\\]abc123\.jpg/),
        expect.any(Buffer)
      );
      expect(result).toMatchObject({
        key: 'chat/10/abc123.jpg',
        publicUrl:
          'http://localhost:3000/api/chat/attachment/chat%2F10%2Fabc123.jpg',
        mimeType: 'image/jpeg',
        size: 100,
        name: 'foto.jpg',
      });
    });

    test('usa CHAT_LOCAL_STORAGE_PATH cuando está definida', async () => {
      process.env.CHAT_LOCAL_STORAGE_PATH = '/tmp/chat-only';
      const file = createFile('foto.jpg', 'image/jpeg', 100);

      const result = await saveChatAttachment(file, 10);

      expect(mockMkdir).toHaveBeenCalledWith(
        expect.stringMatching(/tmp[/\\]chat-only[/\\]chat[/\\]10/),
        { recursive: true }
      );
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringMatching(/tmp[/\\]chat-only[/\\]chat[/\\]10[/\\]abc123\.jpg/),
        expect.any(Buffer)
      );
      expect(result).toMatchObject({
        key: 'chat/10/abc123.jpg',
        publicUrl:
          'http://localhost:3000/api/chat/attachment/chat%2F10%2Fabc123.jpg',
        mimeType: 'image/jpeg',
        size: 100,
        name: 'foto.jpg',
      });

      delete process.env.CHAT_LOCAL_STORAGE_PATH;
    });

    test('rechaza un tipo de imagen no permitido', async () => {
      const file = createFile('foto.gif', 'image/gif', 100);

      await expect(saveChatAttachment(file, 10)).rejects.toThrow(
        ValidationError
      );
    });

    test('rechaza una imagen que excede el tamaño máximo', async () => {
      const file = createFile('foto.jpg', 'image/jpeg', 100 * 1024 * 1024);

      await expect(saveChatAttachment(file, 10)).rejects.toThrow(
        ValidationError
      );
    });

    test('sube a Vercel Blob cuando el proveedor es vercel-blob', async () => {
      const { put } = await import('@vercel/blob');
      mockedGetStorageProvider.mockReturnValue('vercel-blob');
      process.env.BLOB_READ_WRITE_TOKEN = 'test-token';

      const file = createFile('foto.png', 'image/png', 100);
      const result = await saveChatAttachment(file, 10);

      expect(put).toHaveBeenCalledWith(
        'chat/10/abc123.png',
        file,
        expect.objectContaining({
          token: 'test-token',
          contentType: 'image/png',
          access: 'public',
        })
      );
      expect(result.publicUrl).toBe(
        'https://blob.vercel-storage.com/chat/10/abc123.jpg'
      );
    });

    test('falla si falta BLOB_READ_WRITE_TOKEN para Vercel Blob', async () => {
      mockedGetStorageProvider.mockReturnValue('vercel-blob');
      delete process.env.BLOB_READ_WRITE_TOKEN;

      const file = createFile('foto.jpg', 'image/jpeg', 100);

      await expect(saveChatAttachment(file, 10)).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('readChatAttachment', () => {
    test('lee un adjunto local y detecta el MIME por extensión', async () => {
      mockReadFile.mockResolvedValue(Buffer.from('imagen'));

      const result = await readChatAttachment('chat/10/abc123.webp');

      expect(mockReadFile).toHaveBeenCalledWith(
        expect.stringMatching(/tmp[/\\]videos[/\\]chat[/\\]10[/\\]abc123\.webp/)
      );
      expect(result).toEqual({
        buffer: expect.any(Buffer),
        mimeType: 'image/webp',
      });
    });

    test('devuelve null si el proveedor no es local', async () => {
      mockedGetStorageProvider.mockReturnValue('vercel-blob');

      const result = await readChatAttachment('chat/10/abc123.jpg');

      expect(result).toBeNull();
      expect(mockReadFile).not.toHaveBeenCalled();
    });

    test('devuelve null si el archivo no existe', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT'));

      const result = await readChatAttachment('chat/10/missing.jpg');

      expect(result).toBeNull();
    });
  });
});
