import {
  calculateAvailability,
  confirmSale,
} from './saleService';
import * as productRepository from '@/repositories/productRepository';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import * as idempotencyService from '@/application/idempotencyService';
import { executeInTransaction } from '@/application/transactionService';
import { db } from '@/db';
import { ValidationError } from '@/domain/errors';

const mockInsert = jest.fn();
const mockUpdate = jest.fn();

function createMockDb() {
  return {
    query: {
      recipes: {
        findMany: jest.fn(),
      },
    },
    insert: () => ({
      values: (data: unknown) => {
        mockInsert(data);
        return {
          returning: jest.fn().mockResolvedValue([
            {
              id: 1,
              total: 1000,
              paymentMethod: 'cash',
              cashRegisterId: 1,
              idempotencyKey: 'abc',
              createdAt: new Date(),
            },
          ]),
        };
      },
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          returning: jest.fn().mockResolvedValue([{}]),
        }),
      }),
    }),
  };
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
jest.mock('@/db', () => ({
  db: createMockDb(),
}));

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
const mockedDb = db as jest.Mocked<typeof db>;

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
    mockedExecuteInTransaction.mockImplementation(async (fn) => fn(db as any));
  });

  afterEach(() => {
    jest.clearAllMocks();
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

  test('vincula la venta a la caja abierta', async () => {
    mockedIdempotencyService.isIdempotencyKeyUsed.mockResolvedValue(false);
    mockedCashRegisterService.getOpenCashRegister.mockResolvedValue({
      id: 1,
      openedAt: new Date(),
      openedBy: 'admin',
      status: 'open',
    } as any);

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

    mockedProductRepository.findById.mockResolvedValue({
      id: 1,
      name: 'Gaseosa',
      type: 'critical_supply',
      criticalSupplyType: 'beverage',
      stock: 50,
      price: 1000,
    } as any);

    (mockedDb.query.recipes.findMany as jest.Mock).mockResolvedValue([]);

    const result = (await confirmSale({
      items: [{ productId: 1, quantity: 1 }],
      paymentMethod: 'cash',
      idempotencyKey: 'abc',
    })) as { cashRegisterId: number | null };

    expect(result.cashRegisterId).toBe(1);
  });
});
