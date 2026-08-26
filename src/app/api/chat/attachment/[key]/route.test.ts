/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from './route';
import * as chatStorage from '@/lib/chat-storage';
import * as videoConfig from '@/config/videos';
import { auth } from '@/auth';
import * as orderRepository from '@/repositories/orderRepository';

jest.mock('@/lib/chat-storage');
jest.mock('@/config/videos', () => ({
  getStorageProvider: jest.fn().mockReturnValue('local'),
}));
jest.mock('@/lib/logger', () => ({
  logError: jest.fn(),
}));
jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));
jest.mock('@/repositories/orderRepository', () => ({
  findByIdWithToken: jest.fn(),
  findById: jest.fn(),
}));

const mockedChatStorage = chatStorage as jest.Mocked<typeof chatStorage>;
const mockedGetStorageProvider =
  videoConfig.getStorageProvider as jest.MockedFunction<
    typeof videoConfig.getStorageProvider
  >;
const mockedAuth = auth as unknown as jest.Mock;
const mockedOrderRepository = orderRepository as jest.Mocked<
  typeof orderRepository
>;

const KEY = 'chat/10/abc123.jpg';
const TOKEN = 'valid-token';

function buildRequest(key: string, token?: string): NextRequest {
  const url = token
    ? `http://localhost:3000/api/chat/attachment/${encodeURIComponent(key)}?token=${encodeURIComponent(token)}`
    : `http://localhost:3000/api/chat/attachment/${encodeURIComponent(key)}`;
  return new NextRequest(url);
}

function buildAuthSession(role: 'admin' | 'operator' = 'operator', branchId = 1) {
  return {
    user: {
      id: '1',
      name: 'Usuario',
      role,
      branchId,
      branchName: 'Sucursal',
    },
  };
}

describe('GET /api/chat/attachment/[key]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetStorageProvider.mockReturnValue('local');
    mockedAuth.mockResolvedValue(null as any);
    mockedOrderRepository.findByIdWithToken.mockResolvedValue(undefined);
    mockedOrderRepository.findById.mockResolvedValue(undefined);
  });

  test('sirve un adjunto local con token de pedido válido', async () => {
    mockedOrderRepository.findByIdWithToken.mockResolvedValue({
      id: 10,
      cancellationToken: TOKEN,
    } as any);
    mockedChatStorage.readChatAttachment.mockResolvedValue({
      buffer: Buffer.from('imagen'),
      mimeType: 'image/jpeg',
    });

    const response = await GET(
      buildRequest(KEY, TOKEN),
      { params: Promise.resolve({ key: encodeURIComponent(KEY) }) }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/jpeg');
    expect(mockedChatStorage.readChatAttachment).toHaveBeenCalledWith(KEY);
  });

  test('sirve un adjunto local con sesión de operador de la misma sucursal', async () => {
    mockedAuth.mockResolvedValue(buildAuthSession('operator', 1) as any);
    mockedOrderRepository.findById.mockResolvedValue({ id: 10, branchId: 1 } as any);
    mockedChatStorage.readChatAttachment.mockResolvedValue({
      buffer: Buffer.from('imagen'),
      mimeType: 'image/jpeg',
    });

    const response = await GET(
      buildRequest(KEY),
      { params: Promise.resolve({ key: encodeURIComponent(KEY) }) }
    );

    expect(response.status).toBe(200);
    expect(mockedOrderRepository.findById).toHaveBeenCalledWith(1, 10);
  });

  test('sirve un adjunto local con sesión de administrador', async () => {
    mockedAuth.mockResolvedValue(buildAuthSession('admin') as any);
    mockedChatStorage.readChatAttachment.mockResolvedValue({
      buffer: Buffer.from('imagen'),
      mimeType: 'image/jpeg',
    });

    const response = await GET(
      buildRequest(KEY),
      { params: Promise.resolve({ key: encodeURIComponent(KEY) }) }
    );

    expect(response.status).toBe(200);
  });

  test('devuelve 401 si no hay token ni sesión', async () => {
    const response = await GET(
      buildRequest(KEY),
      { params: Promise.resolve({ key: encodeURIComponent(KEY) }) }
    );

    expect(response.status).toBe(401);
    expect(mockedChatStorage.readChatAttachment).not.toHaveBeenCalled();
  });

  test('devuelve 404 si el adjunto no existe localmente', async () => {
    mockedOrderRepository.findByIdWithToken.mockResolvedValue({
      id: 10,
      cancellationToken: TOKEN,
    } as any);
    mockedChatStorage.readChatAttachment.mockResolvedValue(null);

    const response = await GET(
      buildRequest(KEY, TOKEN),
      { params: Promise.resolve({ key: encodeURIComponent(KEY) }) }
    );

    expect(response.status).toBe(404);
  });

  test('devuelve 404 para proveedores remotos', async () => {
    mockedGetStorageProvider.mockReturnValue('vercel-blob');

    const response = await GET(
      buildRequest(KEY),
      { params: Promise.resolve({ key: encodeURIComponent(KEY) }) }
    );

    expect(response.status).toBe(404);
    expect(mockedChatStorage.readChatAttachment).not.toHaveBeenCalled();
  });
});
