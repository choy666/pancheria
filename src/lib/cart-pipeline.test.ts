import { prepareCart } from './cart-pipeline';
import type { ProductRow } from '@/domain/types';
import type { RecipeWithSupply } from '@/lib/recipe-helpers';

var mockFindByIds: jest.Mock;
var mockFindByIdsForUpdate: jest.Mock;
var mockFindRecipesForProducts: jest.Mock;
var mockGroupRecipesByProduct: jest.Mock;
var mockFindActiveReservationsByProductIds: jest.Mock;

jest.mock('@/repositories/productRepository', () => {
  mockFindByIds = jest.fn();
  mockFindByIdsForUpdate = jest.fn();
  return { findByIds: mockFindByIds, findByIdsForUpdate: mockFindByIdsForUpdate };
});

jest.mock('@/lib/recipe-helpers', () => {
  mockFindRecipesForProducts = jest.fn();
  mockGroupRecipesByProduct = jest.fn();
  return {
    findRecipesForProducts: mockFindRecipesForProducts,
    groupRecipesByProduct: mockGroupRecipesByProduct,
  };
});

jest.mock('@/repositories/orderStockReservationRepository', () => {
  mockFindActiveReservationsByProductIds = jest.fn();
  return { findActiveReservationsByProductIds: mockFindActiveReservationsByProductIds };
});

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

type RecipeWithSupplyOverrides = Omit<Partial<RecipeWithSupply>, 'supply'> & {
  supply?: Partial<ProductRow>;
};

function createRecipeWithSupply(
  overrides: RecipeWithSupplyOverrides = {}
): RecipeWithSupply {
  const { supply: supplyOverrides, ...rest } = overrides;
  const supply = supplyOverrides
    ? ({
        ...createProductRow({
          id:
            typeof supplyOverrides.id === 'number'
              ? supplyOverrides.id
              : overrides.supplyId ?? 2,
        }),
        ...supplyOverrides,
      } as ProductRow)
    : null;
  return {
    id: 1,
    compoundProductId: 1,
    supplyId: 2,
    quantity: 1,
    autoDiscount: true,
    isOptional: false,
    selectedByDefault: false,
    createdAt: new Date(),
    supply,
    ...rest,
  } as RecipeWithSupply;
}

function createMockDbOrTx() {
  const forUpdate = jest.fn().mockResolvedValue([]);
  return {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockReturnValue({
            for: forUpdate,
          }),
        }),
      }),
    }),
    query: {
      recipes: { findMany: jest.fn() },
    },
  } as unknown as typeof import('@/db').db;
}

describe('cart-pipeline', () => {
  beforeEach(() => {
    mockFindByIdsForUpdate.mockImplementation(
      async (_branchId: number, ids: number[]) => {
        const products = [
          createProductRow({
            id: 1,
            name: 'Pancho',
            type: 'critical_supply',
            criticalSupplyType: 'sausage',
            price: 1000,
            stock: 10,
          }),
          createProductRow({
            id: 2,
            name: 'Coca',
            type: 'critical_supply',
            criticalSupplyType: 'beverage',
            price: 1500,
            stock: 5,
          }),
          createProductRow({
            id: 3,
            name: 'Promo',
            type: 'compound',
            price: 2500,
            stock: 0,
          }),
          createProductRow({
            id: 4,
            name: 'Cebolla',
            type: 'manual_supply',
            price: 0,
            stock: 20,
          }),
          createProductRow({
            id: 5,
            name: 'Delivery',
            type: 'service',
            price: 500,
            stock: 0,
          }),
        ];
        return products.filter((p) => ids.includes(p.id));
      }
    );

    mockFindRecipesForProducts.mockImplementation(
      async (_branchId: number, productIds: number[]) => {
        const recipes = [
          createRecipeWithSupply({
            id: 1,
            compoundProductId: 3,
            supplyId: 1,
            quantity: 2,
            autoDiscount: true,
            supply: {
              id: 1,
              name: 'Pancho',
              type: 'critical_supply',
              criticalSupplyType: 'sausage',
              stock: 10,
            },
          }),
          createRecipeWithSupply({
            id: 2,
            compoundProductId: 3,
            supplyId: 4,
            quantity: 1,
            autoDiscount: false,
            isOptional: true,
            selectedByDefault: true,
            supply: {
              id: 4,
              name: 'Cebolla',
              type: 'manual_supply',
              criticalSupplyType: null,
              stock: 20,
            },
          }),
        ];
        return recipes.filter((r) => productIds.includes(r.compoundProductId));
      }
    );

    mockGroupRecipesByProduct.mockImplementation((recipes: RecipeWithSupply[]) => {
      const map = new Map<number, RecipeWithSupply[]>();
      for (const recipe of recipes) {
        const list = map.get(recipe.compoundProductId) ?? [];
        list.push(recipe);
        map.set(recipe.compoundProductId, list);
      }
      return map;
    });

    mockFindActiveReservationsByProductIds.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('construye el contexto de productos y recetas', async () => {
    const dbOrTx = createMockDbOrTx();
    const result = await prepareCart({
      branchId: BRANCH_ID,
      items: [{ productId: 2, quantity: 2 }],
      operation: 'venta',
      dbOrTx,
    });

    expect(result.productById.has(2)).toBe(true);
    expect(result.recipesByProduct.size).toBe(0);
    expect(result.saleItemValues).toHaveLength(1);
    expect(result.saleItemValues[0].subtotal).toBe(3000);
    expect(result.total).toBe(3000);
  });

  it('ejecuta FOR UPDATE cuando shouldLock es true', async () => {
    const dbOrTx = createMockDbOrTx();
    await prepareCart({
      branchId: BRANCH_ID,
      items: [{ productId: 2, quantity: 1 }],
      operation: 'venta',
      dbOrTx,
      options: { shouldLock: true },
    });

    expect(dbOrTx.select).toHaveBeenCalled();
  });

  it('no ejecuta FOR UPDATE cuando shouldLock es false', async () => {
    const dbOrTx = createMockDbOrTx();
    await prepareCart({
      branchId: BRANCH_ID,
      items: [{ productId: 2, quantity: 1 }],
      operation: 'venta',
      dbOrTx,
    });

    expect(dbOrTx.select).not.toHaveBeenCalled();
  });

  it('descuenta reservas ajenas de la disponibilidad', async () => {
    mockFindActiveReservationsByProductIds.mockResolvedValue([
      { productId: 2, quantity: 3 },
    ]);

    const dbOrTx = createMockDbOrTx();
    const result = await prepareCart({
      branchId: BRANCH_ID,
      items: [{ productId: 2, quantity: 1 }],
      operation: 'pedido',
      dbOrTx,
      options: { excludeOrderId: 99 },
    });

    // Stock de Coca es 5, menos 3 de reservas ajenas, quedan 2. Con 1 solicitado,
    // no hay faltante y el pedido se puede procesar.
    expect(result.shortageByProduct[2]).toBeUndefined();
    expect(mockFindActiveReservationsByProductIds).toHaveBeenCalledWith(
      dbOrTx,
      BRANCH_ID,
      expect.any(Array),
      99
    );
  });

  it('calcula totales de venta con promo e insumos opcionales', async () => {
    const dbOrTx = createMockDbOrTx();
    const result = await prepareCart({
      branchId: BRANCH_ID,
      items: [
        {
          productId: 3,
          quantity: 1,
          selectedRecipeItemIds: [4],
        },
        { productId: 5, quantity: 1 },
      ],
      operation: 'venta',
      dbOrTx,
    });

    expect(result.saleItemValues).toHaveLength(2);
    expect(result.saleItemValues[0].subtotal).toBe(2500);
    expect(result.saleItemValues[1].subtotal).toBe(500);
    expect(result.total).toBe(3000);
  });

  it('respeta el snapshot histórico para conversión de pedido', async () => {
    const dbOrTx = createMockDbOrTx();
    const result = await prepareCart({
      branchId: BRANCH_ID,
      items: [
        {
          productId: 3,
          quantity: 1,
          selectedRecipeItemIds: [],
          recipeSnapshot: [
            {
              supplyId: 1,
              supplyName: 'Pancho',
              supplyType: 'critical_supply',
              quantity: 2,
              autoDiscount: true,
              isOptional: false,
              selected: true,
              selectedByDefault: false,
            },
            {
              supplyId: 4,
              supplyName: 'Cebolla',
              supplyType: 'manual_supply',
              quantity: 1,
              autoDiscount: false,
              isOptional: true,
              selected: false,
              selectedByDefault: true,
            },
          ],
        },
      ],
      operation: 'venta',
      dbOrTx,
      options: {
        buildItems: [
          {
            productId: 3,
            quantity: 1,
            selectedRecipeItemIds: [],
            recipeSnapshot: [
              {
                supplyId: 1,
                supplyName: 'Pancho',
                supplyType: 'critical_supply',
                quantity: 2,
                autoDiscount: true,
                isOptional: false,
                selected: true,
                selectedByDefault: false,
              },
            ],
            unitPrice: 2500,
            subtotal: 2500,
          },
        ],
      },
    });

    expect(result.saleItemValues[0].subtotal).toBe(2500);
    expect(result.saleItemValues[0].recipeSnapshot).toHaveLength(1);
    expect(result.saleItemValues[0].recipeSnapshot?.[0].supplyId).toBe(1);
  });

  it('detecta faltante de stock y devuelve shortageByProduct', async () => {
    const dbOrTx = createMockDbOrTx();
    await expect(
      prepareCart({
        branchId: BRANCH_ID,
        items: [{ productId: 2, quantity: 10 }],
        operation: 'venta',
        dbOrTx,
      })
    ).rejects.toThrow('Stock insuficiente');
  });

  it('permite servicios sin importar stock', async () => {
    const dbOrTx = createMockDbOrTx();
    const result = await prepareCart({
      branchId: BRANCH_ID,
      items: [{ productId: 5, quantity: 100 }],
      operation: 'venta',
      dbOrTx,
    });

    expect(result.saleItemValues[0].subtotal).toBe(50_000);
    expect(result.total).toBe(50_000);
  });
});
