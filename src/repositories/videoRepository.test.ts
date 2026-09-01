import * as videoRepository from './videoRepository';
import { videos } from '@/db/schema';


var mockFindFirst: jest.Mock;
var mockFindMany: jest.Mock;
var mockReturning: jest.Mock;
var mockValues: jest.Mock;
var mockInsert: jest.Mock;
var mockWhereReturning: jest.Mock;
var mockSet: jest.Mock;
var mockUpdate: jest.Mock;
var mockDelete: jest.Mock;

jest.mock('@/db', () => {
  mockFindFirst = jest.fn();
  mockFindMany = jest.fn();
  mockReturning = jest.fn();
  mockValues = jest.fn((data: unknown) => ({ returning: mockReturning }));
  mockInsert = jest.fn(() => ({ values: mockValues }));
  mockWhereReturning = jest.fn(() => ({ returning: mockReturning }));
  mockSet = jest.fn(() => ({ where: mockWhereReturning }));
  mockUpdate = jest.fn(() => ({ set: mockSet }));
  mockDelete = jest.fn(() => ({ where: mockWhereReturning }));

  return {
    db: {
      query: {
        videos: { findFirst: mockFindFirst, findMany: mockFindMany },
      },
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    },
  };
});

const BRANCH_ID = 1;

describe('videoRepository', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    test('devuelve todos los videos activos por defecto', async () => {
      const expected = [{ id: 1, title: 'Promo' }];
      mockFindMany.mockResolvedValue(expected);

      const result = await videoRepository.findAll(BRANCH_ID);

      expect(result).toEqual(expected);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
          orderBy: expect.anything(),
        })
      );
    });

    test('devuelve todos los videos incluyendo eliminados', async () => {
      const expected = [{ id: 1, title: 'Promo' }];
      mockFindMany.mockResolvedValue(expected);

      const result = await videoRepository.findAll(BRANCH_ID, true);

      expect(result).toEqual(expected);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: expect.anything(),
        })
      );
    });

    test('devuelve un array vacío cuando no hay videos', async () => {
      mockFindMany.mockResolvedValue([]);

      const result = await videoRepository.findAll(BRANCH_ID);

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    test('devuelve un video por su id', async () => {
      const expected = { id: 1, title: 'Promo' };
      mockFindFirst.mockResolvedValue(expected);

      const result = await videoRepository.findById(BRANCH_ID, 1);

      expect(result).toEqual(expected);
      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.anything() })
      );
    });

    test('devuelve null si el video no existe', async () => {
      mockFindFirst.mockResolvedValue(undefined);

      const result = await videoRepository.findById(BRANCH_ID, 999);

      expect(result).toBeNull();
    });

    test('puede incluir videos eliminados', async () => {
      const expected = { id: 1, title: 'Promo', deletedAt: new Date() };
      mockFindFirst.mockResolvedValue(expected);

      const result = await videoRepository.findById(BRANCH_ID, 1, true);

      expect(result).toEqual(expected);
      expect(mockFindFirst).toHaveBeenCalled();
    });
  });

  describe('findActive', () => {
    test('devuelve solo videos activos y no eliminados', async () => {
      const expected = [{ id: 1, title: 'Promo', isActive: true, deletedAt: null }];
      mockFindMany.mockResolvedValue(expected);

      const result = await videoRepository.findActive(BRANCH_ID);

      expect(result).toEqual(expected);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
          orderBy: expect.anything(),
        })
      );
    });
  });

  describe('create', () => {
    test('crea un video y devuelve el registro', async () => {
      const data = {
        title: 'Promo',
        description: 'Video de promoción',
        fileUrl: 'https://example.com/video.mp4',
        mimeType: 'video/mp4',
        size: 1024,
        isActive: true,
        branchId: BRANCH_ID,
      };
      const expected = { id: 1, ...data };
      mockReturning.mockResolvedValue([expected]);

      const result = await videoRepository.create(data);

      expect(result).toEqual(expected);
      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          ...data,
          description: data.description,
          size: data.size,
          updatedAt: expect.any(Date),
        })
      );
    });

    test('normaliza valores nulos al crear', async () => {
      const data = {
        title: 'Promo',
        fileUrl: 'https://example.com/video.mp4',
        mimeType: 'video/mp4',
        isActive: true,
        branchId: BRANCH_ID,
      };
      mockReturning.mockResolvedValue([{ id: 1, ...data }]);

      await videoRepository.create(data as any);

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          description: null,
          size: null,
        })
      );
    });

    test('devuelve undefined si la inserción no devuelve filas', async () => {
      mockReturning.mockResolvedValue([]);

      const result = await videoRepository.create({
        title: 'Promo',
        fileUrl: 'https://example.com/video.mp4',
        mimeType: 'video/mp4',
        isActive: true,
        branchId: BRANCH_ID,
      } as any);

      expect(result).toBeUndefined();
    });
  });

  describe('update', () => {
    test('actualiza un video y devuelve el registro', async () => {
      const expected = { id: 1, title: 'Promo actualizada' };
      mockReturning.mockResolvedValue([expected]);

      const result = await videoRepository.update(BRANCH_ID, 1, { title: 'Promo actualizada' });

      expect(result).toEqual(expected);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Promo actualizada',
          updatedAt: expect.any(Date),
        })
      );
    });

    test('devuelve null si el video no existe', async () => {
      mockReturning.mockResolvedValue([]);

      const result = await videoRepository.update(BRANCH_ID, 999, { title: 'Promo' });

      expect(result).toBeNull();
    });
  });

  describe('softDelete', () => {
    test('marca el video como inactivo y eliminado', async () => {
      const expected = { id: 1, isActive: false, deletedAt: new Date() };
      mockReturning.mockResolvedValue([expected]);

      const result = await videoRepository.softDelete(BRANCH_ID, 1);

      expect(result).toEqual(expected);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: false,
          deletedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );
    });

    test('devuelve null si el video no existe', async () => {
      mockReturning.mockResolvedValue([]);

      const result = await videoRepository.softDelete(BRANCH_ID, 999);

      expect(result).toBeNull();
    });
  });

  describe('hardDelete', () => {
    test('elimina permanentemente un video', async () => {
      const expected = { id: 1, title: 'Promo' };
      mockReturning.mockResolvedValue([expected]);

      const result = await videoRepository.hardDelete(BRANCH_ID, 1);

      expect(result).toEqual(expected);
      expect(mockDelete).toHaveBeenCalled();
      expect(mockWhereReturning).toHaveBeenCalled();
    });

    test('devuelve null si el video no existe', async () => {
      mockReturning.mockResolvedValue([]);

      const result = await videoRepository.hardDelete(BRANCH_ID, 999);

      expect(result).toBeNull();
    });
  });

  describe('restore', () => {
    test('restaura un video eliminado', async () => {
      const expected = { id: 1, isActive: true, deletedAt: null };
      mockReturning.mockResolvedValue([expected]);

      const result = await videoRepository.restore(BRANCH_ID, 1);

      expect(result).toEqual(expected);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: true,
          deletedAt: null,
          updatedAt: expect.any(Date),
        })
      );
    });

    test('devuelve null si el video no existe', async () => {
      mockReturning.mockResolvedValue([]);

      const result = await videoRepository.restore(BRANCH_ID, 999);

      expect(result).toBeNull();
    });
  });
});
