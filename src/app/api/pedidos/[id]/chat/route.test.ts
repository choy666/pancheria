/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET, POST } from './route';
import * as chatService from '@/application/services/chatService';
import { requireAuth, getCurrentBranchId } from '@/lib/auth';
import { ValidationError } from '@/domain/errors';

jest.mock('@/application/services/chatService');
jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
  getCurrentBranchId: jest.fn(),
}));
jest.mock('@/lib/logger', () => ({
  logError: jest.fn(),
}));

const mockedChatService = chatService as jest.Mocked<typeof chatService>;
const mockedRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;
const mockedGetCurrentBranchId =
  getCurrentBranchId as jest.MockedFunction<typeof getCurrentBranchId>;

const BRANCH_ID = 1;
const ORDER_ID = 10;

function buildRequest(
  init?: ConstructorParameters<typeof NextRequest>[1]
): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/pedidos/${ORDER_ID}/chat`,
    init
  );
}

describe('GET /api/pedidos/[id]/chat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const session = { user: { name: 'Juan', role: 'operator', branchId: BRANCH_ID } } as any;
    mockedRequireAuth.mockResolvedValue(session);
    mockedGetCurrentBranchId.mockResolvedValue(BRANCH_ID);
  });

  test('devuelve los mensajes y el estado del pedido', async () => {
    mockedChatService.listOperatorMessages.mockResolvedValue({
      messages: [{ id: 1, content: 'Hola' }] as any,
      status: 'pending',
      total: 1,
      hasMore: false,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      isExpired: false,
    });

    const response = await GET(
      buildRequest(),
      { params: Promise.resolve({ id: String(ORDER_ID) }) }
    );
    const body = (await response.json()) as {
      messages: unknown[];
      status: string;
      total: number;
      hasMore: boolean;
    };

    expect(response.status).toBe(200);
    expect(body.messages).toHaveLength(1);
    expect(body.status).toBe('pending');
    expect(body.total).toBe(1);
    expect(body.hasMore).toBe(false);
    expect(mockedChatService.listOperatorMessages).toHaveBeenCalledWith(
      ORDER_ID,
      BRANCH_ID,
      expect.any(Object)
    );
  });

  test('rechaza un ID inválido', async () => {
    const response = await GET(
      buildRequest(),
      { params: Promise.resolve({ id: 'abc' }) }
    );

    expect(response.status).toBe(400);
  });
});

describe('POST /api/pedidos/[id]/chat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const session = { user: { name: 'Juan', role: 'operator', branchId: BRANCH_ID } } as any;
    mockedRequireAuth.mockResolvedValue(session);
    mockedGetCurrentBranchId.mockResolvedValue(BRANCH_ID);
    mockedChatService.sendOperatorMessage.mockImplementation(async (_orderId, _branchId, input) => {
      const trimmed = typeof input.content === 'string' ? input.content.trim() : '';
      if (!trimmed) {
        throw new ValidationError('El mensaje no puede estar vacío.');
      }
      return { id: 1, content: trimmed, senderName: input.senderName } as any;
    });
  });

  test('envía un mensaje del operador', async () => {

    const response = await POST(
      buildRequest({
        method: 'POST',
        body: JSON.stringify({ content: 'Confirmado' }),
      }),
      { params: Promise.resolve({ id: String(ORDER_ID) }) }
    );
    const body = (await response.json()) as { message: unknown };

    expect(response.status).toBe(201);
    expect(body.message).toEqual(expect.objectContaining({ content: 'Confirmado' }));
    expect(mockedChatService.sendOperatorMessage).toHaveBeenCalledWith(
      ORDER_ID,
      BRANCH_ID,
      { content: 'Confirmado', senderName: 'Juan' }
    );
  });

  test('rechaza contenido vacío', async () => {
    const response = await POST(
      buildRequest({
        method: 'POST',
        body: JSON.stringify({ content: '   ' }),
      }),
      { params: Promise.resolve({ id: String(ORDER_ID) }) }
    );

    expect(response.status).toBe(400);
  });

  test('acepta contenido por query param cuando el body está vacío (fallback)', async () => {
    const response = await POST(
      new NextRequest(
        `http://localhost:3000/api/pedidos/${ORDER_ID}/chat?content=${encodeURIComponent('Confirmado')}`,
        { method: 'POST', body: '' }
      ),
      { params: Promise.resolve({ id: String(ORDER_ID) }) }
    );
    const body = (await response.json()) as { message: unknown };

    expect(response.status).toBe(201);
    expect(body.message).toEqual(expect.objectContaining({ content: 'Confirmado' }));
    expect(mockedChatService.sendOperatorMessage).toHaveBeenCalledWith(
      ORDER_ID,
      BRANCH_ID,
      { content: 'Confirmado', senderName: 'Juan' }
    );
  });

  test('rechaza POST sin body ni query param', async () => {
    const response = await POST(
      buildRequest({
        method: 'POST',
      }),
      { params: Promise.resolve({ id: String(ORDER_ID) }) }
    );

    expect(response.status).toBe(400);
  });

  test('rechaza contenido que supera el límite de caracteres', async () => {
    const original = process.env.NEXT_PUBLIC_CHAT_MAX_TEXT_LENGTH;
    process.env.NEXT_PUBLIC_CHAT_MAX_TEXT_LENGTH = '5';

    try {
      const response = await POST(
        buildRequest({
          method: 'POST',
          body: JSON.stringify({ content: '123456' }),
        }),
        { params: Promise.resolve({ id: String(ORDER_ID) }) }
      );

      expect(response.status).toBe(400);
      expect(mockedChatService.sendOperatorMessage).not.toHaveBeenCalled();
    } finally {
      process.env.NEXT_PUBLIC_CHAT_MAX_TEXT_LENGTH = original;
    }
  });
});
