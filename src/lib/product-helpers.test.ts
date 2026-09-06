import {
  buildProductContext,
  validateProductsForOperation,
  validateCartAvailability,
  collectCartProductIds,
  groupRecipeSnapshotsByProduct,
  collectAvailabilityLockIds,
  applyReservationsToStock,
  calculateConsumedBySupply,
  calculateAvailabilityByProduct,
  calculateBreakdownByProduct,
  calculateShortageByProduct,
} from './product-helpers';
import type { ProductRow, SaleItemInput, RecipeItemConfig } from '@/domain/types';
import type { RecipeWithSupply } from '@/lib/recipe-helpers';

var mockFindByIds: jest.Mock;
var mockFindRecipesForProducts: jest.Mock;
var mockGroupRecipesByProduct: jest.Mock;

jest.mock('@/repositories/productRepository', () => {
  mockFindByIds = jest.fn();
  return { findByIds: mockFindByIds };
});

jest.mock('@/lib/recipe-helpers', () => {
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

  describe('funciones puras de disponibilidad del carrito', () => {
    const makeProduct = (overrides: Partial<ProductRow> = {}): ProductRow =>
      ({
        id: 1,
        branchId: BRANCH_ID,
        name: 'Producto',
        type: 'critical_supply',
        criticalSupplyType: 'beverage',
        price: 0,
        stock: 0,
        minStock: 0,
        isActive: true,
        unit: 'unidad',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        ...overrides,
      }) as ProductRow;

    const makeRecipe = (
      overrides: Partial<RecipeWithSupply> = {}
    ): RecipeWithSupply =>
      ({
        id: 1,
        compoundProductId: 10,
        supplyId: 20,
        quantity: 1,
        autoDiscount: true,
        isOptional: false,
        selectedByDefault: false,
        createdAt: new Date(),
        ...overrides,
      }) as unknown as RecipeWithSupply;

    const makeSnapshotItem = (
      overrides: Partial<RecipeItemConfig> = {}
    ): RecipeItemConfig => ({
      supplyId: 30,
      supplyName: 'Insumo',
      supplyType: 'manual_supply',
      quantity: 1,
      autoDiscount: true,
      isOptional: false,
      selected: true,
      selectedByDefault: false,
      ...overrides,
    });

    describe('collectCartProductIds', () => {
      it('une ids de items, extras y snapshots sin duplicados', () => {
        const items: SaleItemInput[] = [
          { productId: 1, quantity: 1 },
          {
            productId: 2,
            quantity: 1,
            recipeSnapshot: [makeSnapshotItem({ supplyId: 30 })],
          },
          { productId: 1, quantity: 2 },
        ];

        const result = collectCartProductIds(items, [2, 5]);

        expect(result.sort((a, b) => a - b)).toEqual([1, 2, 5, 30]);
      });

      it('ignora insumos de snapshots sin autoDiscount', () => {
        const items: SaleItemInput[] = [
          {
            productId: 1,
            quantity: 1,
            recipeSnapshot: [makeSnapshotItem({ supplyId: 30, autoDiscount: false })],
          },
        ];

        expect(collectCartProductIds(items)).toEqual([1]);
      });
    });

    describe('groupRecipeSnapshotsByProduct', () => {
      it('agrupa snapshots por producto y saltea items sin snapshot', () => {
        const snapshotA = makeSnapshotItem({ supplyId: 30 });
        const snapshotB = makeSnapshotItem({ supplyId: 31 });
        const items: SaleItemInput[] = [
          { productId: 1, quantity: 1, recipeSnapshot: [snapshotA] },
          { productId: 2, quantity: 1 },
          { productId: 1, quantity: 1, recipeSnapshot: [snapshotB] },
          { productId: 3, quantity: 1, recipeSnapshot: [] },
        ];

        const result = groupRecipeSnapshotsByProduct(items);

        expect(result.get(1)).toEqual([snapshotA, snapshotB]);
        expect(result.has(2)).toBe(false);
        expect(result.has(3)).toBe(false);
      });
    });

    describe('collectAvailabilityLockIds', () => {
      it('incluye insumos autoDiscount de compuestos y bebidas consideradas', () => {
        const bebida = makeProduct({ id: 1 });
        const compuesto = makeProduct({
          id: 2,
          type: 'compound',
          criticalSupplyType: null,
        });
        const servicio = makeProduct({
          id: 3,
          type: 'service',
          criticalSupplyType: null,
        });
        const productById = new Map<number, ProductRow>([
          [1, bebida],
          [2, compuesto],
          [3, servicio],
        ]);
        const recipe = makeRecipe({
          compoundProductId: 2,
          supplyId: 20,
          autoDiscount: true,
        });
        const recipesByProduct = new Map<number, RecipeWithSupply[]>([
          [2, [recipe]],
        ]);

        const items: SaleItemInput[] = [{ productId: 1, quantity: 1 }];

        const result = collectAvailabilityLockIds(
          items,
          [1, 2, 3],
          productById,
          recipesByProduct
        );

        expect(result.sort((a, b) => a - b)).toEqual([1, 20]);
      });
    });

    describe('applyReservationsToStock', () => {
      it('descuenta solo los insumos presentes en el stock', () => {
        const stock: Record<number, number> = { 1: 10 };

        applyReservationsToStock(stock, [
          { productId: 1, quantity: 3 },
          { productId: 99, quantity: 5 },
        ]);

        expect(stock[1]).toBe(7);
        expect(stock[99]).toBeUndefined();
      });
    });

    describe('calculateConsumedBySupply', () => {
      it('suma unidades de bebidas e insumos seleccionados de compuestos', () => {
        const bebida = makeProduct({ id: 1 });
        const compuesto = makeProduct({
          id: 2,
          type: 'compound',
          criticalSupplyType: null,
        });
        const productById = new Map<number, ProductRow>([
          [1, bebida],
          [2, compuesto],
        ]);
        const recipe = makeRecipe({
          compoundProductId: 2,
          supplyId: 20,
          quantity: 2,
          autoDiscount: true,
          isOptional: true,
        });
        const recipesByProduct = new Map<number, RecipeWithSupply[]>([
          [2, [recipe]],
        ]);

        const items: SaleItemInput[] = [
          { productId: 1, quantity: 2 },
          { productId: 2, quantity: 3, selectedRecipeItemIds: [20] },
        ];

        const result = calculateConsumedBySupply(
          items,
          productById,
          recipesByProduct
        );

        expect(result[1]).toBe(2);
        expect(result[20]).toBe(6);
      });

      it('no consume insumos opcionales no seleccionados', () => {
        const compuesto = makeProduct({
          id: 2,
          type: 'compound',
          criticalSupplyType: null,
        });
        const productById = new Map<number, ProductRow>([[2, compuesto]]);
        const recipe = makeRecipe({
          compoundProductId: 2,
          supplyId: 20,
          quantity: 2,
          autoDiscount: true,
          isOptional: true,
        });
        const recipesByProduct = new Map<number, RecipeWithSupply[]>([
          [2, [recipe]],
        ]);

        const items: SaleItemInput[] = [
          { productId: 2, quantity: 3, selectedRecipeItemIds: [] },
        ];

        const result = calculateConsumedBySupply(
          items,
          productById,
          recipesByProduct
        );

        expect(result[20]).toBeUndefined();
      });
    });

    describe('calculateAvailabilityByProduct', () => {
      it('resuelve servicios, bebidas, compuestos y productos inexistentes', () => {
        const bebida = makeProduct({ id: 1 });
        const compuesto = makeProduct({
          id: 2,
          type: 'compound',
          criticalSupplyType: null,
        });
        const servicio = makeProduct({
          id: 3,
          type: 'service',
          criticalSupplyType: null,
        });
        const manual = makeProduct({
          id: 4,
          type: 'manual_supply',
          criticalSupplyType: null,
        });
        const productById = new Map<number, ProductRow>([
          [1, bebida],
          [2, compuesto],
          [3, servicio],
          [4, manual],
        ]);
        const recipe = makeRecipe({
          compoundProductId: 2,
          supplyId: 20,
          quantity: 2,
          autoDiscount: true,
        });
        const recipesByProduct = new Map<number, RecipeWithSupply[]>([
          [2, [recipe]],
        ]);
        const supplyStockById = { 1: 10, 20: 7 };
        const consumedBySupply = { 1: 3, 20: 2 };

        const result = calculateAvailabilityByProduct(
          [1, 2, 3, 4, 99],
          productById,
          recipesByProduct,
          supplyStockById,
          consumedBySupply
        );

        expect(result[1]).toBe(7); // 10 - 3
        expect(result[2]).toBe(2); // floor((7 - 2) / 2)
        expect(result[3]).toBe(Number.MAX_SAFE_INTEGER);
        expect(result[4]).toBe(0);
        expect(result[99]).toBe(0);
      });
    });

    describe('calculateBreakdownByProduct', () => {
      it('marca el insumo limitante de un compuesto', () => {
        const compuesto = makeProduct({
          id: 2,
          type: 'compound',
          criticalSupplyType: null,
        });
        const recipesByProduct = new Map<number, RecipeWithSupply[]>([
          [
            2,
            [
              makeRecipe({ id: 1, compoundProductId: 2, supplyId: 20, quantity: 1 }),
              makeRecipe({ id: 2, compoundProductId: 2, supplyId: 21, quantity: 2 }),
            ],
          ],
        ]);
        const supplyStockById = { 20: 10, 21: 4 };
        const supplyNameById = { 20: 'Pan', 21: 'Salchicha' };

        const result = calculateBreakdownByProduct(
          [compuesto],
          recipesByProduct,
          supplyStockById,
          supplyNameById,
          {}
        );

        expect(result[2]).toHaveLength(2);
        const salchicha = result[2].find((i) => i.supplyName === 'Salchicha');
        const pan = result[2].find((i) => i.supplyName === 'Pan');
        expect(salchicha?.isLimiting).toBe(true); // floor(4/2) = 2 < 10
        expect(pan?.isLimiting).toBe(false);
      });
    });

    describe('calculateShortageByProduct', () => {
      it('detecta faltante de bebida cuando el consumo supera el stock', () => {
        const bebida = makeProduct({ id: 1, name: 'Coca' });
        const productById = new Map<number, ProductRow>([[1, bebida]]);
        const items: SaleItemInput[] = [{ productId: 1, quantity: 5 }];

        const result = calculateShortageByProduct(
          items,
          productById,
          new Map(),
          { 1: 2 },
          { 1: 'Coca' },
          { 1: 5 }
        );

        expect(result[1]).toEqual({
          available: 2,
          required: 5,
          supplyName: 'Coca',
        });
      });

      it('detecta el bottleneck de un compuesto con capacidad negativa', () => {
        const compuesto = makeProduct({
          id: 2,
          type: 'compound',
          criticalSupplyType: null,
        });
        const productById = new Map<number, ProductRow>([[2, compuesto]]);
        const recipe = makeRecipe({
          compoundProductId: 2,
          supplyId: 20,
          quantity: 1,
          autoDiscount: true,
        });
        const recipesByProduct = new Map<number, RecipeWithSupply[]>([
          [2, [recipe]],
        ]);
        const items: SaleItemInput[] = [{ productId: 2, quantity: 3 }];

        const result = calculateShortageByProduct(
          items,
          productById,
          recipesByProduct,
          { 20: 1 },
          { 20: 'Cebolla' },
          { 20: 3 }
        );

        expect(result[2]).toEqual({
          available: 1,
          required: 3,
          supplyName: 'Cebolla',
        });
      });

      it('no marca faltante cuando el stock alcanza', () => {
        const bebida = makeProduct({ id: 1 });
        const productById = new Map<number, ProductRow>([[1, bebida]]);
        const items: SaleItemInput[] = [{ productId: 1, quantity: 2 }];

        const result = calculateShortageByProduct(
          items,
          productById,
          new Map(),
          { 1: 5 },
          { 1: 'Coca' },
          { 1: 2 }
        );

        expect(result[1]).toBeUndefined();
      });
    });
  });
});
