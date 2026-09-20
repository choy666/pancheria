/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from './route';
import * as cleanupService from '@/application/services/cleanupService';

jest.mock('@/application/services/cleanupService', () => ({
  cleanupOrphanedChatAttachments: jest.fn(),
  cleanupOrphanedProductImages: jest.fn(),
  cleanupOrphanedVideos: jest.fn(),
  cleanupExpiredOrderMessages: jest.fn(),
}));

const mockedCleanupService = cleanupService as jest.Mocked<
  typeof cleanupService
>;

const ORIGINAL_ENV = {
  CRON_SECRET: process.env.CRON_SECRET,
  ORDER_MESSAGES_RETENTION_DAYS: process.env.ORDER_MESSAGES_RETENTION_DAYS,
};

beforeAll(() => {
  process.env.CRON_SECRET = 'secreto-cron';
});

afterAll(() => {
  process.env.CRON_SECRET = ORIGINAL_ENV.CRON_SECRET;
  process.env.ORDER_MESSAGES_RETENTION_DAYS =
    ORIGINAL_ENV.ORDER_MESSAGES_RETENTION_DAYS;
});

function buildRequest(authHeader?: string): NextRequest {
  return new NextRequest(
    'http://localhost:3000/api/cron/chat-attachments-cleanup',
    {
      headers: authHeader ? { authorization: authHeader } : {},
    }
  );
}

describe('GET /api/cron/chat-attachments-cleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.ORDER_MESSAGES_RETENTION_DAYS;
    mockedCleanupService.cleanupOrphanedChatAttachments.mockResolvedValue({
      listed: 10,
      deleted: 2,
    });
    mockedCleanupService.cleanupOrphanedProductImages.mockResolvedValue({
      listed: 5,
      deleted: 1,
    });
    mockedCleanupService.cleanupOrphanedVideos.mockResolvedValue({
      listed: 3,
      deleted: 0,
    });
    mockedCleanupService.cleanupExpiredOrderMessages.mockResolvedValue(4);
  });

  test('devuelve 401 sin autorización', async () => {
    const response = await GET(buildRequest());

    expect(response.status).toBe(401);
    expect(
      mockedCleanupService.cleanupOrphanedChatAttachments
    ).not.toHaveBeenCalled();
  });

  test('ejecuta los cleanups de los tres dominios sin retención por defecto', async () => {
    const response = await GET(buildRequest('Bearer secreto-cron'));
    const body = (await response.json()) as {
      ok: boolean;
      chatAttachments: { deleted: number };
      productImages: { deleted: number };
      videos: { deleted: number };
      deletedMessages: number;
    };

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      chatAttachments: { listed: 10, deleted: 2 },
      productImages: { listed: 5, deleted: 1 },
      videos: { listed: 3, deleted: 0 },
      deletedMessages: 0,
    });
    expect(
      mockedCleanupService.cleanupExpiredOrderMessages
    ).not.toHaveBeenCalled();
  });

  test('purga mensajes cuando ORDER_MESSAGES_RETENTION_DAYS está definido', async () => {
    process.env.ORDER_MESSAGES_RETENTION_DAYS = '30';

    const response = await GET(buildRequest('Bearer secreto-cron'));
    const body = (await response.json()) as { deletedMessages: number };

    expect(response.status).toBe(200);
    expect(
      mockedCleanupService.cleanupExpiredOrderMessages
    ).toHaveBeenCalledWith(30);
    expect(body.deletedMessages).toBe(4);
  });
});
