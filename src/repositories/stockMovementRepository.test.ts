import * as stockMovementRepository from './stockMovementRepository';

/* eslint-disable no-var */

var mockFindMany: jest.Mock;
var mockReturning: jest.Mock;
var mockValues: jest.Mock;
var mockInsert: jest.Mock;
var mockSelect: jest.Mock;

jest.mock('@/db', () => {
  mockFindMany = jest.fn();
  mockReturning = jest.fn();
  mockValues = jest.fn((data: unknown) => ({ returning: mockReturning }));
  mockInsert = jest.fn(() => ({ values: mockValues }));
  mockSelect = jest.fn().mockImplementation(() => ({
    from: jest.fn().mockImplementation(() => ({
      where: jest.fn().mockResolvedValue([{ count: 0 }]),
    })),
  }));

  return {
    db: {
      query: {
        stockMovements: { findMany: mockFindMany },
      },
      insert: mockInsert,
      select: mockSelect,
    },
  };
});

describe('stockMovementRepository', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findByProductId', () => {
    test('devuelve los movimientos de stock de un producto ordenados por fecha', async () => {
      const expected = [
        { id: 1, productId: 1, type: 'restock', quantity: 10 },
        { id: 2, productId: 1, type: 'sale', quantity: -1 },
      ];
      mockFindMany.mockResolvedValue(expected);

      const result = await stockMovementRepository.findByProductId(1, { page: 1, limit: 10 });

      expect(result.items).toEqual(expected);
      expect(result.total).toBe(0);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
          orderBy: expect.anything(),
          limit: 10,
          offset: 0,
        })
      );
    });

    test('respeta el límite indicado', async () => {
      const expected = [{ id: 1, productId: 1 }];
      mockFindMany.mockResolvedValue(expected);

      const result = await stockMovementRepository.findByProductId(1, { page: 1, limit: 5 });

      expect(result.items).toEqual(expected);
      expect(result.limit).toBe(5);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 5,
          offset: 0,
        })
      );
    });

    test('devuelve un array vacío si no hay movimientos', async () => {
      mockFindMany.mockResolvedValue([]);

      const result = await stockMovementRepository.findByProductId(999, { page: 1, limit: 10 });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('create', () => {
    test('crea un movimiento de stock y devuelve el registro', async () => {
      const expected = {
        id: 1,
        productId: 1,
        type: 'restock',
        quantity: 10,
        reason: 'Compra semanal',
        saleId: null,
      };
      mockReturning.mockResolvedValue([expected]);

      const result = await stockMovementRepository.create({
        productId: 1,
        type: 'restock',
        quantity: 10,
        reason: 'Compra semanal',
      });

      expect(result).toEqual(expected);
      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 1,
          type: 'restock',
          quantity: 10,
          reason: 'Compra semanal',
          saleId: null,
        })
      );
    });

    test('normaliza valores opcionales como nulos', async () => {
      mockReturning.mockResolvedValue([{ id: 1 }]);

      await stockMovementRepository.create({
        productId: 1,
        type: 'sale',
        quantity: -1,
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: null,
          saleId: null,
        })
      );
    });

    test('devuelve undefined si la inserción no devuelve filas', async () => {
      mockReturning.mockResolvedValue([]);

      const result = await stockMovementRepository.create({
        productId: 1,
        type: 'manual_adjustment',
        quantity: 0,
      });

      expect(result).toBeUndefined();
    });
  });
});
