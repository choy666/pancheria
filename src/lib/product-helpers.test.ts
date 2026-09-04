import {
  buildProductContext,
  validateProductsForOperation,
  validateCartAvailability,
} from './product-helpers';
import type { ProductRow, SaleItemInput } from '@/domain/types';
import type { RecipeWithSupply } from '@/application/services/summaryService';

var mockFindByIds: jest.Mock;
var mockFindRecipesForProducts: jest.Mock;
var mockGroupRecipesByProduct: jest.Mock;

jest.mock('@/repositories/productRepository', () => {
  mockFindByIds = jest.fn();
  return { findByIds: mockFindByIds };
});

jest.mock('@/application/services/summaryService', () => {
  mockFindRecipesForProducts = jest.fn();
  mockGroupRecipesByProduct = jest.fn();
  return {
    findRecipesForProducts: mockFindRecipesForProducts,
    groupRecipesByProduct: mockGroupRecipesByProduct,
  };
});

const BRANCH_ID = 1;

describe('product-helpers', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('buildProductContext', () => {
    it('devuelve productos, mapa y recetas vacias si no hay compuestos', async () => {
      const products: ProductRow[] = [
        {
          id: 1,
          branchId: BRANCH_ID,
          name: 'Coca',
          type: 'critical_supply',
          criticalSupplyType: 'beverage',
          price: 1000,
          stock: 10,
          minStock: 1,
          isActive: true,
          unit: 'unidad',
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ] as ProductRow[];

      mockFindByIds.mockResolvedValue(products);

      const result = await buildProductContext(BRANCH_ID, [1]);

      expect(result.productsList).toEqual(products);
      expect(result.productById.get(1)).toEqual(products[0]);
      expect(result.recipesByProduct.size).toBe(0);
    });

    it('lanza NotFoundError si falta algun producto', async () => {
      mockFindByIds.mockResolvedValue([]);

      await expect(buildProductContext(BRANCH_ID, [1])).rejects.toThrow('Producto');
    });
  });

  describe('validateProductsForOperation', () => {
    it('no lanza error si los productos son validos', () => {
      const product = {
        id: 1,
        branchId: BRANCH_ID,
        name: 'Coca',
        type: 'critical_supply',
        criticalSupplyType: 'beverage',
        price: 1000,
        stock: 10,
        minStock: 1,
        isActive: true,
        unit: 'unidad',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      } as ProductRow;

      const productById = new Map([[1, product]]);

      expect(() =>
        validateProductsForOperation(
          [{ productId: 1 }],
          productById,
          BRANCH_ID,
          'venta'
        )
      ).not.toThrow();
    });

    it('lanza error si el producto no existe', () => {
      expect(() =>
        validateProductsForOperation([{ productId: 99 }], new Map(), BRANCH_ID, 'venta')
      ).toThrow('Producto');
    });

    it('lanza error si el producto no esta activo', () => {
      const product = {
        id: 1,
        branchId: BRANCH_ID,
        name: 'Coca',
        type: 'critical_supply',
        criticalSupplyType: 'beverage',
        price: 1000,
        stock: 10,
        minStock: 1,
        isActive: false,
        unit: 'unidad',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      } as ProductRow;

      const productById = new Map([[1, product]]);

      expect(() =>
        validateProductsForOperation([{ productId: 1 }], productById, BRANCH_ID, 'venta')
      ).toThrow('no está activo');
    });
  });

  describe('validateCartAvailability', () => {
    it('separa dos entradas del mismo producto con selecciones distintas', async () => {
      const compoundProduct: ProductRow = {
        id: 10,
        branchId: BRANCH_ID,
        name: 'Panchito completo',
        type: 'compound',
        criticalSupplyType: null,
        price: 2500,
        stock: 0,
        minStock: 0,
        isActive: true,
        unit: 'unidad',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      } as ProductRow;

      const supplyProduct: ProductRow = {
        id: 20,
        branchId: BRANCH_ID,
        name: 'Cebolla',
        type: 'critical_supply',
        criticalSupplyType: 'beverage',
        price: 0,
        stock: 5,
        minStock: 0,
        isActive: true,
        unit: 'unidad',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      } as ProductRow;

      mockFindByIds.mockResolvedValue([compoundProduct]);

      const recipeItem: RecipeWithSupply = {
        id: 1,
        compoundProductId: 10,
        supplyId: 20,
        quantity: 1,
        autoDiscount: true,
        isOptional: true,
        selectedByDefault: false,
        createdAt: new Date(),
        supply: supplyProduct,
      } as unknown as RecipeWithSupply;

      mockFindRecipesForProducts.mockResolvedValue([recipeItem]);
      mockGroupRecipesByProduct.mockReturnValue(
        new Map<number, RecipeWithSupply[]>([[10, [recipeItem]]])
      );

      const items: SaleItemInput[] = [
        {
          productId: 10,
          quantity: 2,
          selectedRecipeItemIds: [20],
        },
        {
          productId: 10,
          quantity: 1,
          selectedRecipeItemIds: [],
        },
      ];

      const result = await validateCartAvailability(BRANCH_ID, items);

      // Solo la primera línea consume cebolla.
      expect(result.consumedBySupply[20]).toBe(2);

      // Disponibilidad del compuesto con stock 5 menos 2 consumidos.
      expect(result.availabilityByProduct[10]).toBe(3);

      // No hay faltante porque alcanza para las variantes seleccionadas.
      expect(result.shortageByProduct[10]).toBeUndefined();
    });

    it('detecta faltante cuando las selecciones agotan el stock', async () => {
      const compoundProduct: ProductRow = {
        id: 10,
        branchId: BRANCH_ID,
        name: 'Panchito completo',
        type: 'compound',
        criticalSupplyType: null,
        price: 2500,
        stock: 0,
        minStock: 0,
        isActive: true,
        unit: 'unidad',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      } as ProductRow;

      const supplyProduct: ProductRow = {
        id: 20,
        branchId: BRANCH_ID,
        name: 'Cebolla',
        type: 'critical_supply',
        criticalSupplyType: 'beverage',
        price: 0,
        stock: 1,
        minStock: 0,
        isActive: true,
        unit: 'unidad',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      } as ProductRow;

      mockFindByIds.mockResolvedValue([compoundProduct]);

      const recipeItem: RecipeWithSupply = {
        id: 1,
        compoundProductId: 10,
        supplyId: 20,
        quantity: 1,
        autoDiscount: true,
        isOptional: true,
        selectedByDefault: false,
        createdAt: new Date(),
        supply: supplyProduct,
      } as unknown as RecipeWithSupply;

      mockFindRecipesForProducts.mockResolvedValue([recipeItem]);
      mockGroupRecipesByProduct.mockReturnValue(
        new Map<number, RecipeWithSupply[]>([[10, [recipeItem]]])
      );

      const items: SaleItemInput[] = [
        {
          productId: 10,
          quantity: 2,
          selectedRecipeItemIds: [20],
        },
        {
          productId: 10,
          quantity: 1,
          selectedRecipeItemIds: [20],
        },
      ];

      const result = await validateCartAvailability(BRANCH_ID, items);

      // Ambas líneas consumen cebolla: 2 + 1.
      expect(result.consumedBySupply[20]).toBe(3);

      // La disponibilidad es negativa porque se requieren 3 y hay 1.
      expect(result.availabilityByProduct[10]).toBe(-2);

      // El faltante refleja el insumo crítico agotado.
      expect(result.shortageByProduct[10]).toEqual({
        available: 1,
        required: 3,
        supplyName: 'Cebolla',
      });
    });
  });
});
