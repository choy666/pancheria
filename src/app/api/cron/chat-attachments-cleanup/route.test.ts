/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from './route';
import * as orderMessageRepository from '@/repositories/orderMessageRepository';
import { getStorageProvider } from '@/config/videos';

jest.mock('@/repositories/orderMessageRepository');
jest.mock('@/config/videos', () => ({
  getStorageProvider: jest.fn(),
}));
jest.mock('@/lib/chat-storage', () => ({
  getChatLocalStorageBasePath: jest.fn().mockReturnValue('/tmp/videos'),
}));

const mockedOrderMessageRepository =
  orderMessageRepository as jest.Mocked<typeof orderMessageRepository>;
const mockedGetStorageProvider = getStorageProvider as jest.MockedFunction<
  typeof getStorageProvider
>;

const mockReaddir = jest.fn();
const mockUnlink = jest.fn();

jest.mock('fs', () => ({
  promises: {
    readdir: (...args: unknown[]) => mockReaddir(...args),
    unlink: (...args: unknown[]) => mockUnlink(...args),
  },
}));

function buildRequest(authHeader?: string): NextRequest {
  return new NextRequest(
    'http://localhost:3000/api/cron/chat-attachments-cleanup',
    {
      headers: authHeader ? { authorization: authHeader } : {},
    }
  );
}

function createDirent(name: string, isDir: boolean) {
  return {
    name,
    isDirectory: () => isDir,
    isFile: () => !isDir,
  } as any;
}

describe('GET /api/cron/chat-attachments-cleanup', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, CRON_SECRET: 'test-secret' };
    mockedGetStorageProvider.mockReturnValue('local');
    mockedOrderMessageRepository.findAllAttachmentKeys.mockResolvedValue([]);
    mockReaddir.mockResolvedValue([]);
    mockUnlink.mockResolvedValue(undefined);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('rechaza llamadas sin CRON_SECRET configurado', async () => {
    delete process.env.CRON_SECRET;

    const response = await GET(buildRequest('Bearer test-secret'));

    expect(response.status).toBe(401);
  });

  test('rechaza autorización incorrecta', async () => {
    const response = await GET(buildRequest('Bearer wrong-secret'));

    expect(response.status).toBe(401);
  });

  test('limpia archivos locales huérfanos', async () => {
    mockedOrderMessageRepository.findAllAttachmentKeys.mockResolvedValue([
      'chat/10/abc123.jpg',
    ]);

    mockReaddir.mockImplementation((dir: string) => {
      if (typeof dir !== 'string') return Promise.resolve([]);
      const normalized = dir.replace(/\\/g, '/');
      if (normalized.endsWith('/chat')) {
        return Promise.resolve([createDirent('10', true)]);
      }
      if (normalized.includes('chat/10')) {
        return Promise.resolve([
          createDirent('abc123.jpg', false),
          createDirent('orphan.jpg', false),
        ]);
      }
      return Promise.resolve([]);
    });

    const response = await GET(buildRequest('Bearer test-secret'));
    const body = (await response.json()) as { ok: boolean; deleted: number };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.deleted).toBe(1);
    expect(mockUnlink).toHaveBeenCalledTimes(1);
    expect(mockUnlink).toHaveBeenCalledWith(
      expect.stringMatching(/chat[/\\]10[/\\]orphan\.jpg/)
    );
  });
});
