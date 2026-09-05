import {
  calculateAvailability,
  calculateAvailabilityForProductIds,
  validateCartAvailability,
  confirmSale,
  cancelSale,
  buildSaleItemValues,
} from './saleService';
import * as productRepository from '@/repositories/productRepository';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import * as idempotencyService from '@/application/idempotencyService';
import { executeInTransaction } from '@/application/transactionService';
import { db } from '@/db';
import {
  products,
  recipes,
  sales,
  saleItems,
  salePayments,
  stockMovements,
  cashRegisters,
} from '@/db/schema';
import {
  ValidationError,
  NotFoundError,
  InsufficientStockError,
} from '@/domain/errors';
import { ProductRow } from '@/domain/types';

type SaleRow = typeof sales.$inferSelect;
type StockMovementInsert = typeof stockMovements.$inferInsert;
type CashRegisterRow = typeof cashRegisters.$inferSelect;
type RecipeRow = typeof recipes.$inferSelect;
type RecipeWithSupply = RecipeRow & { supply: ProductRow | null };

interface MockDb {
  query: {
    recipes: { findMany: jest.Mock };
    sales: { findFirst: jest.Mock };
    products: { findMany: jest.Mock };
  };
  insert: jest.Mock;
  update: jest.Mock;
  select: jest.Mock;
}

const capturedInserts: { table: unknown; data: unknown }[] = [];
const capturedUpdates: { table: unknown; data: unknown }[] = [];

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

function createRecipeWithSupply(
  overrides: Partial<RecipeRow> & { supply?: Partial<ProductRow> } = {}
): RecipeWithSupply {
  const { supply: supplyOverrides, ...rest } = overrides;
  const supply = supplyOverrides
    ? createProductRow(supplyOverrides)
    : createProductRow();
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
  };
}

function createOpenCashRegister(
  overrides: Partial<CashRegisterRow> = {}
): CashRegisterRow {
  return {
    id: 1,
    branchId: BRANCH_ID,
    openedAt: new Date(),
    closedAt: null,
    openedBy: 'admin',
    closedBy: null,
    status: 'open',
    autoClosed: false,
    initialAmount: 0,
    total: 0,
    cashTotal: 0,
    transferTotal: 0,
    totalSales: 0,
    productsSummary: {},
    criticalSuppliesSummary: {},
    recipeSuppliesSummary: {},
    closingCashCount: null,
    closingDifference: null,
    closingNotes: null,
    deletedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function createMockDb(): MockDb {
  const query = {
    recipes: { findMany: jest.fn() },
    sales: { findFirst: jest.fn() },
    products: { findMany: jest.fn() },
  };

  const insert = jest.fn().mockImplementation((table: unknown) => ({
    values: (data: unknown) => {
      capturedInserts.push({ table, data });
      const builder = {
        onConflictDoNothing: () => builder,
        returning: jest
          .fn()
          .mockResolvedValue([{ ...(data as object), id: 1, createdAt: new Date() }]),
      };
      return builder;
    },
  }));

  const update = jest.fn().mockImplementation((table: unknown) => ({
    set: jest.fn().mockImplementation((data: unknown) => ({
      where: jest.fn().mockImplementation(() => {
        capturedUpdates.push({ table, data });
        return {
          returning: jest
            .fn()
            .mockResolvedValue([{ ...(data as object), id: 1 }]),
        };
      }),
    })),
  }));

  const select = jest.fn().mockImplementation(() => ({
    from: jest.fn().mockImplementation(() => ({
      where: jest.fn().mockImplementation(() => {
        const forResult = jest.fn().mockResolvedValue([
          {
            id: 1,
            branchId: BRANCH_ID,
            status: 'open',
            deletedAt: null,
            total: 0,
            cashTotal: 0,
            transferTotal: 0,
            totalSales: 0,
            productsSummary: {},
            criticalSuppliesSummary: {},
            recipeSuppliesSummary: {},
          },
        ]);

        return {
          orderBy: jest.fn().mockImplementation(() => ({
            for: forResult,
          })),
          for: forResult,
        };
      }),
    })),
  }));

  return { query, insert, update, select };
}

jest.mock('@/repositories/productRepository');
jest.mock('@/repositories/orderStockReservationRepository', () => ({
  findActiveReservationsByProductIds: jest.fn().mockResolvedValue([]),
  insertReservations: jest.fn().mockResolvedValue(undefined),
  deleteByOrderId: jest.fn().mockResolvedValue(undefined),
  findByOrderId: jest.fn().mockResolvedValue([]),
}));
jest.mock('@/application/services/cashRegisterService', () => ({
  getOpenCashRegister: jest.fn(),
}));
jest.mock('@/application/idempotencyService', () => ({
  isIdempotencyKeyUsed: jest.fn(),
  findExistingByIdempotencyKey: jest.fn(),
}));
jest.mock('@/application/transactionService', () => ({
  executeInTransaction: jest.fn(),
}));
jest.mock('@/db', () => ({ db: createMockDb() }));

const mockedProductRepository = productRepository as jest.Mocked<
  typeof productRepository
>;
const mockedCashRegisterService = cashRegisterService as jest.Mocked<
  typeof cashRegisterService
>;
const mockedIdempotencyService = idempotencyService as jest.Mocked<
  typeof idempotencyService
>;
const mockedExecuteInTransaction = executeInTransaction as jest.MockedFunction<
  typeof executeInTransaction
>;
const mockedDb = db as unknown as MockDb;

function setProducts(productsList: Partial<ProductRow>[]) {
  const normalized = productsList.map((p) =>
    createProductRow({ isActive: true, ...p })
  );
  mockedProductRepository.findByIds.mockImplementation(async (_branchId: number, ids: number[]) =>
    normalized.filter((p) => ids.includes(p.id))
  );
  mockedProductRepository.findByIdsForUpdate.mockImplementation(
    async (_branchId: number, ids: number[]) =>
      normalized.filter((p) => ids.includes(p.id))
  );
  mockedProductRepository.findById.mockImplementation(
    async (_branchId: number, id: number) => normalized.find((p) => p.id === id) ?? null
  );
}

function findCapturedInsert(table: unknown) {
  return capturedInserts.filter((c) => c.table === table);
}

function findCapturedUpdate(table: unknown) {
  return capturedUpdates.filter((c) => c.table === table);
}

describe('calculateAvailability', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve 0 si el producto no existe', async () => {
    setProducts([]);
    const result = await calculateAvailability(BRANCH_ID, 999);
    expect(result).toBe(0);
  });

  test('devuelve stock para bebida crítica', async () => {
    setProducts([
      {
        id: 1,
        name: 'Gaseosa',
        type: 'critical_supply',
        criticalSupplyType: 'beverage',
        stock: 50,
      },
    ]);

    const result = await calculateAvailability(BRANCH_ID, 1);
    expect(result).toBe(50);
  });

  test('calcula disponibilidad de producto compuesto', async () => {
    setProducts([{ id: 1, name: 'Panchuque', type: 'compound' }]);

    mockedDb.query.recipes.findMany.mockResolvedValue([
      createRecipeWithSupply({
        id: 1,
        compoundProductId: 1,
        supplyId: 2,
        quantity: 1,
        autoDiscount: true,
        supply: { stock: 10 },
      }),
      createRecipeWithSupply({
        id: 2,
        compoundProductId: 1,
        supplyId: 3,
        quantity: 2,
        autoDiscount: true,
        supply: { stock: 9 },
      }),
    ]);

    const result = await calculateAvailability(BRANCH_ID, 1);
    // Pan: 10/1 = 10; Salchicha: 9/2 = 4. Mínimo = 4.
    expect(result).toBe(4);
  });

  test('devuelve 0 si la receta no tiene items con auto descuento', async () => {
    setProducts([{ id: 1, name: 'Panchuque', type: 'compound' }]);

    mockedDb.query.recipes.findMany.mockResolvedValue([
      createRecipeWithSupply({
        id: 1,
        compoundProductId: 1,
        supplyId: 2,
        quantity: 1,
        autoDiscount: false,
        supply: { stock: 10 },
      }),
    ]);

    const result = await calculateAvailability(BRANCH_ID, 1);
    expect(result).toBe(0);
  });

  test('ignora recetas cuyo insumo pertenece a otra sucursal', async () => {
    setProducts([{ id: 1, name: 'Panchuque', type: 'compound' }]);

    mockedDb.query.recipes.findMany.mockResolvedValue([
      createRecipeWithSupply({
        id: 1,
        compoundProductId: 1,
        supplyId: 2,
        quantity: 1,
        autoDiscount: true,
        supply: { branchId: 999, stock: 10 },
      }),
    ]);

    const result = await calculateAvailability(BRANCH_ID, 1);
    expect(result).toBe(0);
  });

  test('devuelve disponibilidad ilimitada para servicios', async () => {
    setProducts([
      { id: 1, name: 'Agregado de toppings', type: 'service' },
    ]);

    const result = await calculateAvailability(BRANCH_ID, 1);
    expect(result).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe('calculateAvailabilityForProductIds', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve disponibilidad y desglose por productos', async () => {
    setProducts([
      { id: 1, name: 'Panchuque', type: 'compound' },
      { id: 2, name: 'Pan', type: 'critical_supply', criticalSupplyType: 'bread', stock: 10 },
      { id: 3, name: 'Salchicha', type: 'critical_supply', criticalSupplyType: 'sausage', stock: 9 },
      { id: 4, name: 'Gaseosa', type: 'critical_supply', criticalSupplyType: 'beverage', stock: 12 },
      { id: 5, name: 'Vaso', type: 'service' },
    ]);

    mockedDb.query.recipes.findMany.mockResolvedValue([
      createRecipeWithSupply({
        id: 1,
        compoundProductId: 1,
        supplyId: 2,
        quantity: 1,
        autoDiscount: true,
        supply: { name: 'Pan', stock: 10 },
      }),
      createRecipeWithSupply({
        id: 2,
        compoundProductId: 1,
        supplyId: 3,
        quantity: 2,
        autoDiscount: true,
        supply: { name: 'Salchicha', stock: 9 },
      }),
    ]);

    const result = await calculateAvailabilityForProductIds(BRANCH_ID, [1, 4, 5]);

    expect(result[1].availability).toBe(4);
    expect(result[1].breakdown).toHaveLength(2);
    expect(result[1].breakdown[0]).toMatchObject({
      supplyName: 'Pan',
      available: 10,
      required: 1,
      isLimiting: false,
    });
    expect(result[1].breakdown[1]).toMatchObject({
      supplyName: 'Salchicha',
      available: 9,
      required: 2,
      isLimiting: true,
    });
    expect(result[4].availability).toBe(12);
    expect(result[4].breakdown).toEqual([]);
    expect(result[5].availability).toBe(Number.MAX_SAFE_INTEGER);
    expect(result[5].breakdown).toEqual([]);
  });
});

describe('validateCartAvailability', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('calcula disponibilidad adicional con dos promos que comparten un insumo', async () => {
    setProducts([
      { id: 1, name: 'Promo A', type: 'compound', price: 2000 },
      { id: 2, name: 'Promo B', type: 'compound', price: 2000 },
      { id: 3, name: 'Salchicha', type: 'critical_supply', criticalSupplyType: 'sausage', stock: 8, price: 100 },
    ]);

    mockedDb.query.recipes.findMany.mockResolvedValue([
      createRecipeWithSupply({
        id: 1,
        compoundProductId: 1,
        supplyId: 3,
        quantity: 2,
        autoDiscount: true,
        supply: { name: 'Salchicha', stock: 8 },
      }),
      createRecipeWithSupply({
        id: 2,
        compoundProductId: 2,
        supplyId: 3,
        quantity: 2,
        autoDiscount: true,
        supply: { name: 'Salchicha', stock: 8 },
      }),
    ]);

    const result = await validateCartAvailability(BRANCH_ID, [
      { productId: 1, quantity: 3 },
    ]);

    expect(result.consumedBySupply[3]).toBe(6);
    expect(result.availabilityByProduct[1]).toBe(1);
  });

  test('detecta faltante cuando el consumo combinado supera el stock', async () => {
    setProducts([
      { id: 1, name: 'Promo A', type: 'compound', price: 2000 },
      { id: 2, name: 'Promo B', type: 'compound', price: 2000 },
      { id: 3, name: 'Salchicha', type: 'critical_supply', criticalSupplyType: 'sausage', stock: 8, price: 100 },
    ]);

    mockedDb.query.recipes.findMany.mockResolvedValue([
      createRecipeWithSupply({
        id: 1,
        compoundProductId: 1,
        supplyId: 3,
        quantity: 2,
        autoDiscount: true,
        supply: { name: 'Salchicha', stock: 8 },
      }),
      createRecipeWithSupply({
        id: 2,
        compoundProductId: 2,
        supplyId: 3,
        quantity: 2,
        autoDiscount: true,
        supply: { name: 'Salchicha', stock: 8 },
      }),
    ]);

    const result = await validateCartAvailability(BRANCH_ID, [
      { productId: 1, quantity: 4 },
      { productId: 2, quantity: 4 },
    ]);

    expect(result.consumedBySupply[3]).toBe(16);
    expect(result.shortageByProduct[1]).toEqual({
      available: 8,
      required: 16,
      supplyName: 'Salchicha',
    });
    expect(result.shortageByProduct[2]).toEqual({
      available: 8,
      required: 16,
      supplyName: 'Salchicha',
    });
  });

  test('combina consumo de promo y bebida', async () => {
    setProducts([
      { id: 1, name: 'Promo A', type: 'compound', price: 2000 },
      { id: 2, name: 'Pritty', type: 'critical_supply', criticalSupplyType: 'beverage', stock: 5, price: 800 },
      { id: 3, name: 'Salchicha', type: 'critical_supply', criticalSupplyType: 'sausage', stock: 10, price: 100 },
    ]);

    mockedDb.query.recipes.findMany.mockResolvedValue([
      createRecipeWithSupply({
        id: 1,
        compoundProductId: 1,
        supplyId: 3,
        quantity: 2,
        autoDiscount: true,
        supply: { name: 'Salchicha', stock: 10 },
      }),
    ]);

    const result = await validateCartAvailability(BRANCH_ID, [
      { productId: 1, quantity: 2 },
      { productId: 2, quantity: 3 },
    ]);

    expect(result.consumedBySupply[2]).toBe(3);
    expect(result.consumedBySupply[3]).toBe(4);
    expect(result.availabilityByProduct[1]).toBe(3);
    expect(result.availabilityByProduct[2]).toBe(2);
  });

  test('libera stock al reducir la cantidad en el carrito', async () => {
    setProducts([
      { id: 1, name: 'Promo A', type: 'compound', price: 2000 },
      { id: 2, name: 'Promo B', type: 'compound', price: 2000 },
      { id: 3, name: 'Salchicha', type: 'critical_supply', criticalSupplyType: 'sausage', stock: 8, price: 100 },
    ]);

    mockedDb.query.recipes.findMany.mockResolvedValue([
      createRecipeWithSupply({
        id: 1,
        compoundProductId: 1,
        supplyId: 3,
        quantity: 2,
        autoDiscount: true,
        supply: { name: 'Salchicha', stock: 8 },
      }),
      createRecipeWithSupply({
        id: 2,
        compoundProductId: 2,
        supplyId: 3,
        quantity: 2,
        autoDiscount: true,
        supply: { name: 'Salchicha', stock: 8 },
      }),
    ]);

    const first = await validateCartAvailability(BRANCH_ID, [
      { productId: 1, quantity: 4 },
    ]);
    expect(first.availabilityByProduct[1]).toBe(0);

    const second = await validateCartAvailability(BRANCH_ID, [
      { productId: 1, quantity: 2 },
    ]);
    expect(second.availabilityByProduct[1]).toBe(2);
  });

  test('los servicios no consumen stock ni limitan disponibilidad', async () => {
    setProducts([
      { id: 1, name: 'Agregado', type: 'service', price: 500 },
      { id: 2, name: 'Salchicha', type: 'critical_supply', criticalSupplyType: 'sausage', stock: 8, price: 100 },
    ]);

    mockedDb.query.recipes.findMany.mockResolvedValue([]);

    const result = await validateCartAvailability(BRANCH_ID, [
      { productId: 1, quantity: 100 },
    ]);

    expect(result.consumedBySupply[2]).toBeUndefined();
    expect(result.availabilityByProduct[1]).toBe(Number.MAX_SAFE_INTEGER);
  });

  test('calcula consumo y disponibilidad con dos líneas del mismo producto y selecciones distintas', async () => {
    setProducts([
      { id: 1, name: 'Promo', type: 'compound', price: 2000 },
      {
        id: 2,
        name: 'Gaseosa',
        type: 'critical_supply',
        criticalSupplyType: 'beverage',
        stock: 3,
        price: 0,
      },
    ]);

    mockedDb.query.recipes.findMany.mockResolvedValue([
      createRecipeWithSupply({
        id: 1,
        compoundProductId: 1,
        supplyId: 2,
        quantity: 1,
        autoDiscount: true,
        isOptional: true,
        selectedByDefault: false,
        supply: { name: 'Gaseosa', stock: 3 },
      }),
    ]);

    const result = await validateCartAvailability(BRANCH_ID, [
      { productId: 1, quantity: 1, selectedRecipeItemIds: [2] },
      { productId: 1, quantity: 1, selectedRecipeItemIds: [] },
    ]);

    expect(result.consumedBySupply[2]).toBe(1);
    expect(result.availabilityByProduct[1]).toBe(2);
    expect(result.shortageByProduct).toEqual({});
  });
});

describe('buildSaleItemValues', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('calcula precio y subtotal desde el producto si no se indican valores históricos', () => {
    setProducts([
      {
        id: 1,
        name: 'Gaseosa',
        type: 'critical_supply',
        criticalSupplyType: 'beverage',
        price: 1000,
      },
    ]);

    const productById = new Map([[1, createProductRow({ id: 1, name: 'Gaseosa', price: 1000 })]]);
    const result = buildSaleItemValues(productById, [
      { productId: 1, quantity: 2 },
    ]);

    expect(result.total).toBe(2000);
    expect(result.saleItemValues).toHaveLength(1);
    expect(result.saleItemValues[0]).toMatchObject({
      productId: 1,
      quantity: 2,
      unitPrice: 1000,
      subtotal: 2000,
    });
  });

  test('respeta unitPrice y subtotal opcionales cuando se proveen', () => {
    const productById = new Map([[1, createProductRow({ id: 1, name: 'Gaseosa', price: 1200 })]]);
    const result = buildSaleItemValues(productById, [
      { productId: 1, quantity: 2, unitPrice: 1000, subtotal: 2000 },
    ]);

    expect(result.total).toBe(2000);
    expect(result.saleItemValues[0]).toMatchObject({
      productId: 1,
      quantity: 2,
      unitPrice: 1000,
      subtotal: 2000,
    });
  });

  test('usa unitPrice histórico y recalcula subtotal si solo se provee unitPrice', () => {
    const productById = new Map([[1, createProductRow({ id: 1, name: 'Gaseosa', price: 1200 })]]);
    const result = buildSaleItemValues(productById, [
      { productId: 1, quantity: 3, unitPrice: 1000 },
    ]);

    expect(result.total).toBe(3000);
    expect(result.saleItemValues[0]).toMatchObject({
      productId: 1,
      quantity: 3,
      unitPrice: 1000,
      subtotal: 3000,
    });
  });
});

describe('confirmSale', () => {
  beforeEach(() => {
    capturedInserts.length = 0;
    capturedUpdates.length = 0;
    mockedExecuteInTransaction.mockImplementation(async (fn) => fn(db));
    mockedIdempotencyService.findExistingByIdempotencyKey.mockResolvedValue(
      null
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('rechaza la venta si la clave de idempotencia ya fue usada', async () => {
    mockedIdempotencyService.findExistingByIdempotencyKey.mockResolvedValue(
      { id: 1 } as any
    );

    await expect(
      confirmSale({
        branchId: BRANCH_ID,
        items: [{ productId: 1, quantity: 1 }],
        payments: [{ method: 'cash', amount: 1000 }],
        idempotencyKey: 'repeated-key',
      })
    ).rejects.toThrow(ValidationError);

    expect(mockedProductRepository.findByIds).not.toHaveBeenCalled();
  });

  test('rechaza la venta si no hay una caja abierta', async () => {
    mockedIdempotencyService.isIdempotencyKeyUsed.mockResolvedValue(false);
    mockedCashRegisterService.getOpenCashRegister.mockResolvedValue(null);

    mockedProductRepository.findByIds.mockResolvedValue([
      createProductRow({
        id: 1,
        name: 'Gaseosa',
        type: 'critical_supply',
        criticalSupplyType: 'beverage',
        stock: 50,
        price: 1000,
      }),
    ]);

    await expect(
      confirmSale({
        branchId: BRANCH_ID,
        items: [{ productId: 1, quantity: 1 }],
        payments: [{ method: 'cash', amount: 1000 }],
        idempotencyKey: 'abc',
      })
    ).rejects.toThrow(
      'No hay una caja abierta. Abrí la caja para comenzar a vender.'
    );
  });

  test('rechaza la venta de un producto no disponible (manual)', async () => {
    mockedIdempotencyService.isIdempotencyKeyUsed.mockResolvedValue(false);
    mockedCashRegisterService.getOpenCashRegister.mockResolvedValue(
      createOpenCashRegister()
    );

    setProducts([
      {
        id: 3,
        name: 'Ketchup',
        type: 'manual_supply',
        criticalSupplyType: null,
        stock: 100,
        price: 500,
      },
    ]);

    await expect(
      confirmSale({
        branchId: BRANCH_ID,
        items: [{ productId: 3, quantity: 1 }],
        payments: [{ method: 'cash', amount: 500 }],
        idempotencyKey: 'manual-sale',
      })
    ).rejects.toThrow(
      'El producto Ketchup no está disponible para la venta.'
    );
  });

  test('rechaza la venta de un insumo crítico que no es bebida', async () => {
    mockedIdempotencyService.isIdempotencyKeyUsed.mockResolvedValue(false);
    mockedCashRegisterService.getOpenCashRegister.mockResolvedValue(
      createOpenCashRegister()
    );

    setProducts([
      {
        id: 4,
        name: 'Salchicha',
        type: 'critical_supply',
        criticalSupplyType: 'sausage',
        stock: 20,
        price: 1200,
      },
    ]);

    await expect(
      confirmSale({
        branchId: BRANCH_ID,
        items: [{ productId: 4, quantity: 1 }],
        payments: [{ method: 'cash', amount: 1200 }],
        idempotencyKey: 'sausage-sale',
      })
    ).rejects.toThrow(
      'El producto Salchicha no está disponible para la venta.'
    );
  });

  test('rechaza la venta de un producto inactivo', async () => {
    mockedIdempotencyService.isIdempotencyKeyUsed.mockResolvedValue(false);
    mockedCashRegisterService.getOpenCashRegister.mockResolvedValue(
      createOpenCashRegister()
    );

    setProducts([
      {
        id: 5,
        name: 'Promo off',
        type: 'compound',
        stock: 0,
        price: 2000,
        isActive: false,
      },
    ]);

    mockedDb.query.recipes.findMany.mockResolvedValue([]);

    await expect(
      confirmSale({
        branchId: BRANCH_ID,
        items: [{ productId: 5, quantity: 1 }],
        payments: [{ method: 'cash', amount: 2000 }],
        idempotencyKey: 'inactive-sale',
      })
    ).rejects.toThrow('El producto Promo off no está activo.');
  });

  test('rechaza la venta de un producto de otra sucursal', async () => {
    mockedIdempotencyService.isIdempotencyKeyUsed.mockResolvedValue(false);
    mockedCashRegisterService.getOpenCashRegister.mockResolvedValue(
      createOpenCashRegister()
    );

    setProducts([
      {
        id: 99,
        name: 'Producto externo',
        type: 'critical_supply',
        criticalSupplyType: 'beverage',
        branchId: 999,
        stock: 50,
        price: 1000,
      },
    ]);

    await expect(
      confirmSale({
        branchId: BRANCH_ID,
        items: [{ productId: 99, quantity: 1 }],
        payments: [{ method: 'cash', amount: 1000 }],
        idempotencyKey: 'external-product',
      })
    ).rejects.toThrow(ValidationError);
  });

  test('rechaza la venta cuando hay stock insuficiente de bebida', async () => {
    mockedIdempotencyService.isIdempotencyKeyUsed.mockResolvedValue(false);
    mockedCashRegisterService.getOpenCashRegister.mockResolvedValue(
      createOpenCashRegister()
    );

    setProducts([
      {
        id: 2,
        name: 'Gaseosa',
        type: 'critical_supply',
        criticalSupplyType: 'beverage',
        stock: 5,
        price: 800,
      },
    ]);

    await expect(
      confirmSale({
        branchId: BRANCH_ID,
        items: [{ productId: 2, quantity: 6 }],
        payments: [{ method: 'cash', amount: 4800 }],
        idempotencyKey: 'insufficient-beverage',
      })
    ).rejects.toThrow(InsufficientStockError);
    await expect(
      confirmSale({
        branchId: BRANCH_ID,
        items: [{ productId: 2, quantity: 6 }],
        payments: [{ method: 'cash', amount: 4800 }],
        idempotencyKey: 'insufficient-beverage',
      })
    ).rejects.toThrow(
      'Stock insuficiente para Gaseosa. Disponible: 5, solicitado: 6.'
    );
  });

  test('rechaza la venta cuando hay stock insuficiente de producto compuesto', async () => {
    mockedIdempotencyService.isIdempotencyKeyUsed.mockResolvedValue(false);
    mockedCashRegisterService.getOpenCashRegister.mockResolvedValue(
      createOpenCashRegister()
    );

    setProducts([
      {
        id: 1,
        name: 'Panchuque',
        type: 'compound',
        criticalSupplyType: null,
        price: 1500,
      },
    ]);

    mockedDb.query.recipes.findMany.mockResolvedValue([
      createRecipeWithSupply({
        id: 1,
        compoundProductId: 1,
        supplyId: 2,
        quantity: 2,
        autoDiscount: true,
        supply: { name: 'Salchicha', stock: 5 },
      }),
    ]);

    await expect(
      confirmSale({
        branchId: BRANCH_ID,
        items: [{ productId: 1, quantity: 3 }],
        payments: [{ method: 'cash', amount: 4500 }],
        idempotencyKey: 'insufficient-compound',
      })
    ).rejects.toThrow(InsufficientStockError);
    await expect(
      confirmSale({
        branchId: BRANCH_ID,
        items: [{ productId: 1, quantity: 3 }],
        payments: [{ method: 'cash', amount: 4500 }],
        idempotencyKey: 'insufficient-compound',
      })
    ).rejects.toThrow(
      'Stock insuficiente para Panchuque (insumo: Salchicha). Disponible: 5, solicitado: 6.'
    );
  });

  test('permite la venta con stock justo', async () => {
    mockedIdempotencyService.isIdempotencyKeyUsed.mockResolvedValue(false);
    mockedCashRegisterService.getOpenCashRegister.mockResolvedValue(
      createOpenCashRegister()
    );

    setProducts([
      {
        id: 2,
        name: 'Gaseosa',
        type: 'critical_supply',
        criticalSupplyType: 'beverage',
        stock: 5,
        price: 800,
      },
    ]);

    mockedDb.query.recipes.findMany.mockResolvedValue([]);

    const result = (await confirmSale({
      branchId: BRANCH_ID,
      items: [{ productId: 2, quantity: 5 }],
      payments: [{ method: 'cash', amount: 4000 }],
      idempotencyKey: 'exact-stock',
    })) as SaleRow;

    expect(result.cashRegisterId).toBe(1);
    expect(result.total).toBe(4000);
    expect(result.paymentMethod).toBe('cash');

    expect(findCapturedInsert(sales).length).toBe(1);
    expect(findCapturedInsert(saleItems).length).toBe(1);
    expect(findCapturedInsert(salePayments).length).toBe(1);
    expect(findCapturedInsert(stockMovements).length).toBe(1);
    expect(findCapturedUpdate(products).length).toBe(1);

    const movement = findCapturedInsert(stockMovements)[0].data as StockMovementInsert;
    expect(movement.quantity).toBe(-5);
  });

  test('vincula la venta a la caja abierta', async () => {
    mockedIdempotencyService.isIdempotencyKeyUsed.mockResolvedValue(false);
    mockedCashRegisterService.getOpenCashRegister.mockResolvedValue(
      createOpenCashRegister()
    );

    setProducts([
      {
        id: 1,
        name: 'Gaseosa',
        type: 'critical_supply',
        criticalSupplyType: 'beverage',
        stock: 50,
        price: 1000,
      },
    ]);

    mockedDb.query.recipes.findMany.mockResolvedValue([]);

    const result = await confirmSale({
      branchId: BRANCH_ID,
      items: [{ productId: 1, quantity: 1 }],
      payments: [{ method: 'cash', amount: 1000 }],
      idempotencyKey: 'abc',
    }) as { cashRegisterId: number | null };

    expect(result.cashRegisterId).toBe(1);
    expect(findCapturedInsert(salePayments).length).toBe(1);
  });

  test('confirma una venta con pago por transferencia', async () => {
    mockedIdempotencyService.isIdempotencyKeyUsed.mockResolvedValue(false);
    mockedCashRegisterService.getOpenCashRegister.mockResolvedValue(
      createOpenCashRegister()
    );

    setProducts([
      {
        id: 1,
        name: 'Gaseosa',
        type: 'critical_supply',
        criticalSupplyType: 'beverage',
        stock: 50,
        price: 1000,
      },
    ]);

    mockedDb.query.recipes.findMany.mockResolvedValue([]);

    const result = (await confirmSale({
      branchId: BRANCH_ID,
      items: [{ productId: 1, quantity: 2 }],
      payments: [{ method: 'transfer', amount: 2000 }],
      idempotencyKey: 'transfer-sale',
    })) as SaleRow;

    expect(result.paymentMethod).toBe('transfer');
    expect(result.total).toBe(2000);
    expect(result.cashRegisterId).toBe(1);
    expect(findCapturedInsert(salePayments).length).toBe(1);
  });

  test('confirma una venta con pago mixto y separa efectivo y transferencia', async () => {
    mockedIdempotencyService.isIdempotencyKeyUsed.mockResolvedValue(false);
    mockedCashRegisterService.getOpenCashRegister.mockResolvedValue(
      createOpenCashRegister()
    );

    setProducts([
      {
        id: 1,
        name: 'Gaseosa',
        type: 'critical_supply',
        criticalSupplyType: 'beverage',
        stock: 50,
        price: 1000,
      },
    ]);

    mockedDb.query.recipes.findMany.mockResolvedValue([]);

    const result = (await confirmSale({
      branchId: BRANCH_ID,
      items: [{ productId: 1, quantity: 2 }],
      payments: [
        { method: 'cash', amount: 500 },
        { method: 'transfer', amount: 1500 },
      ],
      idempotencyKey: 'mixed-sale',
    })) as SaleRow;

    expect(result.total).toBe(2000);
    expect(result.paymentMethod).toBe('cash');
    expect(findCapturedInsert(salePayments).length).toBe(1);

    const salePaymentsData = findCapturedInsert(salePayments)[0]
      ?.data as (typeof salePayments.$inferInsert)[];
    expect(salePaymentsData).toHaveLength(2);
    expect(salePaymentsData).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: 'cash', amount: 500 }),
        expect.objectContaining({ method: 'transfer', amount: 1500 }),
      ])
    );

    const cashRegisterUpdate = findCapturedUpdate(cashRegisters)[0]
      ?.data as Partial<CashRegisterRow>;
    expect(cashRegisterUpdate.total).toBe(2000);
    expect(cashRegisterUpdate.cashTotal).toBe(500);
    expect(cashRegisterUpdate.transferTotal).toBe(1500);
  });

  test('permite vender un servicio sin descontar stock', async () => {
    mockedIdempotencyService.isIdempotencyKeyUsed.mockResolvedValue(false);
    mockedCashRegisterService.getOpenCashRegister.mockResolvedValue(
      createOpenCashRegister()
    );

    setProducts([
      {
        id: 1,
        name: 'Vaso de gaseosa',
        type: 'service',
        criticalSupplyType: null,
        stock: 0,
        price: 500,
      },
    ]);

    mockedDb.query.recipes.findMany.mockResolvedValue([]);

    const result = (await confirmSale({
      branchId: BRANCH_ID,
      items: [{ productId: 1, quantity: 3 }],
      payments: [{ method: 'cash', amount: 1500 }],
      idempotencyKey: 'service-sale',
    })) as SaleRow;

    expect(result.total).toBe(1500);
    expect(findCapturedInsert(salePayments).length).toBe(1);
    expect(findCapturedUpdate(products).length).toBe(0);
    expect(findCapturedInsert(stockMovements).length).toBe(0);
  });

  test('descuenta stock de múltiples insumos críticos en un combo', async () => {
    mockedIdempotencyService.isIdempotencyKeyUsed.mockResolvedValue(false);
    mockedCashRegisterService.getOpenCashRegister.mockResolvedValue(
      createOpenCashRegister()
    );

    setProducts([
      {
        id: 1,
        name: 'Promo Familiar',
        type: 'compound',
        price: 11000,
      },
    ]);

    mockedDb.query.recipes.findMany.mockResolvedValue([
      createRecipeWithSupply({
        id: 1,
        compoundProductId: 1,
        supplyId: 2,
        quantity: 9,
        autoDiscount: true,
        supply: { stock: 100 },
      }),
      createRecipeWithSupply({
        id: 2,
        compoundProductId: 1,
        supplyId: 3,
        quantity: 18,
        autoDiscount: true,
        supply: { stock: 100 },
      }),
    ]);

    const result = (await confirmSale({
      branchId: BRANCH_ID,
      items: [{ productId: 1, quantity: 1 }],
      payments: [{ method: 'cash', amount: 11000 }],
      idempotencyKey: 'combo-multiple',
    })) as SaleRow;

    expect(result.total).toBe(11000);

    expect(findCapturedInsert(salePayments).length).toBe(1);

    const productUpdates = findCapturedUpdate(products);
    expect(productUpdates.length).toBe(2);
    expect(productUpdates[0].data).toMatchObject({ stock: expect.any(Object) });
    expect(productUpdates[1].data).toMatchObject({ stock: expect.any(Object) });

    const movements = findCapturedInsert(stockMovements);
    expect(movements.length).toBe(2);
    expect((movements[0].data as StockMovementInsert).quantity).toBe(-9);
    expect((movements[1].data as StockMovementInsert).quantity).toBe(-18);
  });

  test('descuenta stock de un combo y una bebida en la misma venta', async () => {
    mockedIdempotencyService.isIdempotencyKeyUsed.mockResolvedValue(false);
    mockedCashRegisterService.getOpenCashRegister.mockResolvedValue(
      createOpenCashRegister()
    );

    setProducts([
      {
        id: 1,
        name: 'Promo con bebida',
        type: 'compound',
        price: 2500,
      },
      {
        id: 2,
        name: 'Gaseosa',
        type: 'critical_supply',
        criticalSupplyType: 'beverage',
        stock: 10,
        price: 500,
      },
      {
        id: 3,
        name: 'Salchicha',
        type: 'critical_supply',
        criticalSupplyType: 'sausage',
        stock: 8,
        price: 100,
      },
    ]);

    mockedDb.query.recipes.findMany.mockResolvedValue([
      createRecipeWithSupply({
        id: 1,
        compoundProductId: 1,
        supplyId: 3,
        quantity: 2,
        autoDiscount: true,
        supply: { name: 'Salchicha', stock: 8 },
      }),
    ]);

    const result = (await confirmSale({
      branchId: BRANCH_ID,
      items: [
        { productId: 1, quantity: 2 },
        { productId: 2, quantity: 3 },
      ],
      payments: [{ method: 'cash', amount: 6500 }],
      idempotencyKey: 'combo-beverage',
    })) as SaleRow;

    expect(result.total).toBe(6500);

    expect(findCapturedInsert(salePayments).length).toBe(1);

    const productUpdates = findCapturedUpdate(products);
    expect(productUpdates.length).toBe(2);
    expect(productUpdates[0].data).toMatchObject({ stock: expect.any(Object) });
    expect(productUpdates[1].data).toMatchObject({ stock: expect.any(Object) });

    const movements = findCapturedInsert(stockMovements);
    expect(movements.length).toBe(2);

    const quantities = movements
      .map((m) => (m.data as StockMovementInsert).quantity)
      .sort((a, b) => a - b);
    expect(quantities).toEqual([-4, -3]);
  });
});

describe('cancelSale', () => {
  beforeEach(() => {
    capturedInserts.length = 0;
    capturedUpdates.length = 0;
    mockedExecuteInTransaction.mockImplementation(async (fn) => fn(db));
    mockedIdempotencyService.findExistingByIdempotencyKey.mockResolvedValue(
      null
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('anula una venta y reintegra el stock', async () => {
    mockedDb.query.sales.findFirst.mockResolvedValue({
      id: 1,
      branchId: BRANCH_ID,
      status: 'active',
      total: 1500,
      paymentMethod: 'cash',
      payments: [{ method: 'cash', amount: 1500 }],
      items: [{ id: 1, productId: 1, quantity: 2 }],
      cashRegister: {
        id: 1,
        branchId: BRANCH_ID,
        status: 'open',
        deletedAt: null,
      },
    });

    setProducts([
      {
        id: 1,
        name: 'Panchuque',
        type: 'compound',
        price: 1500,
      },
    ]);

    mockedDb.query.recipes.findMany.mockResolvedValue([
      createRecipeWithSupply({
        id: 1,
        compoundProductId: 1,
        supplyId: 2,
        quantity: 2,
        autoDiscount: true,
        supply: { name: 'Pan' },
      }),
    ]);

    const result = (await cancelSale(BRANCH_ID, 1, 'error de carga')) as SaleRow;

    expect(result.status).toBe('cancelled');
    expect(result.cancellationReason).toBe('error de carga');

    const saleUpdate = findCapturedUpdate(sales);
    expect(saleUpdate.length).toBe(1);
    expect(saleUpdate[0].data).toMatchObject({
      status: 'cancelled',
      cancellationReason: 'error de carga',
    });

    expect(findCapturedUpdate(products).length).toBe(1);

    const movements = findCapturedInsert(stockMovements);
    expect(movements.length).toBe(1);
    expect((movements[0].data as StockMovementInsert).quantity).toBe(4);
  });

  test('lanza NotFoundError si la venta no existe', async () => {
    mockedDb.query.sales.findFirst.mockResolvedValue(null);

    await expect(cancelSale(BRANCH_ID, 999, 'error')).rejects.toThrow(NotFoundError);
    await expect(cancelSale(BRANCH_ID, 999, 'error')).rejects.toThrow(
      'Venta con ID 999 no encontrado.'
    );
  });

  test('rechaza anular una venta de una caja cerrada', async () => {
    mockedDb.query.sales.findFirst.mockResolvedValue({
      id: 1,
      branchId: BRANCH_ID,
      status: 'active',
      items: [{ id: 1, productId: 1, quantity: 1 }],
      cashRegister: {
        id: 1,
        branchId: BRANCH_ID,
        status: 'closed',
        deletedAt: null,
      },
    });

    await expect(cancelSale(BRANCH_ID, 1, 'error')).rejects.toThrow(
      'No se puede anular una venta de una caja cerrada o eliminada.'
    );
    await expect(cancelSale(BRANCH_ID, 1, 'error')).rejects.toThrow(ValidationError);
  });

  test('rechaza anular una venta de una caja eliminada', async () => {
    mockedDb.query.sales.findFirst.mockResolvedValue({
      id: 1,
      branchId: BRANCH_ID,
      status: 'active',
      items: [{ id: 1, productId: 1, quantity: 1 }],
      cashRegister: {
        id: 1,
        branchId: BRANCH_ID,
        status: 'open',
        deletedAt: new Date(),
      },
    });

    await expect(cancelSale(BRANCH_ID, 1, 'error')).rejects.toThrow(
      'No se puede anular una venta de una caja cerrada o eliminada.'
    );
    await expect(cancelSale(BRANCH_ID, 1, 'error')).rejects.toThrow(ValidationError);
  });

  test('es idempotente: no anula una venta ya anulada', async () => {
    mockedDb.query.sales.findFirst.mockResolvedValue({
      id: 1,
      branchId: BRANCH_ID,
      status: 'cancelled',
      items: [{ id: 1, productId: 1, quantity: 1 }],
      cashRegister: {
        id: 1,
        branchId: BRANCH_ID,
        status: 'open',
        deletedAt: null,
      },
    });

    const result = await cancelSale(BRANCH_ID, 1, 'ya anulada');

    expect(result.status).toBe('cancelled');
    expect(mockedExecuteInTransaction).not.toHaveBeenCalled();
    expect(findCapturedUpdate(sales).length).toBe(0);
  });

  test('anula una venta de servicio sin reintegrar stock', async () => {
    mockedDb.query.sales.findFirst.mockResolvedValue({
      id: 1,
      branchId: BRANCH_ID,
      status: 'active',
      total: 500,
      paymentMethod: 'cash',
      payments: [{ method: 'cash', amount: 500 }],
      items: [{ id: 1, productId: 1, quantity: 1 }],
      cashRegister: {
        id: 1,
        branchId: BRANCH_ID,
        status: 'open',
        deletedAt: null,
      },
    });

    setProducts([
      {
        id: 1,
        name: 'Vaso de gaseosa',
        type: 'service',
        price: 500,
      },
    ]);

    mockedDb.query.recipes.findMany.mockResolvedValue([]);

    const result = (await cancelSale(BRANCH_ID, 1, 'error de carga')) as SaleRow;

    expect(result.status).toBe('cancelled');
    expect(findCapturedUpdate(sales).length).toBe(1);
    expect(findCapturedUpdate(products).length).toBe(0);
    expect(findCapturedInsert(stockMovements).length).toBe(0);
  });
});
