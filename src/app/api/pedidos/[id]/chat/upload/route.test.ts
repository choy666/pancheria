/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from './route';
import * as chatService from '@/application/services/chatService';
import * as chatStorage from '@/lib/chat-storage';
import { requireAuth, getCurrentBranchId } from '@/lib/auth';

jest.mock('@/application/services/chatService');
jest.mock('@/lib/chat-storage');
jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
  getCurrentBranchId: jest.fn(),
}));
jest.mock('@/lib/logger', () => ({
  logError: jest.fn(),
}));

const mockedChatService = chatService as jest.Mocked<typeof chatService>;
const mockedChatStorage = chatStorage as jest.Mocked<typeof chatStorage>;
const mockedRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;
const mockedGetCurrentBranchId =
  getCurrentBranchId as jest.MockedFunction<typeof getCurrentBranchId>;

const BRANCH_ID = 1;
const ORDER_ID = 10;

function buildRequest(body: FormData): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/pedidos/${ORDER_ID}/chat/upload`,
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

describe('POST /api/pedidos/[id]/chat/upload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const session = {
      user: { name: 'Juan', role: 'operator', branchId: BRANCH_ID },
    } as any;
    mockedRequireAuth.mockResolvedValue(session);
    mockedGetCurrentBranchId.mockResolvedValue(BRANCH_ID);
    mockedChatStorage.saveChatAttachment.mockResolvedValue({
      key: 'chat/10/abc123.jpg',
      publicUrl: 'http://localhost:3000/api/chat/attachment/chat%2F10%2Fabc123.jpg',
      mimeType: 'image/jpeg',
      size: 100,
      name: 'foto.jpg',
    });
    mockedChatService.sendOperatorMessage.mockResolvedValue({
      id: 1,
      content: 'Confirmado',
      attachmentUrl: 'http://localhost:3000/api/chat/attachment/chat%2F10%2Fabc123.jpg',
      senderName: 'Juan',
    } as any);
  });

  test('sube un adjunto y crea un mensaje del operador', async () => {
    const file = new File(['imagen'], 'foto.jpg', { type: 'image/jpeg' });
    const formData = createFormData(file, 'Confirmado');

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
    expect(mockedChatService.sendOperatorMessage).toHaveBeenCalledWith(
      ORDER_ID,
      BRANCH_ID,
      {
        content: 'Confirmado',
        attachment: {
          url: 'http://localhost:3000/api/chat/attachment/chat%2F10%2Fabc123.jpg',
          mimeType: 'image/jpeg',
          size: 100,
          name: 'foto.jpg',
        },
        senderName: 'Juan',
      }
    );
    expect(body.message).toEqual(
      expect.objectContaining({ content: 'Confirmado' })
    );
  });

  test('rechaza un ID inválido', async () => {
    const file = new File(['imagen'], 'foto.jpg', { type: 'image/jpeg' });
    const request = new NextRequest(
      'http://localhost:3000/api/pedidos/abc/chat/upload',
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
    expect(mockedChatService.sendOperatorMessage).not.toHaveBeenCalled();
  });
});
