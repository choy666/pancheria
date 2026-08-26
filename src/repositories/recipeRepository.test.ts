import * as recipeRepository from './recipeRepository';


var mockFindMany: jest.Mock;
var mockProductFindFirst: jest.Mock;
var mockReturning: jest.Mock;
var mockValues: jest.Mock;
var mockInsert: jest.Mock;
var mockDeleteWhere: jest.Mock;
var mockDelete: jest.Mock;

jest.mock('@/db', () => {
  mockFindMany = jest.fn();
  mockProductFindFirst = jest.fn();
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
        products: {
          findFirst: mockProductFindFirst,
        },
      },
      insert: mockInsert,
      delete: mockDelete,
    },
  };
});

const BRANCH_ID = 1;

describe('recipeRepository', () => {
  beforeEach(() => {
    mockProductFindFirst.mockResolvedValue({ id: 1 });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findByCompoundProductId', () => {
    test('devuelve las recetas de un producto compuesto con sus insumos', async () => {
      const expected = [
        { id: 1, compoundProductId: 10, supply: { id: 2, name: 'Pan' } },
      ];
      mockFindMany.mockResolvedValue(expected);

      const result = await recipeRepository.findByCompoundProductId(BRANCH_ID, 10);

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

      const result = await recipeRepository.findByCompoundProductId(BRANCH_ID, 99);

      expect(result).toEqual([]);
    });

    test('devuelve un array vacío cuando el producto compuesto no pertenece a la sucursal', async () => {
      mockProductFindFirst.mockResolvedValue(null);

      const result = await recipeRepository.findByCompoundProductId(BRANCH_ID, 10);

      expect(result).toEqual([]);
      expect(mockProductFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
          columns: expect.objectContaining({ id: true }),
        })
      );
      expect(mockFindMany).not.toHaveBeenCalled();
    });
  });

  describe('deleteByCompoundProductId', () => {
    test('elimina las recetas de un producto compuesto', async () => {
      mockDeleteWhere.mockResolvedValue(undefined);

      await recipeRepository.deleteByCompoundProductId(BRANCH_ID, 10);

      expect(mockDelete).toHaveBeenCalled();
      expect(mockDeleteWhere).toHaveBeenCalled();
    });
  });
});
