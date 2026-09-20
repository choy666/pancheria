/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from './route';
import * as chatService from '@/application/services/chatService';
import { requireAuth, getCurrentBranchId } from '@/lib/auth';
import type { ChatStreamState } from '@/application/services/chatService';
import type { OrderMessage } from '@/domain/types';

jest.mock('@/application/services/chatService');
jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
  getCurrentBranchId: jest.fn(),
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
const mockedRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;
const mockedGetCurrentBranchId =
  getCurrentBranchId as jest.MockedFunction<typeof getCurrentBranchId>;

const BRANCH_ID = 1;
const ORDER_ID = 10;

function buildState(): ChatStreamState {
  return {
    status: 'pending',
    deliveryType: 'pickup',
    branchLocation: null,
    isExpired: false,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  };
}

function buildRequest(
  path = '',
  init?: ConstructorParameters<typeof NextRequest>[1]
): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/pedidos/${ORDER_ID}/chat/stream${path}`,
    init
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

describe('GET /api/pedidos/[id]/chat/stream', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const session = {
      user: { name: 'Juan', role: 'operator', branchId: BRANCH_ID },
    } as any;
    mockedRequireAuth.mockResolvedValue(session);
    mockedGetCurrentBranchId.mockResolvedValue(BRANCH_ID);
    mockedChatService.pollChatStreamTick.mockResolvedValue({
      messages: [],
      status: 'pending',
      isExpired: false,
    });
  });

  test('devuelve un stream SSE con el estado inicial y nuevos mensajes', async () => {
    mockedChatService.getChatStreamState.mockResolvedValue(buildState());
    mockedChatService.pollChatStreamTick.mockResolvedValueOnce({
      messages: [{ id: 3, content: 'Hola' } as OrderMessage],
      status: 'pending',
      isExpired: false,
    });

    const response = await GET(buildRequest('?budget=600&interval=500'), {
      params: Promise.resolve({ id: String(ORDER_ID) }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/event-stream');

    const body = await readAll(response);
    expect(body).toContain('event: state');
    expect(body).toContain('id: 3\nevent: messages');
    expect(body).toContain('Hola');
  });

  test('usa `after` de la query como cursor inicial', async () => {
    mockedChatService.getChatStreamState.mockResolvedValue(buildState());

    const response = await GET(buildRequest('?after=42&budget=600'), {
      params: Promise.resolve({ id: String(ORDER_ID) }),
    });
    await readAll(response);

    expect(mockedChatService.pollChatStreamTick).toHaveBeenCalledWith(
      ORDER_ID,
      { branchId: BRANCH_ID },
      'client',
      42
    );
  });

  test('usa `Last-Event-ID` como cursor cuando no hay `after`', async () => {
    mockedChatService.getChatStreamState.mockResolvedValue(buildState());

    const response = await GET(
      buildRequest('?budget=600', {
        headers: { 'last-event-id': '17' },
      }),
      { params: Promise.resolve({ id: String(ORDER_ID) }) }
    );
    await readAll(response);

    expect(mockedChatService.pollChatStreamTick).toHaveBeenCalledWith(
      ORDER_ID,
      { branchId: BRANCH_ID },
      'client',
      17
    );
  });

  test('rechaza un ID inválido', async () => {
    const response = await GET(buildRequest(), {
      params: Promise.resolve({ id: 'abc' }),
    });

    expect(response.status).toBe(400);
    expect(mockedChatService.getChatStreamState).not.toHaveBeenCalled();
  });

  test('devuelve 404 si el pedido no existe en la sucursal', async () => {
    mockedChatService.getChatStreamState.mockResolvedValue(null);

    const response = await GET(buildRequest(), {
      params: Promise.resolve({ id: String(ORDER_ID) }),
    });

    expect(response.status).toBe(404);
  });
});
