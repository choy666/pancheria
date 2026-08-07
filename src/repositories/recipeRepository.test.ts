import * as recipeRepository from './recipeRepository';

/* eslint-disable no-var */

var mockFindMany: jest.Mock;
var mockReturning: jest.Mock;
var mockValues: jest.Mock;
var mockInsert: jest.Mock;
var mockDeleteWhere: jest.Mock;
var mockDelete: jest.Mock;

jest.mock('@/db', () => {
  mockFindMany = jest.fn();
  mockReturning = jest.fn();
  mockValues = jest.fn((data: unknown) => ({ returning: mockReturning }));
  mockInsert = jest.fn(() => ({ values: mockValues }));
  mockDeleteWhere = jest.fn();
  mockDelete = jest.fn(() => ({ where: mockDeleteWhere }));

  return {
    db: {
      query: {
        recipes: {
          findMany: mockFindMany,
        },
      },
      insert: mockInsert,
      delete: mockDelete,
    },
  };
});

describe('recipeRepository', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findByCompoundProductId', () => {
    test('devuelve las recetas de un producto compuesto con sus insumos', async () => {
      const expected = [
        { id: 1, compoundProductId: 10, supply: { id: 2, name: 'Pan' } },
      ];
      mockFindMany.mockResolvedValue(expected);

      const result = await recipeRepository.findByCompoundProductId(10);

      expect(result).toEqual(expected);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
          with: expect.objectContaining({ supply: true }),
        })
      );
    });

    test('devuelve un array vacío cuando el producto no tiene receta', async () => {
      mockFindMany.mockResolvedValue([]);

      const result = await recipeRepository.findByCompoundProductId(99);

      expect(result).toEqual([]);
    });
  });

  describe('replaceRecipe', () => {
    test('reemplaza la receta de un producto compuesto', async () => {
      const items = [
        { supplyId: 1, quantity: 2, autoDiscount: true },
        { supplyId: 2, quantity: 1, autoDiscount: false },
      ];
      const expected = [
        { id: 1, compoundProductId: 10, supplyId: 1, quantity: 2, autoDiscount: true },
        { id: 2, compoundProductId: 10, supplyId: 2, quantity: 1, autoDiscount: false },
      ];
      mockDeleteWhere.mockResolvedValue(undefined);
      mockReturning.mockResolvedValue(expected);

      const result = await recipeRepository.replaceRecipe(10, items);

      expect(result).toEqual(expected);
      expect(mockDelete).toHaveBeenCalled();
      expect(mockDeleteWhere).toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith([
        {
          compoundProductId: 10,
          supplyId: 1,
          quantity: 2,
          autoDiscount: true,
        },
        {
          compoundProductId: 10,
          supplyId: 2,
          quantity: 1,
          autoDiscount: false,
        },
      ]);
    });

    test('elimina la receta y no inserta si no hay items', async () => {
      mockDeleteWhere.mockResolvedValue(undefined);

      const result = await recipeRepository.replaceRecipe(10, []);

      expect(result).toEqual([]);
      expect(mockDelete).toHaveBeenCalled();
      expect(mockDeleteWhere).toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  describe('deleteByCompoundProductId', () => {
    test('elimina las recetas de un producto compuesto', async () => {
      mockDeleteWhere.mockResolvedValue(undefined);

      await recipeRepository.deleteByCompoundProductId(10);

      expect(mockDelete).toHaveBeenCalled();
      expect(mockDeleteWhere).toHaveBeenCalled();
    });
  });
});
