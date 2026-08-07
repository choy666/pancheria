import { getRecipeByProductId, saveRecipe } from './recipeService';
import * as productRepository from '@/repositories/productRepository';
import * as recipeRepository from '@/repositories/recipeRepository';
import { db } from '@/db';
import { NotFoundError, ValidationError } from '@/domain/errors';

jest.mock('@/repositories/productRepository');
jest.mock('@/repositories/recipeRepository');
jest.mock('@/db', () => ({
  db: {
    transaction: jest.fn(),
  },
}));

const mockedProductRepository = productRepository as jest.Mocked<
  typeof productRepository
>;
const mockedRecipeRepository = recipeRepository as jest.Mocked<
  typeof recipeRepository
>;
const mockedDb = db as unknown as { transaction: jest.Mock };

function createMockTransaction() {
  const insertReturning = jest.fn().mockResolvedValue([]);
  const insertValues = jest.fn().mockReturnValue({ returning: insertReturning });
  const insert = jest.fn().mockReturnValue({ values: insertValues });
  const deleteWhere = jest.fn().mockResolvedValue([]);
  const deleteFn = jest.fn().mockReturnValue({ where: deleteWhere });

  return {
    insert,
    delete: deleteFn,
    insertValues,
    insertReturning,
    deleteWhere,
  };
}

describe('recipeService', () => {
  let mockTx: ReturnType<typeof createMockTransaction>;

  beforeEach(() => {
    mockTx = createMockTransaction();
    mockedDb.transaction.mockImplementation(async (fn: any) => {
      return await fn(mockTx as any);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getRecipeByProductId', () => {
    test('devuelve la receta de un producto compuesto', async () => {
      mockedProductRepository.findById.mockResolvedValue({
        id: 1,
        name: 'Panchuque',
        type: 'compound',
      } as any);

      const expectedRecipe = [
        {
          id: 1,
          compoundProductId: 1,
          supplyId: 2,
          quantity: 1,
          autoDiscount: true,
          supply: { id: 2, name: 'Pan' },
        },
      ];
      mockedRecipeRepository.findByCompoundProductId.mockResolvedValue(
        expectedRecipe as any
      );

      const result = await getRecipeByProductId(1);

      expect(result).toBe(expectedRecipe);
      expect(mockedProductRepository.findById).toHaveBeenCalledWith(1);
      expect(mockedRecipeRepository.findByCompoundProductId).toHaveBeenCalledWith(
        1
      );
    });

    test('lanza NotFoundError si el producto no es compuesto', async () => {
      mockedProductRepository.findById.mockResolvedValue({
        id: 1,
        name: 'Gaseosa',
        type: 'critical_supply',
      } as any);

      await expect(getRecipeByProductId(1)).rejects.toThrow(NotFoundError);
      await expect(getRecipeByProductId(1)).rejects.toThrow(
        'Producto compuesto con ID 1 no encontrado.'
      );
    });

    test('lanza NotFoundError si el producto no existe', async () => {
      mockedProductRepository.findById.mockResolvedValue(null);

      await expect(getRecipeByProductId(999)).rejects.toThrow(NotFoundError);
    });
  });

  describe('saveRecipe', () => {
    test('guarda una receta válida con insumo crítico con auto descuento', async () => {
      mockedProductRepository.findById.mockResolvedValue({
        id: 1,
        name: 'Panchuque',
        type: 'compound',
      } as any);

      mockedProductRepository.findByIds.mockResolvedValue([
        { id: 2, name: 'Pan', type: 'critical_supply', deletedAt: null },
      ] as any);

      const returning = [
        {
          id: 10,
          compoundProductId: 1,
          supplyId: 2,
          quantity: 1,
          autoDiscount: true,
        },
      ];
      mockTx.insertReturning.mockResolvedValue(returning);

      const items = [{ supplyId: 2, quantity: 1, autoDiscount: true }];
      const result = await saveRecipe(1, items as any);

      expect(result).toEqual(returning);
      expect(mockTx.deleteWhere).toHaveBeenCalled();
      expect(mockTx.insertValues).toHaveBeenCalledWith([
        { compoundProductId: 1, supplyId: 2, quantity: 1, autoDiscount: true },
      ]);
    });

    test('rechaza una receta sin insumos críticos con auto descuento', async () => {
      mockedProductRepository.findById.mockResolvedValue({
        id: 1,
        name: 'Panchuque',
        type: 'compound',
      } as any);

      const items = [{ supplyId: 2, quantity: 1, autoDiscount: false }];

      await expect(saveRecipe(1, items as any)).rejects.toThrow(
        ValidationError
      );
      await expect(saveRecipe(1, items as any)).rejects.toThrow(
        'La receta debe incluir al menos un insumo crítico con descuento automático.'
      );
      expect(mockedProductRepository.findByIds).not.toHaveBeenCalled();
    });

    test('rechaza insumos duplicados', async () => {
      mockedProductRepository.findById.mockResolvedValue({
        id: 1,
        name: 'Panchuque',
        type: 'compound',
      } as any);

      const items = [
        { supplyId: 2, quantity: 1, autoDiscount: true },
        { supplyId: 2, quantity: 2, autoDiscount: false },
      ];

      await expect(saveRecipe(1, items as any)).rejects.toThrow(
        ValidationError
      );
      await expect(saveRecipe(1, items as any)).rejects.toThrow(
        'No puede haber insumos duplicados en la receta.'
      );
      expect(mockedProductRepository.findByIds).not.toHaveBeenCalled();
    });

    test('rechaza la autoreferencia del producto compuesto', async () => {
      mockedProductRepository.findById.mockResolvedValue({
        id: 1,
        name: 'Panchuque',
        type: 'compound',
      } as any);

      const items = [{ supplyId: 1, quantity: 1, autoDiscount: true }];

      await expect(saveRecipe(1, items as any)).rejects.toThrow(
        ValidationError
      );
      await expect(saveRecipe(1, items as any)).rejects.toThrow(
        'Una receta no puede incluir al propio producto compuesto como insumo.'
      );
    });

    test('rechaza un insumo no crítico con auto descuento', async () => {
      mockedProductRepository.findById.mockResolvedValue({
        id: 1,
        name: 'Panchuque',
        type: 'compound',
      } as any);

      mockedProductRepository.findByIds.mockResolvedValue([
        {
          id: 2,
          name: 'Salsa',
          type: 'manual_supply',
          deletedAt: null,
        },
      ] as any);

      const items = [{ supplyId: 2, quantity: 1, autoDiscount: true }];

      await expect(saveRecipe(1, items as any)).rejects.toThrow(
        ValidationError
      );
      await expect(saveRecipe(1, items as any)).rejects.toThrow(
        'El insumo Salsa no es crítico y no puede tener descuento automático.'
      );
    });

    test('rechaza un insumo eliminado con auto descuento', async () => {
      mockedProductRepository.findById.mockResolvedValue({
        id: 1,
        name: 'Panchuque',
        type: 'compound',
      } as any);

      mockedProductRepository.findByIds.mockResolvedValue([
        {
          id: 2,
          name: 'Pan viejo',
          type: 'critical_supply',
          deletedAt: new Date(),
        },
      ] as any);

      const items = [{ supplyId: 2, quantity: 1, autoDiscount: true }];

      await expect(saveRecipe(1, items as any)).rejects.toThrow(
        ValidationError
      );
      await expect(saveRecipe(1, items as any)).rejects.toThrow(
        'El insumo Pan viejo está eliminado y no puede usarse en recetas.'
      );
    });

    test('rechaza un insumo inexistente', async () => {
      mockedProductRepository.findById.mockResolvedValue({
        id: 1,
        name: 'Panchuque',
        type: 'compound',
      } as any);

      mockedProductRepository.findByIds.mockResolvedValue([
        { id: 2, name: 'Pan', type: 'critical_supply', deletedAt: null },
      ] as any);

      const items = [
        { supplyId: 2, quantity: 1, autoDiscount: true },
        { supplyId: 99, quantity: 1, autoDiscount: false },
      ];

      await expect(saveRecipe(1, items as any)).rejects.toThrow(
        ValidationError
      );
      await expect(saveRecipe(1, items as any)).rejects.toThrow(
        'Uno o más insumos de la receta no existen.'
      );
    });

    test('rechaza guardar la receta si el producto no es compuesto', async () => {
      mockedProductRepository.findById.mockResolvedValue({
        id: 1,
        name: 'Gaseosa',
        type: 'critical_supply',
      } as any);

      const items = [{ supplyId: 2, quantity: 1, autoDiscount: true }];

      await expect(saveRecipe(1, items as any)).rejects.toThrow(
        ValidationError
      );
      await expect(saveRecipe(1, items as any)).rejects.toThrow(
        'El producto debe ser de tipo compuesto.'
      );
    });
  });
});
