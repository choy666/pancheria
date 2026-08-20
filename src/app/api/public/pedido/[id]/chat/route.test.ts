/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET, POST } from './route';
import * as chatService from '@/application/services/chatService';
import * as rateLimit from '@/lib/rate-limit';
import { ValidationError } from '@/domain/errors';

jest.mock('@/application/services/chatService');
jest.mock('@/lib/rate-limit', () => ({
  getClientIp: jest.fn().mockReturnValue('127.0.0.1'),
  createRateLimiter: jest.fn().mockReturnValue(jest.fn().mockResolvedValue(false)),
}));
jest.mock('@/lib/logger', () => ({
  logError: jest.fn(),
}));

const mockedChatService = chatService as jest.Mocked<typeof chatService>;

const ORDER_ID = 10;
const TOKEN = 'valid-token';

function buildRequest(
  path: string,
  init?: ConstructorParameters<typeof NextRequest>[1]
): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/public/pedido/${ORDER_ID}/chat${path}`,
    init
  );
}

describe('GET /api/public/pedido/[id]/chat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve los mensajes del pedido', async () => {
    mockedChatService.listClientMessages.mockResolvedValue([
      { id: 1, content: 'Hola' },
    ] as any);

    const response = await GET(
      buildRequest(`?token=${TOKEN}`),
      { params: Promise.resolve({ id: String(ORDER_ID) }) }
    );
    const body = (await response.json()) as { messages: unknown[] };

    expect(response.status).toBe(200);
    expect(body.messages).toHaveLength(1);
    expect(mockedChatService.listClientMessages).toHaveBeenCalledWith(ORDER_ID, TOKEN);
  });

  test('rechaza un ID inválido', async () => {
    const response = await GET(
      buildRequest(`?token=${TOKEN}`),
      { params: Promise.resolve({ id: 'abc' }) }
    );

    expect(response.status).toBe(400);
  });

  test('rechaza token faltante', async () => {
    const response = await GET(
      buildRequest(''),
      { params: Promise.resolve({ id: String(ORDER_ID) }) }
    );

    expect(response.status).toBe(400);
  });
});

describe('POST /api/public/pedido/[id]/chat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedChatService.sendClientMessage.mockImplementation(async (_orderId, _token, input) => {
      const trimmed = typeof input.content === 'string' ? input.content.trim() : '';
      if (!trimmed) {
        throw new ValidationError('El mensaje no puede estar vacío.');
      }
      return { id: 1, content: trimmed } as any;
    });
  });

  test('envía un mensaje del cliente', async () => {

    const response = await POST(
      buildRequest(`?token=${TOKEN}`, {
        method: 'POST',
        body: JSON.stringify({ content: 'Hola' }),
      }),
      { params: Promise.resolve({ id: String(ORDER_ID) }) }
    );
    const body = (await response.json()) as { message: unknown };

    expect(response.status).toBe(201);
    expect(body.message).toEqual(expect.objectContaining({ content: 'Hola' }));
    expect(mockedChatService.sendClientMessage).toHaveBeenCalledWith(
      ORDER_ID,
      TOKEN,
      { content: 'Hola' }
    );
  });

  test('rechaza contenido vacío', async () => {
    const response = await POST(
      buildRequest(`?token=${TOKEN}`, {
        method: 'POST',
        body: JSON.stringify({ content: '   ' }),
      }),
      { params: Promise.resolve({ id: String(ORDER_ID) }) }
    );

    expect(response.status).toBe(400);
  });
});
