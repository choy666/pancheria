/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from './route';
import * as chatStorage from '@/lib/chat-storage';
import * as videoConfig from '@/config/videos';

jest.mock('@/lib/chat-storage');
jest.mock('@/config/videos', () => ({
  getStorageProvider: jest.fn().mockReturnValue('local'),
}));
jest.mock('@/lib/logger', () => ({
  logError: jest.fn(),
}));

const mockedChatStorage = chatStorage as jest.Mocked<typeof chatStorage>;
const mockedGetStorageProvider =
  videoConfig.getStorageProvider as jest.MockedFunction<
    typeof videoConfig.getStorageProvider
  >;

const KEY = 'chat/10/abc123.jpg';

function buildRequest(key: string): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/chat/attachment/${encodeURIComponent(key)}`
  );
}

describe('GET /api/chat/attachment/[key]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetStorageProvider.mockReturnValue('local');
  });

  test('sirve un adjunto local con el Content-Type correcto', async () => {
    mockedChatStorage.readChatAttachment.mockResolvedValue({
      buffer: Buffer.from('imagen'),
      mimeType: 'image/jpeg',
    });

    const response = await GET(
      buildRequest(KEY),
      { params: Promise.resolve({ key: encodeURIComponent(KEY) }) }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/jpeg');
    expect(mockedChatStorage.readChatAttachment).toHaveBeenCalledWith(KEY);
  });

  test('devuelve 404 si el adjunto no existe localmente', async () => {
    mockedChatStorage.readChatAttachment.mockResolvedValue(null);

    const response = await GET(
      buildRequest(KEY),
      { params: Promise.resolve({ key: encodeURIComponent(KEY) }) }
    );

    expect(response.status).toBe(404);
  });

  test('devuelve 404 para proveedores remotos', async () => {
    mockedGetStorageProvider.mockReturnValue('vercel-blob');

    const response = await GET(
      buildRequest(KEY),
      { params: Promise.resolve({ key: encodeURIComponent(KEY) }) }
    );

    expect(response.status).toBe(404);
    expect(mockedChatStorage.readChatAttachment).not.toHaveBeenCalled();
  });
});
