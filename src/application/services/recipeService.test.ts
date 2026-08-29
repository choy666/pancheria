import { getRecipeByProductId, saveRecipe } from './recipeService';
import * as productRepository from '@/repositories/productRepository';
import * as recipeRepository from '@/repositories/recipeRepository';
import { RecipeItemInsert } from '@/repositories/recipeRepository';
import { db } from '@/db';
import { recipes } from '@/db/schema';
import { NotFoundError, ValidationError } from '@/domain/errors';
import { ProductRow } from '@/domain/types';

type DbTransaction = (callback: (tx: typeof db) => Promise<unknown>) => Promise<unknown>;

type RecipeRow = typeof recipes.$inferSelect;
type RecipeWithSupply = RecipeRow & { supply: ProductRow };

interface MockTx {
  insert: jest.Mock;
  delete: jest.Mock;
  insertValues: jest.Mock;
  insertReturning: jest.Mock;
  deleteWhere: jest.Mock;
}

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
const mockedDb = db as unknown as { transaction: jest.MockedFunction<DbTransaction> };

const BRANCH_ID = 1;

function createProductRow(overrides: Partial<ProductRow> = {}): ProductRow {
  return {
    id: 1,
    branchId: BRANCH_ID,
    name: 'Producto',
    description: null,
    type: 'critical_supply',
    criticalSupplyType: null,
    price: 0,
    unit: 'unidad',
    stock: 0,
    minStock: 0,
    isActive: true,
    imageUrl: null,
    imageKey: null,
    imageMimeType: null,
    imageSize: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function createRecipeRow(overrides: Partial<RecipeRow> = {}): RecipeRow {
  return {
    id: 1,
    compoundProductId: 1,
    supplyId: 2,
    quantity: 1,
    autoDiscount: true,
    isOptional: false,
    selectedByDefault: false,
    createdAt: new Date(),
    ...overrides,
  };
}

function createRecipeWithSupply(
  overrides: Partial<RecipeRow> & { supply?: Partial<ProductRow> } = {}
): RecipeWithSupply {
  const { supply: supplyOverrides, ...rest } = overrides;
  const supply = supplyOverrides
    ? createProductRow(supplyOverrides)
    : createProductRow();
  return { ...createRecipeRow(), ...rest, supply };
}

function createMockTransaction(): MockTx {
  const insertReturning = jest.fn().mockResolvedValue([]);
  const insertValues = jest
    .fn()
    .mockReturnValue({ returning: insertReturning });
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
  let mockTx: MockTx;

  beforeEach(() => {
    mockTx = createMockTransaction();
    mockedDb.transaction.mockImplementation(async (callback) => {
      return await callback(mockTx as unknown as typeof db);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getRecipeByProductId', () => {
    test('devuelve la receta de un producto compuesto', async () => {
      mockedProductRepository.findById.mockResolvedValue(
        createProductRow({
          id: 1,
          name: 'Panchuque',
          type: 'compound',
        })
      );

      const expectedRecipe: RecipeWithSupply[] = [
        createRecipeWithSupply({
          id: 1,
          compoundProductId: 1,
          supplyId: 2,
          quantity: 1,
          autoDiscount: true,
          supply: { id: 2, name: 'Pan' },
        }),
      ];
      mockedRecipeRepository.findByCompoundProductId.mockResolvedValue(
        expectedRecipe as unknown as Awaited<
          ReturnType<typeof recipeRepository.findByCompoundProductId>
        >
      );

      const result = await getRecipeByProductId(BRANCH_ID, 1);

      expect(result).toBe(expectedRecipe);
      expect(mockedProductRepository.findById).toHaveBeenCalledWith(BRANCH_ID, 1);
      expect(mockedRecipeRepository.findByCompoundProductId).toHaveBeenCalledWith(
        BRANCH_ID,
        1
      );
    });

    test('lanza NotFoundError si el producto no es compuesto', async () => {
      mockedProductRepository.findById.mockResolvedValue(
        createProductRow({
          id: 1,
          name: 'Gaseosa',
          type: 'critical_supply',
          criticalSupplyType: 'beverage',
        })
      );

      await expect(getRecipeByProductId(BRANCH_ID, 1)).rejects.toThrow(NotFoundError);
      await expect(getRecipeByProductId(BRANCH_ID, 1)).rejects.toThrow(
        'Producto compuesto con ID 1 no encontrado.'
      );
    });

    test('lanza NotFoundError si el producto no existe', async () => {
      mockedProductRepository.findById.mockResolvedValue(null);

      await expect(getRecipeByProductId(BRANCH_ID, 999)).rejects.toThrow(NotFoundError);
    });
  });

  describe('saveRecipe', () => {
    test('guarda una receta válida con insumo crítico con auto descuento', async () => {
      mockedProductRepository.findById.mockResolvedValue(
        createProductRow({
          id: 1,
          name: 'Panchuque',
          type: 'compound',
        })
      );

      mockedProductRepository.findByIds.mockResolvedValue([
        createProductRow({ id: 2, name: 'Pan', type: 'critical_supply' }),
      ]);

      const returning: RecipeRow[] = [
        createRecipeRow({
          id: 10,
          compoundProductId: 1,
          supplyId: 2,
          quantity: 1,
          autoDiscount: true,
        }),
      ];
      mockTx.insertReturning.mockResolvedValue(returning);

      const items: RecipeItemInsert[] = [
        { supplyId: 2, quantity: 1, autoDiscount: true },
      ];
      const result = await saveRecipe(BRANCH_ID, 1, items);

      expect(result).toEqual(returning);
      expect(mockTx.deleteWhere).toHaveBeenCalled();
      expect(mockTx.insertValues).toHaveBeenCalledWith([
        { compoundProductId: 1, supplyId: 2, quantity: 1, autoDiscount: true, isOptional: false, selectedByDefault: false },
      ]);
    });

    test('rechaza una receta sin insumos críticos con auto descuento', async () => {
      mockedProductRepository.findById.mockResolvedValue(
        createProductRow({
          id: 1,
          name: 'Panchuque',
          type: 'compound',
        })
      );

      const items: RecipeItemInsert[] = [
        { supplyId: 2, quantity: 1, autoDiscount: false },
      ];

      await expect(saveRecipe(BRANCH_ID, 1, items)).rejects.toThrow(ValidationError);
      await expect(saveRecipe(BRANCH_ID, 1, items)).rejects.toThrow(
        'La receta debe incluir al menos un insumo crítico con descuento automático.'
      );
      expect(mockedProductRepository.findByIds).not.toHaveBeenCalled();
    });

    test('rechaza insumos duplicados', async () => {
      mockedProductRepository.findById.mockResolvedValue(
        createProductRow({
          id: 1,
          name: 'Panchuque',
          type: 'compound',
        })
      );

      const items: RecipeItemInsert[] = [
        { supplyId: 2, quantity: 1, autoDiscount: true },
        { supplyId: 2, quantity: 2, autoDiscount: false },
      ];

      await expect(saveRecipe(BRANCH_ID, 1, items)).rejects.toThrow(ValidationError);
      await expect(saveRecipe(BRANCH_ID, 1, items)).rejects.toThrow(
        'No puede haber insumos duplicados en la receta.'
      );
      expect(mockedProductRepository.findByIds).not.toHaveBeenCalled();
    });

    test('rechaza la autoreferencia del producto compuesto', async () => {
      mockedProductRepository.findById.mockResolvedValue(
        createProductRow({
          id: 1,
          name: 'Panchuque',
          type: 'compound',
        })
      );

      const items: RecipeItemInsert[] = [
        { supplyId: 1, quantity: 1, autoDiscount: true },
      ];

      await expect(saveRecipe(BRANCH_ID, 1, items)).rejects.toThrow(ValidationError);
      await expect(saveRecipe(BRANCH_ID, 1, items)).rejects.toThrow(
        'Una receta no puede incluir al propio producto compuesto como insumo.'
      );
    });

    test('rechaza un insumo no crítico con auto descuento', async () => {
      mockedProductRepository.findById.mockResolvedValue(
        createProductRow({
          id: 1,
          name: 'Panchuque',
          type: 'compound',
        })
      );

      mockedProductRepository.findByIds.mockResolvedValue([
        createProductRow({
          id: 2,
          name: 'Salsa',
          type: 'manual_supply',
        }),
      ]);

      const items: RecipeItemInsert[] = [
        { supplyId: 2, quantity: 1, autoDiscount: true },
      ];

      await expect(saveRecipe(BRANCH_ID, 1, items)).rejects.toThrow(ValidationError);
      await expect(saveRecipe(BRANCH_ID, 1, items)).rejects.toThrow(
        'El insumo Salsa no es crítico y no puede tener descuento automático.'
      );
    });

    test('rechaza un insumo eliminado con auto descuento', async () => {
      mockedProductRepository.findById.mockResolvedValue(
        createProductRow({
          id: 1,
          name: 'Panchuque',
          type: 'compound',
        })
      );

      mockedProductRepository.findByIds.mockResolvedValue([
        createProductRow({
          id: 2,
          name: 'Pan viejo',
          type: 'critical_supply',
          deletedAt: new Date(),
        }),
      ]);

      const items: RecipeItemInsert[] = [
        { supplyId: 2, quantity: 1, autoDiscount: true },
      ];

      await expect(saveRecipe(BRANCH_ID, 1, items)).rejects.toThrow(ValidationError);
      await expect(saveRecipe(BRANCH_ID, 1, items)).rejects.toThrow(
        'El insumo Pan viejo está eliminado y no puede usarse en recetas.'
      );
    });

    test('rechaza un insumo inexistente', async () => {
      mockedProductRepository.findById.mockResolvedValue(
        createProductRow({
          id: 1,
          name: 'Panchuque',
          type: 'compound',
        })
      );

      mockedProductRepository.findByIds.mockResolvedValue([
        createProductRow({ id: 2, name: 'Pan', type: 'critical_supply' }),
      ]);

      const items: RecipeItemInsert[] = [
        { supplyId: 2, quantity: 1, autoDiscount: true },
        { supplyId: 99, quantity: 1, autoDiscount: false },
      ];

      await expect(saveRecipe(BRANCH_ID, 1, items)).rejects.toThrow(ValidationError);
      await expect(saveRecipe(BRANCH_ID, 1, items)).rejects.toThrow(
        'Uno o más insumos de la receta no existen.'
      );
    });

    test('rechaza guardar la receta si el producto no es compuesto', async () => {
      mockedProductRepository.findById.mockResolvedValue(
        createProductRow({
          id: 1,
          name: 'Gaseosa',
          type: 'critical_supply',
          criticalSupplyType: 'beverage',
        })
      );

      const items: RecipeItemInsert[] = [
        { supplyId: 2, quantity: 1, autoDiscount: true },
      ];

      await expect(saveRecipe(BRANCH_ID, 1, items)).rejects.toThrow(ValidationError);
      await expect(saveRecipe(BRANCH_ID, 1, items)).rejects.toThrow(
        'El producto debe ser de tipo compuesto.'
      );
    });

    test('permite insumos manuales y servicios sin descuento automático', async () => {
      mockedProductRepository.findById.mockResolvedValue(
        createProductRow({
          id: 1,
          name: 'Panchuque',
          type: 'compound',
        })
      );

      mockedProductRepository.findByIds.mockResolvedValue([
        createProductRow({ id: 2, name: 'Pan', type: 'critical_supply' }),
        createProductRow({
          id: 3,
          name: 'Ketchup',
          type: 'manual_supply',
        }),
        createProductRow({
          id: 4,
          name: 'Envío',
          type: 'service',
        }),
      ]);

      mockTx.insertReturning.mockResolvedValue([]);

      const items: RecipeItemInsert[] = [
        { supplyId: 2, quantity: 1, autoDiscount: true },
        { supplyId: 3, quantity: 1, autoDiscount: false },
        { supplyId: 4, quantity: 1, autoDiscount: false },
      ];

      const result = await saveRecipe(BRANCH_ID, 1, items);
      expect(result).toEqual([]);
      expect(mockTx.insertValues).toHaveBeenCalledWith([
        { compoundProductId: 1, supplyId: 2, quantity: 1, autoDiscount: true, isOptional: false, selectedByDefault: false },
        { compoundProductId: 1, supplyId: 3, quantity: 1, autoDiscount: false, isOptional: true, selectedByDefault: false },
        { compoundProductId: 1, supplyId: 4, quantity: 1, autoDiscount: false, isOptional: true, selectedByDefault: false },
      ]);
    });

    test('permite varios insumos críticos con descuento automático', async () => {
      mockedProductRepository.findById.mockResolvedValue(
        createProductRow({
          id: 1,
          name: 'Panchuque',
          type: 'compound',
        })
      );

      mockedProductRepository.findByIds.mockResolvedValue([
        createProductRow({ id: 2, name: 'Pan', type: 'critical_supply' }),
        createProductRow({
          id: 3,
          name: 'Salchicha',
          type: 'critical_supply',
          criticalSupplyType: 'sausage',
        }),
      ]);

      mockTx.insertReturning.mockResolvedValue([]);

      const items: RecipeItemInsert[] = [
        { supplyId: 2, quantity: 1, autoDiscount: true },
        { supplyId: 3, quantity: 2, autoDiscount: true },
      ];

      const result = await saveRecipe(BRANCH_ID, 1, items);
      expect(result).toEqual([]);
      expect(mockTx.insertValues).toHaveBeenCalledWith([
        { compoundProductId: 1, supplyId: 2, quantity: 1, autoDiscount: true, isOptional: false, selectedByDefault: false },
        { compoundProductId: 1, supplyId: 3, quantity: 2, autoDiscount: true, isOptional: false, selectedByDefault: false },
      ]);
    });
  });
});
