/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from './route';
import * as publicOrderRateLimitStore from '@/lib/public-order-rate-limit-store';
import * as chatService from '@/application/services/chatService';
import { requireAuth, getCurrentBranchId } from '@/lib/auth';
import { ValidationError } from '@/domain/errors';

jest.mock('@/lib/public-order-rate-limit-store', () => {
  const store = { recordRequest: jest.fn().mockResolvedValue(false) };
  return {
    createPublicOrderRateLimitStore: jest.fn().mockReturnValue(store),
  };
});

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

const mockedStore =
  publicOrderRateLimitStore as jest.Mocked<typeof publicOrderRateLimitStore>;
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
    `http://localhost:3000/api/pedidos/${ORDER_ID}/chat/ubicacion`,
    init
  );
}

function getStoreRecordRequest() {
  const store = mockedStore.createPublicOrderRateLimitStore();
  return store.recordRequest as jest.MockedFunction<
    () => Promise<boolean>
  >;
}

describe('POST /api/pedidos/[id]/chat/ubicacion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.E2E_ENABLE_RATE_LIMIT = 'true';
    getStoreRecordRequest().mockResolvedValue(false);

    const session = {
      user: { name: 'Juan', role: 'operator', branchId: BRANCH_ID },
    } as any;
    mockedRequireAuth.mockResolvedValue(session);
    mockedGetCurrentBranchId.mockResolvedValue(BRANCH_ID);
    mockedChatService.sendBranchLocationMessage.mockResolvedValue({
      id: 1,
      content: 'https://www.openstreetmap.org/?mlat=-34.6&mlon=-58.3',
      senderName: 'Juan',
    } as any);
  });

  afterEach(() => {
    delete process.env.E2E_ENABLE_RATE_LIMIT;
  });

  test('envía la ubicación de la sucursal', async () => {
    const response = await POST(
      buildRequest({ method: 'POST' }),
      { params: Promise.resolve({ id: String(ORDER_ID) }) }
    );
    const body = (await response.json()) as { message: unknown };

    expect(response.status).toBe(201);
    expect(body.message).toEqual(
      expect.objectContaining({
        content: 'https://www.openstreetmap.org/?mlat=-34.6&mlon=-58.3',
      })
    );
    expect(mockedChatService.sendBranchLocationMessage).toHaveBeenCalledWith(
      ORDER_ID,
      BRANCH_ID,
      'Juan'
    );
    expect(getStoreRecordRequest()).toHaveBeenCalledWith(
      'branch-location',
      String(BRANCH_ID),
      60_000,
      5
    );
  });

  test('rechaza un ID inválido', async () => {
    const response = await POST(
      buildRequest({ method: 'POST' }),
      { params: Promise.resolve({ id: 'abc' }) }
    );

    expect(response.status).toBe(400);
    expect(mockedChatService.sendBranchLocationMessage).not.toHaveBeenCalled();
    expect(getStoreRecordRequest()).not.toHaveBeenCalled();
  });

  test('devuelve 429 cuando se supera el rate limit', async () => {
    getStoreRecordRequest().mockResolvedValue(true);

    const response = await POST(
      buildRequest({ method: 'POST' }),
      { params: Promise.resolve({ id: String(ORDER_ID) }) }
    );

    expect(response.status).toBe(429);
    expect(mockedChatService.sendBranchLocationMessage).not.toHaveBeenCalled();
  });

  test('propaga errores de validación del servicio como 400', async () => {
    mockedChatService.sendBranchLocationMessage.mockRejectedValue(
      new ValidationError('La sucursal no tiene ubicación configurada.')
    );

    const response = await POST(
      buildRequest({ method: 'POST' }),
      { params: Promise.resolve({ id: String(ORDER_ID) }) }
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('La sucursal no tiene ubicación configurada.');
  });
});
