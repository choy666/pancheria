import { calculateAvailability, confirmSale, cancelSale } from './saleService';
import * as productRepository from '@/repositories/productRepository';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import * as idempotencyService from '@/application/idempotencyService';
import { executeInTransaction } from '@/application/transactionService';
import { db } from '@/db';
import { products, sales, saleItems, stockMovements } from '@/db/schema';
import {
  ValidationError,
  NotFoundError,
  InsufficientStockError,
} from '@/domain/errors';

const capturedInserts: { table: unknown; data: unknown }[] = [];
const capturedUpdates: { table: unknown; data: unknown }[] = [];

function createMockDb() {
  const query = {
    recipes: { findMany: jest.fn() },
    sales: { findFirst: jest.fn() },
    products: { findMany: jest.fn() },
  };

  const insert = jest.fn().mockImplementation((table: unknown) => ({
    values: (data: unknown) => {
      capturedInserts.push({ table, data });
      return {
        returning: jest
          .fn()
          .mockResolvedValue([{ ...(data as object), id: 1, createdAt: new Date() }]),
      };
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
      where: jest.fn().mockImplementation(() => ({
        for: jest.fn().mockResolvedValue([
          {
            id: 1,
            status: 'open',
            deletedAt: null,
            total: 0,
            cashTotal: 0,
            transferTotal: 0,
            totalSales: 0,
            productsSummary: '{}',
            criticalSuppliesSummary: '{}',
          },
        ]),
      })),
    })),
  }));

  return { query, insert, update, select };
}

jest.mock('@/repositories/productRepository');
jest.mock('@/application/services/cashRegisterService', () => ({
  getOpenCashRegister: jest.fn(),
}));
jest.mock('@/application/idempotencyService', () => ({
  isIdempotencyKeyUsed: jest.fn(),
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
const mockedDb = db as any;

function setProducts(productsList: any[]) {
  mockedProductRepository.findByIds.mockImplementation(async (ids: number[]) =>
    productsList.filter((p) => ids.includes(p.id))
  );
  mockedProductRepository.findById.mockImplementation(
    async (id: number) => productsList.find((p) => p.id === id) ?? null
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
    mockedProductRepository.findById.mockResolvedValue(null);
    const result = await calculateAvailability(999);
    expect(result).toBe(0);
  });

  test('devuelve stock para bebida crítica', async () => {
    mockedProductRepository.findById.mockResolvedValue({
      id: 1,
      name: 'Gaseosa',
      type: 'critical_supply',
      criticalSupplyType: 'beverage',
      stock: 50,
    } as any);

    const result = await calculateAvailability(1);
    expect(result).toBe(50);
  });

  test('calcula disponibilidad de producto compuesto', async () => {
    mockedProductRepository.findById.mockResolvedValue({
      id: 1,
      name: 'Panchuque',
      type: 'compound',
    } as any);

    (mockedDb.query.recipes.findMany as jest.Mock).mockResolvedValue([
      {
        id: 1,
        compoundProductId: 1,
        supplyId: 2,
        quantity: 1,
        autoDiscount: true,
        supply: { stock: 10 } as any,
      },
      {
        id: 2,
        compoundProductId: 1,
        supplyId: 3,
        quantity: 2,
        autoDiscount: true,
        supply: { stock: 9 } as any,
      },
    ] as any);

    const result = await calculateAvailability(1);
    // Pan: 10/1 = 10; Salchicha: 9/2 = 4. Mínimo = 4.
    expect(result).toBe(4);
  });

  test('devuelve 0 si la receta no tiene items con auto descuento', async () => {
    mockedProductRepository.findById.mockResolvedValue({
      id: 1,
      name: 'Panchuque',
      type: 'compound',
    } as any);

    (mockedDb.query.recipes.findMany as jest.Mock).mockResolvedValue([
      {
        id: 1,
        compoundProductId: 1,
        supplyId: 2,
        quantity: 1,
        autoDiscount: false,
        supply: { stock: 10 } as any,
      },
    ] as any);

    const result = await calculateAvailability(1);
    expect(result).toBe(0);
  });
});

describe('confirmSale', () => {
  beforeEach(() => {
    capturedInserts.length = 0;
    capturedUpdates.length = 0;
    mockedExecuteInTransaction.mockImplementation(async (fn) => fn(db as any));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('rechaza la venta si la clave de idempotencia ya fue usada', async () => {
    mockedIdempotencyService.isIdempotencyKeyUsed.mockResolvedValue(true);

    await expect(
      confirmSale({
        items: [{ productId: 1, quantity: 1 }],
        paymentMethod: 'cash',
        idempotencyKey: 'repeated-key',
      })
    ).rejects.toThrow(ValidationError);

    expect(mockedCashRegisterService.getOpenCashRegister).not.toHaveBeenCalled();
    expect(mockedProductRepository.findByIds).not.toHaveBeenCalled();
  });

  test('rechaza la venta si no hay una caja abierta', async () => {
    mockedIdempotencyService.isIdempotencyKeyUsed.mockResolvedValue(false);
    mockedCashRegisterService.getOpenCashRegister.mockResolvedValue(null);

    mockedProductRepository.findByIds.mockResolvedValue([
      {
        id: 1,
        name: 'Gaseosa',
        type: 'critical_supply',
        criticalSupplyType: 'beverage',
        stock: 50,
        price: 1000,
      } as any,
    ]);

    await expect(
      confirmSale({
        items: [{ productId: 1, quantity: 1 }],
        paymentMethod: 'cash',
        idempotencyKey: 'abc',
      })
    ).rejects.toThrow(
      'No hay una caja abierta. Abrí la caja para comenzar a vender.'
    );
  });

  test('rechaza la venta de un producto no disponible (manual)', async () => {
    mockedIdempotencyService.isIdempotencyKeyUsed.mockResolvedValue(false);
    mockedCashRegisterService.getOpenCashRegister.mockResolvedValue({
      id: 1,
      openedAt: new Date(),
      openedBy: 'admin',
      status: 'open',
      total: 0,
      cashTotal: 0,
      transferTotal: 0,
      totalSales: 0,
      productsSummary: '{}',
      criticalSuppliesSummary: '{}',
    } as any);

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
        items: [{ productId: 3, quantity: 1 }],
        paymentMethod: 'cash',
        idempotencyKey: 'manual-sale',
      })
    ).rejects.toThrow(
      'El producto Ketchup no está disponible para la venta.'
    );
  });

  test('rechaza la venta de un insumo crítico que no es bebida', async () => {
    mockedIdempotencyService.isIdempotencyKeyUsed.mockResolvedValue(false);
    mockedCashRegisterService.getOpenCashRegister.mockResolvedValue({
      id: 1,
      openedAt: new Date(),
      openedBy: 'admin',
      status: 'open',
      total: 0,
      cashTotal: 0,
      transferTotal: 0,
      totalSales: 0,
      productsSummary: '{}',
      criticalSuppliesSummary: '{}',
    } as any);

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
        items: [{ productId: 4, quantity: 1 }],
        paymentMethod: 'cash',
        idempotencyKey: 'sausage-sale',
      })
    ).rejects.toThrow(
      'El producto Salchicha no está disponible para la venta.'
    );
  });

  test('rechaza la venta cuando hay stock insuficiente de bebida', async () => {
    mockedIdempotencyService.isIdempotencyKeyUsed.mockResolvedValue(false);
    mockedCashRegisterService.getOpenCashRegister.mockResolvedValue({
      id: 1,
      openedAt: new Date(),
      openedBy: 'admin',
      status: 'open',
      total: 0,
      cashTotal: 0,
      transferTotal: 0,
      totalSales: 0,
      productsSummary: '{}',
      criticalSuppliesSummary: '{}',
    } as any);

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
        items: [{ productId: 2, quantity: 6 }],
        paymentMethod: 'cash',
        idempotencyKey: 'insufficient-beverage',
      })
    ).rejects.toThrow(InsufficientStockError);
    await expect(
      confirmSale({
        items: [{ productId: 2, quantity: 6 }],
        paymentMethod: 'cash',
        idempotencyKey: 'insufficient-beverage',
      })
    ).rejects.toThrow(
      'Stock insuficiente para Gaseosa. Disponible: 5, solicitado: 6.'
    );
  });

  test('rechaza la venta cuando hay stock insuficiente de producto compuesto', async () => {
    mockedIdempotencyService.isIdempotencyKeyUsed.mockResolvedValue(false);
    mockedCashRegisterService.getOpenCashRegister.mockResolvedValue({
      id: 1,
      openedAt: new Date(),
      openedBy: 'admin',
      status: 'open',
      total: 0,
      cashTotal: 0,
      transferTotal: 0,
      totalSales: 0,
      productsSummary: '{}',
      criticalSuppliesSummary: '{}',
    } as any);

    setProducts([
      {
        id: 1,
        name: 'Panchuque',
        type: 'compound',
        criticalSupplyType: null,
        price: 1500,
      },
    ]);

    (mockedDb.query.recipes.findMany as jest.Mock).mockResolvedValue([
      {
        id: 1,
        compoundProductId: 1,
        supplyId: 2,
        quantity: 2,
        autoDiscount: true,
        supply: { stock: 5 } as any,
      },
    ] as any);

    await expect(
      confirmSale({
        items: [{ productId: 1, quantity: 3 }],
        paymentMethod: 'cash',
        idempotencyKey: 'insufficient-compound',
      })
    ).rejects.toThrow(InsufficientStockError);
    await expect(
      confirmSale({
        items: [{ productId: 1, quantity: 3 }],
        paymentMethod: 'cash',
        idempotencyKey: 'insufficient-compound',
      })
    ).rejects.toThrow(
      'Stock insuficiente para Panchuque. Disponible: 2, solicitado: 3.'
    );
  });

  test('permite la venta con stock justo', async () => {
    mockedIdempotencyService.isIdempotencyKeyUsed.mockResolvedValue(false);
    mockedCashRegisterService.getOpenCashRegister.mockResolvedValue({
      id: 1,
      openedAt: new Date(),
      openedBy: 'admin',
      status: 'open',
      total: 0,
      cashTotal: 0,
      transferTotal: 0,
      totalSales: 0,
      productsSummary: '{}',
      criticalSuppliesSummary: '{}',
    } as any);

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

    (mockedDb.query.recipes.findMany as jest.Mock).mockResolvedValue([]);

    const result = (await confirmSale({
      items: [{ productId: 2, quantity: 5 }],
      paymentMethod: 'cash',
      idempotencyKey: 'exact-stock',
    })) as any;

    expect(result.cashRegisterId).toBe(1);
    expect(result.total).toBe(4000);
    expect(result.paymentMethod).toBe('cash');

    expect(findCapturedInsert(sales).length).toBe(1);
    expect(findCapturedInsert(saleItems).length).toBe(1);
    expect(findCapturedInsert(stockMovements).length).toBe(1);
    expect(findCapturedUpdate(products).length).toBe(1);

    const movement = findCapturedInsert(stockMovements)[0].data as any;
    expect(movement.quantity).toBe(-5);
  });

  test('vincula la venta a la caja abierta', async () => {
    mockedIdempotencyService.isIdempotencyKeyUsed.mockResolvedValue(false);
    mockedCashRegisterService.getOpenCashRegister.mockResolvedValue({
      id: 1,
      openedAt: new Date(),
      openedBy: 'admin',
      status: 'open',
      total: 0,
      cashTotal: 0,
      transferTotal: 0,
      totalSales: 0,
      productsSummary: '{}',
      criticalSuppliesSummary: '{}',
    } as any);

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

    (mockedDb.query.recipes.findMany as jest.Mock).mockResolvedValue([]);

    const result = (await confirmSale({
      items: [{ productId: 1, quantity: 1 }],
      paymentMethod: 'cash',
      idempotencyKey: 'abc',
    })) as { cashRegisterId: number | null };

    expect(result.cashRegisterId).toBe(1);
  });

  test('confirma una venta con pago por transferencia', async () => {
    mockedIdempotencyService.isIdempotencyKeyUsed.mockResolvedValue(false);
    mockedCashRegisterService.getOpenCashRegister.mockResolvedValue({
      id: 1,
      openedAt: new Date(),
      openedBy: 'admin',
      status: 'open',
      total: 0,
      cashTotal: 0,
      transferTotal: 0,
      totalSales: 0,
      productsSummary: '{}',
      criticalSuppliesSummary: '{}',
    } as any);

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

    (mockedDb.query.recipes.findMany as jest.Mock).mockResolvedValue([]);

    const result = (await confirmSale({
      items: [{ productId: 1, quantity: 2 }],
      paymentMethod: 'transfer',
      idempotencyKey: 'transfer-sale',
    })) as any;

    expect(result.paymentMethod).toBe('transfer');
    expect(result.total).toBe(2000);
    expect(result.cashRegisterId).toBe(1);
  });
});

describe('cancelSale', () => {
  beforeEach(() => {
    capturedInserts.length = 0;
    capturedUpdates.length = 0;
    mockedExecuteInTransaction.mockImplementation(async (fn) => fn(db as any));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('anula una venta y reintegra el stock', async () => {
    (mockedDb.query.sales.findFirst as jest.Mock).mockResolvedValue({
      id: 1,
      status: 'active',
      total: 1500,
      paymentMethod: 'cash',
      items: [{ id: 1, productId: 1, quantity: 2 }],
      cashRegister: {
        id: 1,
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

    (mockedDb.query.recipes.findMany as jest.Mock).mockResolvedValue([
      {
        id: 1,
        compoundProductId: 1,
        supplyId: 2,
        quantity: 2,
        autoDiscount: true,
        supply: { name: 'Pan' } as any,
      },
    ] as any);

    const result = (await cancelSale(1, 'error de carga')) as any;

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
    expect((movements[0].data as any).quantity).toBe(4);
  });

  test('lanza NotFoundError si la venta no existe', async () => {
    (mockedDb.query.sales.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(cancelSale(999, 'error')).rejects.toThrow(NotFoundError);
    await expect(cancelSale(999, 'error')).rejects.toThrow(
      'Venta con ID 999 no encontrado.'
    );
  });

  test('rechaza anular una venta de una caja cerrada', async () => {
    (mockedDb.query.sales.findFirst as jest.Mock).mockResolvedValue({
      id: 1,
      status: 'active',
      items: [{ id: 1, productId: 1, quantity: 1 }],
      cashRegister: {
        id: 1,
        status: 'closed',
        deletedAt: null,
      },
    });

    await expect(cancelSale(1, 'error')).rejects.toThrow(
      'No se puede anular una venta de una caja cerrada o eliminada.'
    );
    await expect(cancelSale(1, 'error')).rejects.toThrow(ValidationError);
  });

  test('es idempotente: no anula una venta ya anulada', async () => {
    (mockedDb.query.sales.findFirst as jest.Mock).mockResolvedValue({
      id: 1,
      status: 'cancelled',
      items: [{ id: 1, productId: 1, quantity: 1 }],
      cashRegister: {
        id: 1,
        status: 'open',
        deletedAt: null,
      },
    });

    const result = await cancelSale(1, 'ya anulada');

    expect(result.status).toBe('cancelled');
    expect(mockedExecuteInTransaction).not.toHaveBeenCalled();
    expect(findCapturedUpdate(sales).length).toBe(0);
  });
});
