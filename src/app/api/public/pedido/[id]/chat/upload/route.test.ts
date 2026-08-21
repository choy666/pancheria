/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from './route';
import * as chatService from '@/application/services/chatService';
import * as chatStorage from '@/lib/chat-storage';
import * as rateLimit from '@/lib/rate-limit';

jest.mock('@/application/services/chatService');
jest.mock('@/lib/chat-storage');
jest.mock('@/lib/rate-limit', () => ({
  getClientIp: jest.fn().mockReturnValue('127.0.0.1'),
  createRateLimiter: jest.fn().mockReturnValue(jest.fn().mockResolvedValue(false)),
}));
jest.mock('@/lib/logger', () => ({
  logError: jest.fn(),
}));

const mockedChatService = chatService as jest.Mocked<typeof chatService>;
const mockedChatStorage = chatStorage as jest.Mocked<typeof chatStorage>;

const ORDER_ID = 10;
const TOKEN = 'valid-token';

function buildRequest(body: FormData): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/public/pedido/${ORDER_ID}/chat/upload?token=${TOKEN}`,
    {
      method: 'POST',
      body,
    }
  );
}

function createFormData(file?: File, content?: string): FormData {
  const formData = new FormData();
  if (file) {
    formData.append('file', file);
  }
  if (content !== undefined) {
    formData.append('content', content);
  }
  return formData;
}

describe('POST /api/public/pedido/[id]/chat/upload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedChatStorage.saveChatAttachment.mockResolvedValue({
      key: 'chat/10/abc123.jpg',
      publicUrl: 'http://localhost:3000/api/chat/attachment/chat%2F10%2Fabc123.jpg',
      mimeType: 'image/jpeg',
      size: 100,
      name: 'foto.jpg',
    });
    mockedChatService.sendClientMessage.mockResolvedValue({
      id: 1,
      content: 'Hola',
      attachmentUrl: 'http://localhost:3000/api/chat/attachment/chat%2F10%2Fabc123.jpg',
    } as any);
  });

  test('sube un adjunto y crea un mensaje', async () => {
    const file = new File(['imagen'], 'foto.jpg', { type: 'image/jpeg' });
    const formData = createFormData(file, 'Hola');

    const response = await POST(
      buildRequest(formData),
      { params: Promise.resolve({ id: String(ORDER_ID) }) }
    );
    const body = (await response.json()) as { message: unknown };

    expect(response.status).toBe(201);
    expect(mockedChatStorage.saveChatAttachment).toHaveBeenCalledWith(
      file,
      ORDER_ID
    );
    expect(mockedChatService.sendClientMessage).toHaveBeenCalledWith(
      ORDER_ID,
      TOKEN,
      {
        content: 'Hola',
        attachment: {
          url: 'http://localhost:3000/api/chat/attachment/chat%2F10%2Fabc123.jpg',
          key: 'chat/10/abc123.jpg',
          mimeType: 'image/jpeg',
          size: 100,
          name: 'foto.jpg',
        },
      }
    );
    expect(body.message).toEqual(expect.objectContaining({ content: 'Hola' }));
  });

  test('rechaza un ID inválido', async () => {
    const file = new File(['imagen'], 'foto.jpg', { type: 'image/jpeg' });
    const request = new NextRequest(
      `http://localhost:3000/api/public/pedido/abc/chat/upload?token=${TOKEN}`,
      { method: 'POST', body: createFormData(file) }
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: 'abc' }),
    });

    expect(response.status).toBe(400);
  });

  test('rechaza cuando falta el archivo', async () => {
    const response = await POST(
      buildRequest(createFormData(undefined, 'Solo texto')),
      { params: Promise.resolve({ id: String(ORDER_ID) }) }
    );

    expect(response.status).toBe(400);
    expect(mockedChatService.sendClientMessage).not.toHaveBeenCalled();
  });
});
