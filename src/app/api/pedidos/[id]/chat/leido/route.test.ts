/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from './route';
import * as chatService from '@/application/services/chatService';
import { requireAuth, getCurrentBranchId } from '@/lib/auth';

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

function buildRequest(): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/pedidos/${ORDER_ID}/chat/leido`,
    { method: 'POST' }
  );
}

describe('POST /api/pedidos/[id]/chat/leido', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const session = { user: { name: 'Juan', role: 'operator', branchId: BRANCH_ID } } as any;
    mockedRequireAuth.mockResolvedValue(session);
    mockedGetCurrentBranchId.mockResolvedValue(BRANCH_ID);
  });

  test('marca mensajes del cliente como leídos', async () => {
    mockedChatService.markOperatorMessagesAsRead.mockResolvedValue(3);

    const response = await POST(
      buildRequest(),
      { params: Promise.resolve({ id: String(ORDER_ID) }) }
    );
    const body = (await response.json()) as { ok: boolean };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockedChatService.markOperatorMessagesAsRead).toHaveBeenCalledWith(ORDER_ID, BRANCH_ID);
  });

  test('rechaza ID inválido', async () => {
    const response = await POST(
      buildRequest(),
      { params: Promise.resolve({ id: 'abc' }) }
    );

    expect(response.status).toBe(400);
  });
});
