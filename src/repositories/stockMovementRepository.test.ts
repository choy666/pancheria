import * as stockMovementRepository from './stockMovementRepository';

/* eslint-disable no-var */

var mockFindMany: jest.Mock;
var mockReturning: jest.Mock;
var mockValues: jest.Mock;
var mockInsert: jest.Mock;

jest.mock('@/db', () => {
  mockFindMany = jest.fn();
  mockReturning = jest.fn();
  mockValues = jest.fn((data: unknown) => ({ returning: mockReturning }));
  mockInsert = jest.fn(() => ({ values: mockValues }));

  return {
    db: {
      query: {
        stockMovements: { findMany: mockFindMany },
      },
      insert: mockInsert,
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

      const result = await stockMovementRepository.findByProductId(1);

      expect(result).toEqual(expected);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
          orderBy: expect.anything(),
          limit: expect.any(Number),
        })
      );
    });

    test('respeta el límite indicado', async () => {
      const expected = [{ id: 1, productId: 1 }];
      mockFindMany.mockResolvedValue(expected);

      const result = await stockMovementRepository.findByProductId(1, 5);

      expect(result).toEqual(expected);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 5,
        })
      );
    });

    test('devuelve un array vacío si no hay movimientos', async () => {
      mockFindMany.mockResolvedValue([]);

      const result = await stockMovementRepository.findByProductId(999);

      expect(result).toEqual([]);
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
