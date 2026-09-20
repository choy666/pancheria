/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from './route';
import * as chatService from '@/application/services/chatService';
import { isChatPollRateLimited } from '@/lib/chat-poll-rate-limit';
import type { ChatStreamState } from '@/application/services/chatService';
import type { OrderMessage } from '@/domain/types';

jest.mock('@/application/services/chatService');
jest.mock('@/lib/chat-poll-rate-limit', () => ({
  isChatPollRateLimited: jest.fn(),
}));
jest.mock('@/lib/rate-limit', () => ({
  getClientIp: jest.fn().mockReturnValue('127.0.0.1'),
}));
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  logError: jest.fn(),
}));

const mockedChatService = chatService as jest.Mocked<typeof chatService>;
const mockedIsChatPollRateLimited =
  isChatPollRateLimited as jest.MockedFunction<typeof isChatPollRateLimited>;

const ORDER_ID = 10;
const TOKEN = 'valid-token';

function buildState(): ChatStreamState {
  return {
    status: 'pending',
    deliveryType: 'delivery',
    branchLocation: 'https://maps.example.com/sucursal',
    isExpired: false,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  };
}

function buildRequest(path = ''): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/public/pedido/${ORDER_ID}/chat/stream?token=${TOKEN}${path}`
  );
}

async function readAll(response: Response): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let output = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    output += decoder.decode(value);
  }
  return output;
}

describe('GET /api/public/pedido/[id]/chat/stream', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedIsChatPollRateLimited.mockResolvedValue(false);
    mockedChatService.pollChatStreamTick.mockResolvedValue({
      messages: [],
      status: 'pending',
      isExpired: false,
    });
  });

  test('devuelve un stream SSE con estado inicial y mensajes nuevos', async () => {
    mockedChatService.getChatStreamState.mockResolvedValue(buildState());
    mockedChatService.pollChatStreamTick.mockResolvedValueOnce({
      messages: [{ id: 4, content: 'Ya casi' } as OrderMessage],
      status: 'pending',
      isExpired: false,
    });

    const response = await GET(buildRequest('&budget=600'), {
      params: Promise.resolve({ id: String(ORDER_ID) }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/event-stream');

    const body = await readAll(response);
    expect(body).toContain('event: state');
    expect(body).toContain('"branchLocation":"https://maps.example.com/sucursal"');
    expect(body).toContain('id: 4\nevent: messages');
    expect(mockedChatService.getChatStreamState).toHaveBeenCalledWith(ORDER_ID, {
      token: TOKEN,
    });
  });

  test('exige el token del pedido', async () => {
    const response = await GET(
      new NextRequest(
        `http://localhost:3000/api/public/pedido/${ORDER_ID}/chat/stream`
      ),
      { params: Promise.resolve({ id: String(ORDER_ID) }) }
    );

    expect(response.status).toBe(400);
    expect(mockedChatService.getChatStreamState).not.toHaveBeenCalled();
  });

  test('devuelve 429 cuando el limiter de polls rechaza la conexión', async () => {
    mockedIsChatPollRateLimited.mockResolvedValue(true);

    const response = await GET(buildRequest(), {
      params: Promise.resolve({ id: String(ORDER_ID) }),
    });

    expect(response.status).toBe(429);
    expect(mockedChatService.getChatStreamState).not.toHaveBeenCalled();
  });

  test('devuelve 404 con un token que no corresponde al pedido', async () => {
    mockedChatService.getChatStreamState.mockResolvedValue(null);

    const response = await GET(buildRequest(), {
      params: Promise.resolve({ id: String(ORDER_ID) }),
    });

    expect(response.status).toBe(404);
  });
});
