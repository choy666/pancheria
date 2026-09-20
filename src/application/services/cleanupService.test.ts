/**
 * @jest-environment node
 */
import * as cleanupService from './cleanupService';
import * as orderMessageRepository from '@/repositories/orderMessageRepository';
import * as productRepository from '@/repositories/productRepository';
import * as videoRepository from '@/repositories/videoRepository';
import { getStorageProvider } from '@/config/videos';
import { deleteChatAttachment } from '@/lib/chat-storage';
import { deleteProductImage } from '@/lib/product-image-storage';
import { deleteStorageFile, extractVideoKeyFromUrl } from '@/lib/storage';
import {
  listLocalKeys,
  listRemoteKeys,
  deleteOrphanedKeys,
} from '@/lib/orphaned-files';

jest.mock('@/repositories/orderMessageRepository');
jest.mock('@/repositories/productRepository');
jest.mock('@/repositories/videoRepository');
jest.mock('@/config/videos', () => ({
  getStorageProvider: jest.fn(),
}));
jest.mock('@/config/storage', () => ({
  getChatLocalStorageBasePath: jest.fn().mockReturnValue('/tmp/storage'),
  getLocalStorageBasePath: jest.fn().mockReturnValue('/tmp/storage'),
  getProductImageLocalStorageBasePath: jest
    .fn()
    .mockReturnValue('/tmp/storage/product-images'),
}));
jest.mock('@/lib/chat-storage', () => ({
  deleteChatAttachment: jest.fn(),
}));
jest.mock('@/lib/product-image-storage', () => ({
  deleteProductImage: jest.fn(),
}));
jest.mock('@/lib/storage', () => ({
  deleteStorageFile: jest.fn(),
  extractVideoKeyFromUrl: jest.fn(),
}));
jest.mock('@/lib/orphaned-files', () => ({
  listLocalKeys: jest.fn(),
  listRemoteKeys: jest.fn(),
  deleteOrphanedKeys: jest.fn(),
}));

const mockedOrderMessageRepository = orderMessageRepository as jest.Mocked<
  typeof orderMessageRepository
>;
const mockedProductRepository = productRepository as jest.Mocked<
  typeof productRepository
>;
const mockedVideoRepository = videoRepository as jest.Mocked<
  typeof videoRepository
>;
const mockedGetStorageProvider = getStorageProvider as jest.MockedFunction<
  typeof getStorageProvider
>;
const mockedListLocalKeys = listLocalKeys as jest.MockedFunction<
  typeof listLocalKeys
>;
const mockedListRemoteKeys = listRemoteKeys as jest.MockedFunction<
  typeof listRemoteKeys
>;
const mockedDeleteOrphanedKeys = deleteOrphanedKeys as jest.MockedFunction<
  typeof deleteOrphanedKeys
>;
const mockedDeleteChatAttachment = deleteChatAttachment as jest.MockedFunction<
  typeof deleteChatAttachment
>;
const mockedExtractVideoKeyFromUrl =
  extractVideoKeyFromUrl as jest.MockedFunction<typeof extractVideoKeyFromUrl>;

describe('cleanupService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetStorageProvider.mockReturnValue('local');
    mockedOrderMessageRepository.findAllAttachmentKeys.mockResolvedValue([]);
    mockedProductRepository.findAllImageKeys.mockResolvedValue([]);
    mockedVideoRepository.findAllFileUrls.mockResolvedValue([]);
    mockedListLocalKeys.mockResolvedValue([]);
    mockedListRemoteKeys.mockResolvedValue([]);
    mockedDeleteOrphanedKeys.mockResolvedValue({ listed: 0, deleted: 0 });
  });

  describe('cleanupOrphanedChatAttachments', () => {
    test('lista el directorio chat anidado y borra con deleteChatAttachment', async () => {
      mockedOrderMessageRepository.findAllAttachmentKeys.mockResolvedValue([
        'chat/10/viva.jpg',
      ]);
      mockedListLocalKeys.mockResolvedValue(['10/viva.jpg', '10/huerfana.jpg']);
      mockedDeleteOrphanedKeys.mockResolvedValue({ listed: 2, deleted: 1 });

      const result = await cleanupService.cleanupOrphanedChatAttachments();

      expect(mockedListLocalKeys).toHaveBeenCalledWith(
        expect.stringMatching(/chat$/),
        true
      );
      expect(mockedDeleteOrphanedKeys).toHaveBeenCalledWith(
        ['chat/10/viva.jpg', 'chat/10/huerfana.jpg'],
        new Set(['chat/10/viva.jpg']),
        deleteChatAttachment
      );
      expect(result).toEqual({ listed: 2, deleted: 1 });
    });

    test('usa listRemoteKeys con el proveedor remoto', async () => {
      mockedGetStorageProvider.mockReturnValue('vercel-blob');
      mockedListRemoteKeys.mockResolvedValue(['chat/1/a.jpg']);

      await cleanupService.cleanupOrphanedChatAttachments();

      expect(mockedListRemoteKeys).toHaveBeenCalledWith(
        'vercel-blob',
        'chat/'
      );
    });
  });

  describe('cleanupOrphanedProductImages', () => {
    test('lista product-images anidado y borra con deleteProductImage', async () => {
      mockedProductRepository.findAllImageKeys.mockResolvedValue([
        'product-images/1/viva.jpg',
      ]);
      mockedListLocalKeys.mockResolvedValue(['1/viva.jpg', '2/huerfana.jpg']);

      await cleanupService.cleanupOrphanedProductImages();

      expect(mockedDeleteOrphanedKeys).toHaveBeenCalledWith(
        ['product-images/1/viva.jpg', 'product-images/2/huerfana.jpg'],
        new Set(['product-images/1/viva.jpg']),
        deleteProductImage
      );
    });

    test('usa el prefijo product-images/ en remoto', async () => {
      mockedGetStorageProvider.mockReturnValue('s3');

      await cleanupService.cleanupOrphanedProductImages();

      expect(mockedListRemoteKeys).toHaveBeenCalledWith(
        's3',
        'product-images/'
      );
    });
  });

  describe('cleanupOrphanedVideos', () => {
    test('lista el directorio base plano y deriva claves de file_url', async () => {
      mockedVideoRepository.findAllFileUrls.mockResolvedValue([
        'http://localhost:3000/api/videos/vivo.mp4/stream',
      ]);
      mockedExtractVideoKeyFromUrl.mockReturnValue('vivo.mp4');
      mockedListLocalKeys.mockResolvedValue(['vivo.mp4', 'huerfano.mp4']);

      await cleanupService.cleanupOrphanedVideos();

      expect(mockedListLocalKeys).toHaveBeenCalledWith('/tmp/storage', false);
      expect(mockedDeleteOrphanedKeys).toHaveBeenCalledWith(
        ['vivo.mp4', 'huerfano.mp4'],
        new Set(['vivo.mp4']),
        deleteStorageFile
      );
    });

    test('usa el prefijo videos/ en remoto', async () => {
      mockedGetStorageProvider.mockReturnValue('r2');

      await cleanupService.cleanupOrphanedVideos();

      expect(mockedListRemoteKeys).toHaveBeenCalledWith('r2', 'videos/');
    });
  });

  describe('cleanupExpiredOrderMessages', () => {
    test('borra lotes y libera los adjuntos', async () => {
      mockedOrderMessageRepository.findExpiredForTerminalOrders
        .mockResolvedValueOnce([
          { id: 1, attachmentKey: 'chat/1/a.jpg' },
          { id: 2, attachmentKey: null },
        ])
        .mockResolvedValueOnce([]);
      mockedOrderMessageRepository.deleteByIds.mockResolvedValue(2);

      const deleted = await cleanupService.cleanupExpiredOrderMessages(30);

      expect(deleted).toBe(2);
      expect(mockedOrderMessageRepository.deleteByIds).toHaveBeenCalledWith([
        1, 2,
      ]);
      expect(mockedDeleteChatAttachment).toHaveBeenCalledWith('chat/1/a.jpg');
      expect(mockedDeleteChatAttachment).toHaveBeenCalledTimes(1);
    });

    test('devuelve 0 cuando no hay mensajes expirados', async () => {
      mockedOrderMessageRepository.findExpiredForTerminalOrders.mockResolvedValue(
        []
      );

      const deleted = await cleanupService.cleanupExpiredOrderMessages(30);

      expect(deleted).toBe(0);
      expect(mockedOrderMessageRepository.deleteByIds).not.toHaveBeenCalled();
    });
  });
});
