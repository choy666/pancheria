/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from './route';
import * as chatService from '@/application/services/chatService';

jest.mock('@/application/services/chatService');
jest.mock('@/lib/logger', () => ({
  logError: jest.fn(),
}));

const mockedChatService = chatService as jest.Mocked<typeof chatService>;

const ORDER_ID = 10;
const TOKEN = 'valid-token';

function buildRequest(path: string): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/public/pedido/${ORDER_ID}/chat/leido${path}`,
    { method: 'POST' }
  );
}

describe('POST /api/public/pedido/[id]/chat/leido', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('marca mensajes del operador como leídos', async () => {
    mockedChatService.markClientMessagesAsRead.mockResolvedValue(2);

    const response = await POST(
      buildRequest(`?token=${TOKEN}`),
      { params: Promise.resolve({ id: String(ORDER_ID) }) }
    );
    const body = (await response.json()) as { ok: boolean };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockedChatService.markClientMessagesAsRead).toHaveBeenCalledWith(ORDER_ID, TOKEN);
  });

  test('rechaza ID inválido', async () => {
    const response = await POST(
      buildRequest(`?token=${TOKEN}`),
      { params: Promise.resolve({ id: 'abc' }) }
    );

    expect(response.status).toBe(400);
  });
});
