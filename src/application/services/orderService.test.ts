import {
  createOrder,
  cancelOrder,
  convertOrderToSale,
  getOrderById,
  getPendingOrders,
  getOrders,
  expirePendingOrders,
  trackOrder,
} from './orderService';
import * as branchService from '@/application/services/branchService';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import * as idempotencyService from '@/application/idempotencyService';
import * as productRepository from '@/repositories/productRepository';
import * as orderMessageRepository from '@/repositories/orderMessageRepository';
import { executeInTransaction } from '@/application/transactionService';
import { db } from '@/db';
import {
  orders,
  orderItems,
  sales,
  saleItems,
  products,
  stockMovements,
  cashRegisters,
  recipes,
} from '@/db/schema';
import {
  ValidationError,
  NotFoundError,
  InsufficientStockError,
} from '@/domain/errors';
import type { ProductRow } from '@/domain/types';

type OrderRow = typeof orders.$inferSelect;
type OrderItemRow = typeof orderItems.$inferSelect;
type SaleRow = typeof sales.$inferSelect;
type CashRegisterRow = typeof cashRegisters.$inferSelect;
type RecipeRow = typeof recipes.$inferSelect;
type RecipeWithSupply = RecipeRow & { supply: ProductRow | null };

interface MockDb {
  query: {
    orders: { findFirst: jest.Mock; findMany: jest.Mock };
    sales: { findFirst: jest.Mock };
    recipes: { findMany: jest.Mock };
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
    createdAt: new Date(),
    supply,
    ...rest,
  } as RecipeWithSupply;
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
    total: 0,
    cashTotal: 0,
    transferTotal: 0,
    totalSales: 0,
    productsSummary: {},
    criticalSuppliesSummary: {},
    deletedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function createOrderRow(overrides: Partial<OrderRow> = {}): OrderRow {
  return {
    id: 1,
    branchId: BRANCH_ID,
    orderNumber: 'PED-1-1234567890-abcdef',
    total: 1000,
    status: 'pending',
    customerName: 'Juan Pérez',
    customerPhone: '3415555555',
    deliveryType: 'pickup',
    address: null,
    notes: null,
    cancellationToken: 'token',
    convertedSaleId: null,
    idempotencyKey: '1:key',
    createdAt: new Date(),
    cancelledAt: null,
    cancellationReason: null,
    deletedAt: null,
    ...overrides,
  };
}

function createOrderItemRow(
  overrides: Partial<OrderItemRow> = {}
): OrderItemRow {
  return {
    id: 1,
    orderId: 1,
    productId: 1,
    quantity: 1,
    unitPrice: 1000,
    subtotal: 1000,
    ...overrides,
  };
}

function createMockDb(): MockDb {
  const query = {
    orders: { findFirst: jest.fn(), findMany: jest.fn() },
    orderMessages: { findMany: jest.fn().mockResolvedValue([]) },
    sales: { findFirst: jest.fn() },
    recipes: { findMany: jest.fn() },
    products: { findMany: jest.fn() },
  };

  const insert = jest.fn().mockImplementation((table: unknown) => ({
    values: (data: unknown) => {
      capturedInserts.push({ table, data });
      const builder = {
        onConflictDoNothing: () => builder,
        returning: jest
          .fn()
          .mockResolvedValue([
            { ...(data as object), id: 1, createdAt: new Date() },
          ]),
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

  const select = jest.fn().mockImplementation((columns: unknown) => {
    const thenValue =
      columns && typeof columns === 'object' && 'count' in columns
        ? [{ count: 1 }]
        : [];

    let lastTable: unknown = null;

    const builder: {
      from: jest.Mock;
      where: jest.Mock;
      for: jest.Mock;
      groupBy: jest.Mock;
      then: (onFulfilled?: (value: unknown) => unknown) => Promise<unknown>;
    } = {
      from: jest.fn((table: unknown) => {
        lastTable = table;
        return builder;
      }),
      where: jest.fn(() => builder),
      for: jest.fn().mockImplementation(async () => {
        if (lastTable === orders) {
          const order = await query.orders.findFirst();
          return order ? [order] : [];
        }
        if (lastTable === cashRegisters) {
          return [createOpenCashRegister()];
        }
        return [];
      }),
      groupBy: jest.fn(() => builder),
      then: (onFulfilled?: (value: unknown) => unknown) =>
        Promise.resolve(thenValue).then(onFulfilled),
    };

    return builder;
  });

  return { query, insert, update, select };
}

function findCapturedInsert(table: unknown) {
  return capturedInserts.filter((c) => c.table === table);
}

function findCapturedUpdate(table: unknown) {
  return capturedUpdates.filter((c) => c.table === table);
}

jest.mock('@/repositories/productRepository');
jest.mock('@/repositories/orderMessageRepository', () => ({
  countUnreadByOrderAndSender: jest.fn(),
}));
jest.mock('@/application/services/branchService', () => ({
  getBranchById: jest.fn(),
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
const mockedOrderMessageRepository = orderMessageRepository as jest.Mocked<
  typeof orderMessageRepository
>;
const mockedBranchService = branchService as jest.Mocked<typeof branchService>;
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
  mockedProductRepository.findByIds.mockImplementation(
    async (_branchId: number, ids: number[], _includeDeleted?: boolean) =>
      normalized.filter((p) => ids.includes(p.id))
  );
  mockedProductRepository.findByIdsForUpdate.mockImplementation(
    async (_branchId: number, ids: number[], _includeDeleted?: boolean) =>
      normalized.filter((p) => ids.includes(p.id))
  );
  mockedProductRepository.findById.mockImplementation(
    async (_branchId: number, id: number) =>
      normalized.find((p) => p.id === id) ?? null
  );
}

function setRecipes(recipesList: RecipeWithSupply[]) {
  mockedDb.query.recipes.findMany.mockResolvedValue(recipesList);
}

describe('orderService', () => {
  beforeEach(() => {
    capturedInserts.length = 0;
    capturedUpdates.length = 0;
    mockedExecuteInTransaction.mockImplementation(async (fn) => fn(db));
    mockedBranchService.getBranchById.mockResolvedValue({
      id: BRANCH_ID,
      name: 'Sucursal Test',
      openingHours: [],
      createdAt: new Date(),
    });
    mockedIdempotencyService.isIdempotencyKeyUsed.mockResolvedValue(false);
    mockedIdempotencyService.findExistingByIdempotencyKey.mockResolvedValue(
      null
    );
    mockedCashRegisterService.getOpenCashRegister.mockResolvedValue(
      createOpenCashRegister()
    );
    mockedOrderMessageRepository.countUnreadByOrderAndSender.mockResolvedValue(0);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrder', () => {
    test('crea un pedido sin descontar stock', async () => {
      setProducts([
        {
          id: 1,
          name: 'Gaseosa',
          type: 'critical_supply',
          criticalSupplyType: 'beverage',
          stock: 10,
          price: 1000,
        },
      ]);
      setRecipes([]);

      const result = await createOrder({
        branchId: BRANCH_ID,
        items: [{ productId: 1, quantity: 2 }],
        customerName: 'Juan Pérez',
        customerPhone: '3415555555',
        deliveryType: 'pickup',
        idempotencyKey: 'key-1',
      });

      expect(result.orderNumber).toMatch(/^PED-/);
      expect(result.total).toBe(2000);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].quantity).toBe(2);

      expect(findCapturedInsert(orders)).toHaveLength(1);
      expect(findCapturedInsert(orderItems)).toHaveLength(1);
      expect(findCapturedUpdate(products)).toHaveLength(0);
      expect(findCapturedInsert(stockMovements)).toHaveLength(0);
    });

    test('crea un pedido con promo sin descontar insumos compartidos', async () => {
      setProducts([
        { id: 1, name: 'Promo A', type: 'compound', price: 2000 },
        { id: 2, name: 'Promo B', type: 'compound', price: 2000 },
        {
          id: 3,
          name: 'Salchicha',
          type: 'critical_supply',
          criticalSupplyType: 'sausage',
          stock: 8,
          price: 100,
        },
      ]);
      setRecipes([
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

      await createOrder({
        branchId: BRANCH_ID,
        items: [
          { productId: 1, quantity: 1 },
          { productId: 2, quantity: 1 },
        ],
        customerName: 'Ana',
        customerPhone: '3416666666',
        deliveryType: 'pickup',
        idempotencyKey: 'key-shared',
      });

      expect(findCapturedInsert(orders)).toHaveLength(1);
      expect(findCapturedUpdate(products)).toHaveLength(0);
      expect(findCapturedInsert(stockMovements)).toHaveLength(0);
    });

    test('rechaza el pedido si hay stock insuficiente', async () => {
      setProducts([
        {
          id: 1,
          name: 'Gaseosa',
          type: 'critical_supply',
          criticalSupplyType: 'beverage',
          stock: 2,
          price: 1000,
        },
      ]);
      setRecipes([]);

      await expect(
        createOrder({
          branchId: BRANCH_ID,
          items: [{ productId: 1, quantity: 5 }],
          customerName: 'Juan',
          customerPhone: '3415555555',
          deliveryType: 'pickup',
          idempotencyKey: 'key-insufficient',
        })
      ).rejects.toThrow(InsufficientStockError);

      expect(findCapturedInsert(orders)).toHaveLength(0);
    });

    test('rechaza el pedido de un producto inactivo', async () => {
      setProducts([
        {
          id: 1,
          name: 'Gaseosa',
          type: 'critical_supply',
          criticalSupplyType: 'beverage',
          stock: 10,
          price: 1000,
          isActive: false,
        },
      ]);
      setRecipes([]);

      await expect(
        createOrder({
          branchId: BRANCH_ID,
          items: [{ productId: 1, quantity: 1 }],
          customerName: 'Juan',
          customerPhone: '3415555555',
          deliveryType: 'pickup',
          idempotencyKey: 'key-inactive',
        })
      ).rejects.toThrow('El producto Gaseosa no está activo.');
    });

    test('rechaza el pedido de un producto no vendible', async () => {
      setProducts([
        {
          id: 1,
          name: 'Ketchup',
          type: 'manual_supply',
          stock: 10,
          price: 500,
        },
      ]);
      setRecipes([]);

      await expect(
        createOrder({
          branchId: BRANCH_ID,
          items: [{ productId: 1, quantity: 1 }],
          customerName: 'Juan',
          customerPhone: '3415555555',
          deliveryType: 'pickup',
          idempotencyKey: 'key-manual',
        })
      ).rejects.toThrow('El producto Ketchup no está disponible para el pedido.');
    });

    test('rechaza el pedido de un producto de otra sucursal', async () => {
      setProducts([
        {
          id: 99,
          name: 'Producto externo',
          type: 'critical_supply',
          criticalSupplyType: 'beverage',
          stock: 10,
          price: 1000,
          branchId: 999,
        },
      ]);
      setRecipes([]);

      await expect(
        createOrder({
          branchId: BRANCH_ID,
          items: [{ productId: 99, quantity: 1 }],
          customerName: 'Juan',
          customerPhone: '3415555555',
          deliveryType: 'pickup',
          idempotencyKey: 'key-external',
        })
      ).rejects.toThrow(ValidationError);
    });

    test('rechaza el pedido si el producto no existe', async () => {
      setProducts([]);

      await expect(
        createOrder({
          branchId: BRANCH_ID,
          items: [{ productId: 1, quantity: 1 }],
          customerName: 'Juan',
          customerPhone: '3415555555',
          deliveryType: 'pickup',
          idempotencyKey: 'key-missing-product',
        })
      ).rejects.toThrow(NotFoundError);
    });

    test('rechaza el pedido si la sucursal no existe', async () => {
      mockedBranchService.getBranchById.mockResolvedValue(undefined);

      await expect(
        createOrder({
          branchId: 999,
          items: [{ productId: 1, quantity: 1 }],
          customerName: 'Juan',
          customerPhone: '3415555555',
          deliveryType: 'pickup',
          idempotencyKey: 'key-branch',
        })
      ).rejects.toThrow(NotFoundError);
    });

    test('evita duplicados por idempotencia devolviendo el pedido existente', async () => {
      const existing = createOrderRow({ id: 42, orderNumber: 'PED-42' });
      mockedDb.query.orders.findFirst.mockResolvedValue(existing);

      const result = await createOrder({
        branchId: BRANCH_ID,
        items: [{ productId: 1, quantity: 1 }],
        customerName: 'Juan',
        customerPhone: '3415555555',
        deliveryType: 'pickup',
        idempotencyKey: 'key-duplicate',
      });

      expect(result.id).toBe(42);
      expect(findCapturedInsert(orders)).toHaveLength(0);
    });
  });

  describe('cancelOrder', () => {
    test('cancela un pedido pendiente sin modificar stock', async () => {
      setProducts([
        {
          id: 1,
          name: 'Gaseosa',
          type: 'critical_supply',
          criticalSupplyType: 'beverage',
          stock: 5,
          price: 1000,
        },
      ]);
      setRecipes([]);

      mockedDb.query.orders.findFirst.mockResolvedValue({
        ...createOrderRow(),
        items: [createOrderItemRow({ productId: 1, quantity: 3 })],
      });

      const result = await cancelOrder(
        BRANCH_ID,
        1,
        'Cancelado por el cliente',
        'token'
      );

      expect(result.status).toBe('cancelled');

      expect(findCapturedUpdate(products)).toHaveLength(0);
      expect(findCapturedInsert(stockMovements)).toHaveLength(0);
    });

    test('rechaza cancelación con token inválido', async () => {
      mockedDb.query.orders.findFirst.mockResolvedValue({
        ...createOrderRow({ cancellationToken: 'valid-token' }),
        items: [createOrderItemRow({ productId: 1, quantity: 1 })],
      });

      await expect(
        cancelOrder(BRANCH_ID, 1, 'Motivo', 'invalid-token')
      ).rejects.toThrow('El token de cancelación no es válido.');
    });

    test('rechaza cancelación de un pedido ya confirmado', async () => {
      mockedDb.query.orders.findFirst.mockResolvedValue({
        ...createOrderRow({ status: 'converted' }),
        items: [],
      });

      await expect(
        cancelOrder(BRANCH_ID, 1, 'Motivo')
      ).rejects.toThrow('El pedido no puede cancelarse porque ya fue confirmado.');
    });

    test('lanza NotFoundError si el pedido no existe', async () => {
      mockedDb.query.orders.findFirst.mockResolvedValue(undefined);

      await expect(
        cancelOrder(BRANCH_ID, 999, 'Motivo')
      ).rejects.toThrow(NotFoundError);
    });

    test('es idempotente cuando el pedido ya fue cancelado', async () => {
      mockedDb.query.orders.findFirst.mockResolvedValue({
        ...createOrderRow({ status: 'cancelled' }),
        items: [],
      });

      const result = await cancelOrder(BRANCH_ID, 1, 'Motivo');

      expect(result.status).toBe('cancelled');
      expect(findCapturedUpdate(products)).toHaveLength(0);
    });
  });

  describe('convertOrderToSale', () => {
    test('convierte pedido a venta conservando el precio histórico', async () => {
      setProducts([
        {
          id: 1,
          name: 'Gaseosa',
          type: 'critical_supply',
          criticalSupplyType: 'beverage',
          stock: 5,
          price: 1200,
        },
      ]);
      setRecipes([]);

      mockedDb.query.orders.findFirst.mockResolvedValue({
        ...createOrderRow({ total: 2000 }),
        items: [
          createOrderItemRow({
            productId: 1,
            quantity: 2,
            unitPrice: 1000,
            subtotal: 2000,
          }),
        ],
      });

      const result = await convertOrderToSale({
        branchId: BRANCH_ID,
        orderId: 1,
        paymentMethod: 'cash',
        idempotencyKey: 'key-historical',
      });

      expect(result.total).toBe(2000);

      expect(findCapturedInsert(sales)).toHaveLength(1);
      expect(findCapturedInsert(saleItems)).toHaveLength(1);
      expect(findCapturedUpdate(products)).toHaveLength(1);

      const sale = findCapturedInsert(sales)[0]?.data as typeof sales.$inferInsert;
      expect(sale.total).toBe(2000);

      const saleItemsData = findCapturedInsert(saleItems)[0]?.data as (typeof saleItems.$inferInsert)[];
      expect(saleItemsData).toHaveLength(1);
      expect(saleItemsData[0]).toMatchObject({
        productId: 1,
        quantity: 2,
        unitPrice: 1000,
        subtotal: 2000,
      });
    });

    test('descontar stock al confirmar pedido', async () => {
      setProducts([
        {
          id: 1,
          name: 'Gaseosa',
          type: 'critical_supply',
          criticalSupplyType: 'beverage',
          stock: 5,
          price: 1000,
        },
      ]);
      setRecipes([]);

      mockedDb.query.orders.findFirst.mockResolvedValue({
        ...createOrderRow({ total: 2000 }),
        items: [
          createOrderItemRow({
            productId: 1,
            quantity: 2,
            unitPrice: 1000,
            subtotal: 2000,
          }),
        ],
      });

      const result = await convertOrderToSale({
        branchId: BRANCH_ID,
        orderId: 1,
        paymentMethod: 'cash',
        idempotencyKey: 'key-convert',
      });

      expect(result.total).toBe(2000);

      expect(findCapturedInsert(sales)).toHaveLength(1);
      expect(findCapturedInsert(saleItems)).toHaveLength(1);
      expect(findCapturedUpdate(products)).toHaveLength(1);
      expect(findCapturedInsert(stockMovements)).toHaveLength(1);
      expect(findCapturedUpdate(cashRegisters)).toHaveLength(1);
      expect(findCapturedUpdate(orders)).toHaveLength(1);

      const sale = findCapturedInsert(sales)[0]
        ?.data as typeof sales.$inferInsert;
      expect(sale.paymentMethod).toBe('cash');
      expect(sale.cashRegisterId).toBe(1);

      const orderUpdate = findCapturedUpdate(orders)[0]
        ?.data as Partial<OrderRow>;
      expect(orderUpdate.status).toBe('converted');

      const stockMovement = findCapturedInsert(stockMovements)[0]
        ?.data as typeof stockMovements.$inferInsert;
      expect(stockMovement.type).toBe('sale');
      expect(stockMovement.quantity).toBe(-2);
      expect(stockMovement.saleId).toBe(1);
    });

    test('es idempotente cuando la venta ya fue procesada', async () => {
      const existingSale = {
        id: 100,
        branchId: BRANCH_ID,
        total: 2000,
        paymentMethod: 'cash',
      };
      mockedIdempotencyService.findExistingByIdempotencyKey.mockResolvedValue(
        existingSale as any
      );

      const result = await convertOrderToSale({
        branchId: BRANCH_ID,
        orderId: 1,
        paymentMethod: 'cash',
        idempotencyKey: 'key-convert',
      });

      expect(result).toEqual(existingSale);
      expect(findCapturedInsert(sales)).toHaveLength(0);
    });

    test('rechaza la conversión si no hay caja abierta', async () => {
      mockedCashRegisterService.getOpenCashRegister.mockResolvedValue(null);
      mockedDb.query.orders.findFirst.mockResolvedValue({
        ...createOrderRow(),
        items: [createOrderItemRow()],
      });

      await expect(
        convertOrderToSale({
          branchId: BRANCH_ID,
          orderId: 1,
          paymentMethod: 'cash',
          idempotencyKey: 'key-no-cash',
        })
      ).rejects.toThrow('No hay una caja abierta. Abrí la caja para confirmar el pedido.');
    });

    test('rechaza la conversión de un pedido no pendiente', async () => {
      mockedDb.query.orders.findFirst.mockResolvedValue({
        ...createOrderRow({ status: 'cancelled' }),
        items: [],
      });

      await expect(
        convertOrderToSale({
          branchId: BRANCH_ID,
          orderId: 1,
          paymentMethod: 'cash',
          idempotencyKey: 'key-not-pending',
        })
      ).rejects.toThrow('El pedido no está pendiente de confirmación.');
    });

    test('rechaza la conversión si el pedido no existe', async () => {
      mockedDb.query.orders.findFirst.mockResolvedValue(undefined);

      await expect(
        convertOrderToSale({
          branchId: BRANCH_ID,
          orderId: 999,
          paymentMethod: 'cash',
          idempotencyKey: 'key-not-found',
        })
      ).rejects.toThrow(NotFoundError);
    });

    test('rechaza la conversión si el producto no es vendible', async () => {
      setProducts([
        {
          id: 1,
          name: 'Ketchup',
          type: 'manual_supply',
          stock: 5,
          price: 500,
        },
      ]);
      setRecipes([]);

      mockedDb.query.orders.findFirst.mockResolvedValue({
        ...createOrderRow(),
        items: [createOrderItemRow({ productId: 1, quantity: 1 })],
      });

      await expect(
        convertOrderToSale({
          branchId: BRANCH_ID,
          orderId: 1,
          paymentMethod: 'cash',
          idempotencyKey: 'key-not-sellable',
        })
      ).rejects.toThrow('El producto Ketchup no está disponible para la venta.');
    });

    test('rechaza la conversión si el producto es de otra sucursal', async () => {
      setProducts([
        {
          id: 1,
          name: 'Producto externo',
          type: 'critical_supply',
          criticalSupplyType: 'beverage',
          stock: 5,
          price: 1000,
          branchId: 999,
        },
      ]);
      setRecipes([]);

      mockedDb.query.orders.findFirst.mockResolvedValue({
        ...createOrderRow(),
        items: [createOrderItemRow({ productId: 1, quantity: 1 })],
      });

      await expect(
        convertOrderToSale({
          branchId: BRANCH_ID,
          orderId: 1,
          paymentMethod: 'cash',
          idempotencyKey: 'key-external-convert',
        })
      ).rejects.toThrow(ValidationError);
    });

    test('rechaza la conversión si el producto está inactivo', async () => {
      setProducts([
        {
          id: 1,
          name: 'Gaseosa',
          type: 'critical_supply',
          criticalSupplyType: 'beverage',
          stock: 5,
          price: 1000,
          isActive: false,
        },
      ]);
      setRecipes([]);

      mockedDb.query.orders.findFirst.mockResolvedValue({
        ...createOrderRow(),
        items: [createOrderItemRow({ productId: 1, quantity: 1 })],
      });

      await expect(
        convertOrderToSale({
          branchId: BRANCH_ID,
          orderId: 1,
          paymentMethod: 'cash',
          idempotencyKey: 'key-inactive-convert',
        })
      ).rejects.toThrow('El producto Gaseosa no está activo.');
    });
  });

  describe('getOrderById, getPendingOrders y getOrders', () => {
    test('getOrderById retorna el pedido con sus ítems', async () => {
      const expected = {
        ...createOrderRow(),
        items: [createOrderItemRow()],
      };
      mockedDb.query.orders.findFirst.mockResolvedValue(expected);

      const result = await getOrderById(BRANCH_ID, 1);

      expect(result).toMatchObject({
        id: 1,
        orderNumber: expected.orderNumber,
        unreadCount: 0,
      });
      expect(result?.items).toHaveLength(1);
    });

    test('getOrderById retorna undefined si no existe', async () => {
      mockedDb.query.orders.findFirst.mockResolvedValue(undefined);

      const result = await getOrderById(BRANCH_ID, 999);

      expect(result).toBeUndefined();
    });

    test('getPendingOrders retorna pedidos pendientes', async () => {
      mockedDb.query.orders.findMany.mockResolvedValue([
        createOrderRow(),
        createOrderRow({ id: 2, orderNumber: 'PED-2' }),
      ]);

      const result = await getPendingOrders(BRANCH_ID);

      expect(result).toHaveLength(2);
    });

    test('getOrders retorna pedidos paginados y filtrados por estado', async () => {
      mockedDb.query.orders.findMany.mockResolvedValue([createOrderRow()]);

      const result = await getOrders(BRANCH_ID, {
        status: 'pending',
        page: 1,
        limit: 10,
      });

      expect(result.items).toHaveLength(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });
  });

  describe('expirePendingOrders', () => {
    const ORIGINAL_ORDER_EXPIRATION_MS = process.env.ORDER_EXPIRATION_MS;

    beforeEach(() => {
      process.env.ORDER_EXPIRATION_MS = '60000';
    });

    afterEach(() => {
      process.env.ORDER_EXPIRATION_MS = ORIGINAL_ORDER_EXPIRATION_MS;
    });

    test('expira pedidos pending creados antes del tiempo de expiración sin modificar stock', async () => {
      setProducts([
        {
          id: 1,
          name: 'Gaseosa',
          type: 'critical_supply',
          criticalSupplyType: 'beverage',
          stock: 5,
          price: 1000,
        },
      ]);
      setRecipes([]);

      mockedDb.query.orders.findMany.mockResolvedValue([
        { id: 1, branchId: BRANCH_ID },
      ]);

      mockedDb.query.orders.findFirst.mockResolvedValue({
        ...createOrderRow({
          createdAt: new Date(Date.now() - 120_000),
        }),
        items: [createOrderItemRow({ productId: 1, quantity: 3 })],
      });

      const count = await expirePendingOrders(BRANCH_ID);

      expect(count).toBe(1);
      expect(mockedDb.query.orders.findMany).toHaveBeenCalled();
      expect(mockedDb.query.orders.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
        })
      );
      expect(findCapturedUpdate(orders)).toHaveLength(1);

      const updatedOrder = findCapturedUpdate(orders)[0]?.data as Partial<
        typeof orders.$inferInsert
      >;
      expect(updatedOrder.status).toBe('cancelled');
      expect(updatedOrder.cancellationReason).toBe(
        'Expiración automática por inactividad'
      );

      expect(findCapturedUpdate(products)).toHaveLength(0);
      expect(findCapturedInsert(stockMovements)).toHaveLength(0);
    });

    test('no cancela pedidos pending recientes', async () => {
      mockedDb.query.orders.findMany.mockResolvedValue([]);

      const count = await expirePendingOrders(BRANCH_ID);

      expect(count).toBe(0);
      expect(mockedDb.query.orders.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('trackOrder', () => {
    test('devuelve el pedido con token y expiresAt cuando está pending', async () => {
      mockedDb.query.orders.findFirst.mockResolvedValue({
        ...createOrderRow(),
        branch: { id: BRANCH_ID, name: 'Sucursal Test', openingHours: [], createdAt: new Date() },
        items: [createOrderItemRow()],
      });

      const result = await trackOrder(
        'PED-1-1234567890-abcdef',
        'Juan Pérez'
      );

      expect(result).not.toBeNull();
      expect(result?.status).toBe('pending');
      expect(result?.cancellationToken).toBe('token');
      expect(result?.expiresAt).toBeDefined();
      expect(result?.branchName).toBe('Sucursal Test');
    });

    test('no incluye token ni expiresAt cuando el pedido no está pending', async () => {
      mockedDb.query.orders.findFirst.mockResolvedValue({
        ...createOrderRow({ status: 'converted' }),
        branch: { id: BRANCH_ID, name: 'Sucursal Test', openingHours: [], createdAt: new Date() },
        items: [createOrderItemRow()],
      });

      const result = await trackOrder(
        'PED-1-1234567890-abcdef',
        'Juan Pérez'
      );

      expect(result).not.toBeNull();
      expect(result?.status).toBe('converted');
      expect(result?.cancellationToken).toBeUndefined();
      expect(result?.expiresAt).toBeUndefined();
    });

    test('devuelve null si no encuentra el pedido', async () => {
      mockedDb.query.orders.findFirst.mockResolvedValue(undefined);

      const result = await trackOrder('PED-999', 'Juan Pérez');

      expect(result).toBeNull();
    });
  });

});
