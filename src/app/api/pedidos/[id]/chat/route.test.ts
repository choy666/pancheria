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

  test('devuelve los mensajes del pedido', async () => {
    mockedChatService.listOperatorMessages.mockResolvedValue([
      { id: 1, content: 'Hola' },
    ] as any);

    const response = await GET(
      buildRequest(),
      { params: Promise.resolve({ id: String(ORDER_ID) }) }
    );
    const body = (await response.json()) as { messages: unknown[] };

    expect(response.status).toBe(200);
    expect(body.messages).toHaveLength(1);
    expect(mockedChatService.listOperatorMessages).toHaveBeenCalledWith(ORDER_ID, BRANCH_ID);
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
});
