import {
  listVideos,
  getVideoById,
  listActiveVideos,
  prepareUpload,
  createVideo,
  updateVideo,
  toggleVideoStatus,
  deleteVideo,
  restoreVideo,
  permanentlyDeleteVideo,
} from './videoService';
import * as videoRepository from '@/repositories/videoRepository';
import * as storage from '@/lib/storage';
import { NotFoundError, ValidationError } from '@/domain/errors';
import type { VideoRow } from '@/domain/types';

jest.mock('@/repositories/videoRepository');
jest.mock('@/lib/storage');

const mockedVideoRepository = videoRepository as jest.Mocked<typeof videoRepository>;
const mockedStorage = storage as jest.Mocked<typeof storage>;

const BRANCH_ID = 1;

const validVideo = {
  title: 'Promo',
  description: null,
  fileUrl: 'https://example.com/video.mp4',
  mimeType: 'video/mp4',
  size: 1024,
  isActive: true,
};

describe('videoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listVideos', () => {
    test('lista videos activos por defecto', async () => {
      mockedVideoRepository.findAll.mockResolvedValue([
        { id: 1, title: 'Promo 1' },
      ] as VideoRow[]);

      const result = await listVideos(BRANCH_ID);

      expect(result).toHaveLength(1);
      expect(mockedVideoRepository.findAll).toHaveBeenCalledWith(BRANCH_ID, false);
    });

    test('puede incluir videos eliminados', async () => {
      mockedVideoRepository.findAll.mockResolvedValue([
        { id: 1, title: 'Promo', deletedAt: null },
        { id: 2, title: 'Promo vieja', deletedAt: new Date() },
      ] as VideoRow[]);

      const result = await listVideos(BRANCH_ID, true);

      expect(result).toHaveLength(2);
      expect(mockedVideoRepository.findAll).toHaveBeenCalledWith(BRANCH_ID, true);
    });
  });

  describe('getVideoById', () => {
    test('obtiene un video por su ID', async () => {
      mockedVideoRepository.findById.mockResolvedValue({
        id: 1,
        title: 'Promo',
      } as VideoRow);

      const result = await getVideoById(BRANCH_ID, 1);

      expect(result!.id).toBe(1);
      expect(mockedVideoRepository.findById).toHaveBeenCalledWith(BRANCH_ID, 1, false);
    });

    test('lanza NotFoundError si el video no existe', async () => {
      mockedVideoRepository.findById.mockResolvedValue(null);

      await expect(getVideoById(BRANCH_ID, 999)).rejects.toThrow(NotFoundError);
    });
  });

  describe('listActiveVideos', () => {
    test('lista los videos activos', async () => {
      mockedVideoRepository.findActive.mockResolvedValue([
        { id: 1, title: 'Promo', isActive: true },
      ] as VideoRow[]);

      const result = await listActiveVideos(BRANCH_ID);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Promo');
      expect(mockedVideoRepository.findActive).toHaveBeenCalledWith(BRANCH_ID);
    });
  });

  describe('prepareUpload', () => {
    test('prepara la subida de un archivo válido', async () => {
      const instructions = {
        url: 'https://example.com/upload',
        method: 'POST' as const,
        fields: {},
        key: 'key',
        publicUrl: 'https://example.com/video.mp4',
      };

      mockedStorage.getStorageProvider.mockReturnValue({
        prepareUpload: jest.fn().mockResolvedValue(instructions),
        getPublicUrl: jest.fn(),
      } as unknown as storage.StorageProvider);

      const result = await prepareUpload(BRANCH_ID, {
        name: 'video.mp4',
        type: 'video/mp4',
        size: 1024,
      });

      expect(result).toEqual(instructions);
    });

    test('rechaza archivos con tipo MIME no permitido', async () => {
      await expect(
        prepareUpload(BRANCH_ID, {
          name: 'video.avi',
          type: 'video/x-msvideo',
          size: 1024,
        })
      ).rejects.toThrow(ValidationError);
    });

    test('rechaza archivos que superan el tamaño máximo', async () => {
      await expect(
        prepareUpload(BRANCH_ID, {
          name: 'video.mp4',
          type: 'video/mp4',
          size: 1000 * 1024 * 1024 * 1024,
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('createVideo', () => {
    test('crea un video válido', async () => {
      mockedVideoRepository.create.mockResolvedValue({
        id: 1,
        ...validVideo,
        branchId: BRANCH_ID,
      } as VideoRow);

      const result = await createVideo(BRANCH_ID, validVideo);

      expect(result!.title).toBe('Promo');
      expect(mockedVideoRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ ...validVideo, branchId: BRANCH_ID })
      );
    });

    test('rechaza un video con tipo MIME no permitido', async () => {
      await expect(
        createVideo(BRANCH_ID, {
          ...validVideo,
          mimeType: 'video/x-msvideo',
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('updateVideo', () => {
    test('actualiza un video existente', async () => {
      mockedVideoRepository.findById.mockResolvedValue({
        id: 1,
        ...validVideo,
        branchId: BRANCH_ID,
      } as VideoRow);
      mockedVideoRepository.update.mockResolvedValue({
        id: 1,
        title: 'Promo actualizada',
      } as VideoRow);

      const result = await updateVideo(BRANCH_ID, 1, { title: 'Promo actualizada' });

      expect(result!.title).toBe('Promo actualizada');
    });

    test('lanza NotFoundError si el video no existe', async () => {
      mockedVideoRepository.findById.mockResolvedValue(null);

      await expect(
        updateVideo(BRANCH_ID, 999, { title: 'Promo' })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('toggleVideoStatus', () => {
    test('cambia el estado de un video', async () => {
      mockedVideoRepository.findById.mockResolvedValue({
        id: 1,
        ...validVideo,
        branchId: BRANCH_ID,
      } as VideoRow);
      mockedVideoRepository.update.mockResolvedValue({
        id: 1,
        isActive: false,
      } as VideoRow);

      const result = await toggleVideoStatus(BRANCH_ID, 1, false);

      expect(result!.isActive).toBe(false);
    });
  });

  describe('deleteVideo', () => {
    test('realiza un soft delete del video', async () => {
      mockedVideoRepository.findById.mockResolvedValue({
        id: 1,
        ...validVideo,
        branchId: BRANCH_ID,
      } as VideoRow);
      mockedVideoRepository.softDelete.mockResolvedValue({
        id: 1,
        isActive: false,
        deletedAt: new Date(),
      } as VideoRow);

      const result = await deleteVideo(BRANCH_ID, 1);

      expect(result!.deletedAt).not.toBeNull();
    });
  });

  describe('restoreVideo', () => {
    test('restaura un video eliminado', async () => {
      mockedVideoRepository.findById.mockResolvedValue({
        id: 1,
        ...validVideo,
        deletedAt: new Date(),
        branchId: BRANCH_ID,
      } as VideoRow);
      mockedVideoRepository.restore.mockResolvedValue({
        id: 1,
        isActive: true,
        deletedAt: null,
      } as VideoRow);

      const result = await restoreVideo(BRANCH_ID, 1);

      expect(result!.deletedAt).toBeNull();
    });
  });

  describe('permanentlyDeleteVideo', () => {
    test('rechaza eliminar un video que no está en papelera', async () => {
      mockedVideoRepository.findById.mockResolvedValue({
        id: 1,
        ...validVideo,
        deletedAt: null,
        branchId: BRANCH_ID,
      } as VideoRow);

      await expect(permanentlyDeleteVideo(BRANCH_ID, 1)).rejects.toThrow(
        ValidationError
      );
      expect(mockedVideoRepository.hardDelete).not.toHaveBeenCalled();
    });

    test('elimina permanentemente un video en papelera y borra el archivo', async () => {
      mockedVideoRepository.findById.mockResolvedValue({
        id: 1,
        ...validVideo,
        deletedAt: new Date(),
        branchId: BRANCH_ID,
      } as VideoRow);
      mockedVideoRepository.hardDelete.mockResolvedValue({
        id: 1,
        ...validVideo,
        deletedAt: new Date(),
      } as VideoRow);

      const result = await permanentlyDeleteVideo(BRANCH_ID, 1);

      expect(result!.id).toBe(1);
      expect(mockedVideoRepository.hardDelete).toHaveBeenCalledWith(BRANCH_ID, 1);
      expect(mockedStorage.deleteVideoFileByUrl).toHaveBeenCalledWith(
        validVideo.fileUrl
      );
    });

    test('elimina permanentemente un video en papelera sin archivo', async () => {
      mockedVideoRepository.findById.mockResolvedValue({
        id: 1,
        ...validVideo,
        fileUrl: '',
        deletedAt: new Date(),
        branchId: BRANCH_ID,
      } as unknown as VideoRow);
      mockedVideoRepository.hardDelete.mockResolvedValue({
        id: 1,
        ...validVideo,
        deletedAt: new Date(),
      } as VideoRow);

      await permanentlyDeleteVideo(BRANCH_ID, 1);

      expect(mockedStorage.deleteVideoFileByUrl).not.toHaveBeenCalled();
    });
  });
});
