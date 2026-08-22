/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from './route';
import * as chatService from '@/application/services/chatService';

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
    `http://localhost:3000/api/public/pedido/${ORDER_ID}/estado${path}`,
    init
  );
}

describe('GET /api/public/pedido/[id]/estado', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve el estado y la expiración del pedido', async () => {
    mockedChatService.getOrderChatStatus.mockResolvedValue({
      status: 'pending',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      isExpired: false,
    });

    const response = await GET(
      buildRequest(`?token=${TOKEN}`),
      { params: Promise.resolve({ id: String(ORDER_ID) }) }
    );
    const body = (await response.json()) as {
      status: string;
      expiresAt: string;
      isExpired: boolean;
    };

    expect(response.status).toBe(200);
    expect(body.status).toBe('pending');
    expect(body.expiresAt).toBeDefined();
    expect(body.isExpired).toBe(false);
    expect(mockedChatService.getOrderChatStatus).toHaveBeenCalledWith(
      ORDER_ID,
      TOKEN
    );
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
