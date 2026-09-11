import * as branchRepository from './branchRepository';

var mockFindFirst: jest.Mock;
var mockFindMany: jest.Mock;
var mockReturning: jest.Mock;
var mockValues: jest.Mock;
var mockInsert: jest.Mock;
var mockWhereReturning: jest.Mock;
var mockSet: jest.Mock;
var mockUpdate: jest.Mock;
var mockDeleteWhere: jest.Mock;
var mockDelete: jest.Mock;
var mockFrom: jest.Mock;
var mockWhere: jest.Mock;
var mockSelect: jest.Mock;

jest.mock('@/db', () => {
  mockFindFirst = jest.fn();
  mockFindMany = jest.fn();
  mockReturning = jest.fn();
  mockValues = jest.fn((data: unknown) => ({ returning: mockReturning }));
  mockInsert = jest.fn(() => ({ values: mockValues }));
  mockWhereReturning = jest.fn(() => ({ returning: mockReturning }));
  mockSet = jest.fn(() => ({ where: mockWhereReturning }));
  mockUpdate = jest.fn(() => ({ set: mockSet }));
  mockDeleteWhere = jest.fn();
  mockDelete = jest.fn(() => ({ where: mockDeleteWhere }));
  mockWhere = jest.fn();
  mockFrom = jest.fn(() => ({ where: mockWhere }));
  mockSelect = jest.fn(() => ({ from: mockFrom }));

  return {
    db: {
      query: {
        branches: { findFirst: mockFindFirst, findMany: mockFindMany },
      },
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
      select: mockSelect,
    },
  };
});

const BRANCH_ID = 1;

describe('branchRepository', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAllOrderedByCreatedAt', () => {
    test('devuelve todas las sucursales ordenadas por createdAt', async () => {
      const expected = [{ id: 1, name: 'Central' }];
      mockFindMany.mockResolvedValue(expected);

      const result = await branchRepository.findAllOrderedByCreatedAt();

      expect(result).toEqual(expected);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: expect.anything() })
      );
    });
  });

  describe('findById', () => {
    test('devuelve una sucursal por su id', async () => {
      const expected = { id: 1, name: 'Central' };
      mockFindFirst.mockResolvedValue(expected);

      const result = await branchRepository.findById(1);

      expect(result).toEqual(expected);
      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.anything() })
      );
    });

    test('devuelve undefined si la sucursal no existe', async () => {
      mockFindFirst.mockResolvedValue(undefined);

      const result = await branchRepository.findById(999);

      expect(result).toBeUndefined();
    });
  });

  describe('findByName', () => {
    test('devuelve una sucursal por su nombre exacto', async () => {
      const expected = { id: 1, name: 'Central' };
      mockFindFirst.mockResolvedValue(expected);

      const result = await branchRepository.findByName('Central');

      expect(result).toEqual(expected);
      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.anything() })
      );
    });

    test('devuelve undefined si no existe', async () => {
      mockFindFirst.mockResolvedValue(undefined);

      const result = await branchRepository.findByName('Inexistente');

      expect(result).toBeUndefined();
    });
  });

  describe('findByNameCaseInsensitiveExcludingId', () => {
    test('busca por nombre sin distinguir mayúsculas excluyendo un id', async () => {
      const expected = { id: 2, name: 'central' };
      mockFindFirst.mockResolvedValue(expected);

      const result = await branchRepository.findByNameCaseInsensitiveExcludingId(
        'central',
        1
      );

      expect(result).toEqual(expected);
      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.anything() })
      );
    });
  });

  describe('insert', () => {
    test('inserta una sucursal y devuelve el registro', async () => {
      const data = { name: 'Nueva', openingHours: [] };
      const expected = { id: 1, ...data };
      mockReturning.mockResolvedValue([expected]);

      const result = await branchRepository.insert(data);

      expect(result).toEqual(expected);
      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(data);
    });

    test('devuelve null si no hay filas devueltas', async () => {
      mockReturning.mockResolvedValue([]);

      const result = await branchRepository.insert({
        name: 'Nueva',
        openingHours: [],
      });

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    test('actualiza una sucursal y devuelve el registro', async () => {
      const expected = { id: 1, name: 'Actualizada' };
      mockReturning.mockResolvedValue([expected]);

      const result = await branchRepository.update(1, { name: 'Actualizada' });

      expect(result).toEqual(expected);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith({ name: 'Actualizada' });
    });

    test('devuelve null si la sucursal no existe', async () => {
      mockReturning.mockResolvedValue([]);

      const result = await branchRepository.update(999, { name: 'Actualizada' });

      expect(result).toBeNull();
    });
  });

  describe('findProductIdsByBranch', () => {
    test('devuelve los ids de productos de la sucursal', async () => {
      mockWhere.mockResolvedValue([{ id: 1 }, { id: 2 }]);

      const result = await branchRepository.findProductIdsByBranch(BRANCH_ID);

      expect(result).toEqual([1, 2]);
      expect(mockSelect).toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
    });
  });

  describe('findUsernamesByBranch', () => {
    test('devuelve los nombres de usuario de la sucursal', async () => {
      mockWhere.mockResolvedValue([
        { username: 'admin' },
        { username: 'operador' },
      ]);

      const result = await branchRepository.findUsernamesByBranch(BRANCH_ID);

      expect(result).toEqual(['admin', 'operador']);
    });
  });

  describe('findAttachmentKeysByOrderIds', () => {
    test('devuelve un array vacío si no hay ids', async () => {
      const result = await branchRepository.findAttachmentKeysByOrderIds([]);

      expect(result).toEqual([]);
    });

    test('devuelve las attachment keys filtrando nulos', async () => {
      mockWhere.mockResolvedValue([
        { attachmentKey: 'a' },
        { attachmentKey: null },
        { attachmentKey: 'b' },
      ]);

      const result = await branchRepository.findAttachmentKeysByOrderIds([1, 2]);

      expect(result).toEqual(['a', 'b']);
    });
  });

  describe('countBranchDeletionImpact', () => {
    test('devuelve conteos de entidades relacionadas', async () => {
      mockWhere
        .mockResolvedValueOnce([{ count: 5 }])
        .mockResolvedValueOnce([{ count: 1 }])
        .mockResolvedValueOnce([{ count: 2 }])
        .mockResolvedValueOnce([{ count: 3 }])
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([{ count: 4 }])
        .mockResolvedValueOnce([{ count: 1 }]);

      const result = await branchRepository.countBranchDeletionImpact(BRANCH_ID, [1, 2]);

      expect(result).toEqual({
        products: 2,
        sales: 5,
        cashRegisters: 1,
        stockMovements: 2,
        users: 3,
        recipes: 0,
        orders: 4,
        videos: 1,
      });
    });

    test('devuelve cero en recetas si no hay productos', async () => {
      mockWhere
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([{ count: 0 }]);

      const result = await branchRepository.countBranchDeletionImpact(BRANCH_ID, []);

      expect(result).toEqual({
        products: 0,
        sales: 0,
        cashRegisters: 0,
        stockMovements: 0,
        users: 0,
        recipes: 0,
        orders: 0,
        videos: 0,
      });
    });
  });

  describe('deleteCascade', () => {
    test('elimina todos los registros asociados a la sucursal', async () => {
      const txSelectWhere = jest.fn().mockResolvedValue([{ id: 1 }]);
      const txFrom = jest.fn(() => ({ where: txSelectWhere }));
      const txSelect = jest.fn(() => ({ from: txFrom }));
      const txDeleteWhere = jest.fn().mockResolvedValue(undefined);
      const txDelete = jest.fn(() => ({ where: txDeleteWhere }));

      const mockTx: any = {
        select: txSelect,
        delete: txDelete,
      };

      await branchRepository.deleteCascade(mockTx, BRANCH_ID, [1, 2]);

      expect(txSelect).toHaveBeenCalled();
      expect(txDelete).toHaveBeenCalled();
    });
  });
});
