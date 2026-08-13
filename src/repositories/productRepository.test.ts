import * as productRepository from './productRepository';
import { products } from '@/db/schema';

/* eslint-disable no-var */

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

  return {
    db: {
      query: {
        products: { findFirst: mockFindFirst, findMany: mockFindMany },
      },
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    },
  };
});

const BRANCH_ID = 1;

describe('productRepository', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    test('devuelve todos los productos activos por defecto', async () => {
      const expected = [{ id: 1, name: 'Pan' }];
      mockFindMany.mockResolvedValue(expected);

      const result = await productRepository.findAll(BRANCH_ID);

      expect(result).toEqual(expected);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
          orderBy: expect.anything(),
        })
      );
    });

    test('devuelve todos los productos incluyendo eliminados', async () => {
      const expected = [{ id: 1, name: 'Pan' }];
      mockFindMany.mockResolvedValue(expected);

      const result = await productRepository.findAll(BRANCH_ID, true);

      expect(result).toEqual(expected);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: expect.anything(),
        })
      );
    });

    test('devuelve un array vacío cuando no hay productos', async () => {
      mockFindMany.mockResolvedValue([]);

      const result = await productRepository.findAll(BRANCH_ID);

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    test('devuelve un producto por su id', async () => {
      const expected = { id: 1, name: 'Pan' };
      mockFindFirst.mockResolvedValue(expected);

      const result = await productRepository.findById(BRANCH_ID, 1);

      expect(result).toEqual(expected);
      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.anything() })
      );
    });

    test('devuelve null si el producto no existe', async () => {
      mockFindFirst.mockResolvedValue(undefined);

      const result = await productRepository.findById(BRANCH_ID, 999);

      expect(result).toBeNull();
    });

    test('puede incluir productos eliminados', async () => {
      const expected = { id: 1, name: 'Pan', deletedAt: new Date() };
      mockFindFirst.mockResolvedValue(expected);

      const result = await productRepository.findById(BRANCH_ID, 1, true);

      expect(result).toEqual(expected);
      expect(mockFindFirst).toHaveBeenCalled();
    });

    test('devuelve null cuando el producto pertenece a otra sucursal', async () => {
      mockFindFirst.mockResolvedValue(undefined);

      const result = await productRepository.findById(BRANCH_ID, 999);

      expect(result).toBeNull();
    });
  });

  describe('findByIds', () => {
    test('devuelve los productos cuyos ids se indican', async () => {
      const expected = [{ id: 1, name: 'Pan' }];
      mockFindMany.mockResolvedValue(expected);

      const result = await productRepository.findByIds(BRANCH_ID, [1, 2]);

      expect(result).toEqual(expected);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.anything() })
      );
    });

    test('devuelve un array vacío y no consulta si el array está vacío', async () => {
      const result = await productRepository.findByIds(BRANCH_ID, []);

      expect(result).toEqual([]);
      expect(mockFindMany).not.toHaveBeenCalled();
    });
  });

  describe('findActive', () => {
    test('devuelve solo productos activos y no eliminados', async () => {
      const expected = [{ id: 1, name: 'Pan', isActive: true, deletedAt: null }];
      mockFindMany.mockResolvedValue(expected);

      const result = await productRepository.findActive(BRANCH_ID);

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
    test('crea un producto y devuelve el registro', async () => {
      const data = {
        name: 'Pan',
        description: 'Pan de panchuque',
        type: 'critical_supply' as const,
        criticalSupplyType: 'bread' as const,
        price: 500,
        unit: 'unidad',
        stock: 100,
        minStock: 10,
        isActive: true,
        branchId: BRANCH_ID,
      };
      const expected = { id: 1, ...data };
      mockReturning.mockResolvedValue([expected]);

      const result = await productRepository.create(data);

      expect(result).toEqual(expected);
      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          ...data,
          updatedAt: expect.any(Date),
        })
      );
    });

    test('normaliza valores nulos al crear', async () => {
      const data = {
        name: 'Gaseosa',
        type: 'critical_supply' as const,
        price: 1000,
        unit: 'unidad',
        stock: 0,
        minStock: 0,
        isActive: true,
        branchId: BRANCH_ID,
      };
      mockReturning.mockResolvedValue([{ id: 1, ...data }]);

      await productRepository.create(data);

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          description: null,
          criticalSupplyType: null,
        })
      );
    });

    test('devuelve undefined si la inserción no devuelve filas', async () => {
      mockReturning.mockResolvedValue([]);

      const result = await productRepository.create({
        name: 'Pan',
        type: 'critical_supply',
        price: 500,
        unit: 'unidad',
        branchId: BRANCH_ID,
      } as any);

      expect(result).toBeUndefined();
    });
  });

  describe('update', () => {
    test('actualiza un producto y devuelve el registro', async () => {
      const expected = { id: 1, name: 'Pancho' };
      mockReturning.mockResolvedValue([expected]);

      const result = await productRepository.update(BRANCH_ID, 1, { name: 'Pancho' });

      expect(result).toEqual(expected);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Pancho',
          updatedAt: expect.any(Date),
        })
      );
    });

    test('devuelve null si el producto no existe', async () => {
      mockReturning.mockResolvedValue([]);

      const result = await productRepository.update(BRANCH_ID, 999, { name: 'Pancho' });

      expect(result).toBeNull();
    });
  });

  describe('softDelete', () => {
    test('marca el producto como inactivo y eliminado', async () => {
      const expected = { id: 1, isActive: false, deletedAt: new Date() };
      mockReturning.mockResolvedValue([expected]);

      const result = await productRepository.softDelete(BRANCH_ID, 1);

      expect(result).toEqual(expected);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: false,
          deletedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );
    });

    test('devuelve null si el producto no existe', async () => {
      mockReturning.mockResolvedValue([]);

      const result = await productRepository.softDelete(BRANCH_ID, 999);

      expect(result).toBeNull();
    });
  });

  describe('restore', () => {
    test('restaura un producto eliminado', async () => {
      const expected = { id: 1, isActive: true, deletedAt: null };
      mockReturning.mockResolvedValue([expected]);

      const result = await productRepository.restore(BRANCH_ID, 1);

      expect(result).toEqual(expected);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: true,
          deletedAt: null,
          updatedAt: expect.any(Date),
        })
      );
    });

    test('devuelve null si el producto no existe', async () => {
      mockReturning.mockResolvedValue([]);

      const result = await productRepository.restore(BRANCH_ID, 999);

      expect(result).toBeNull();
    });
  });
});
