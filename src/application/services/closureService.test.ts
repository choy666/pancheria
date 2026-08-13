import {
  generateClosure,
  getClosureByDate,
  listClosures,
} from './closureService';
import { db } from '@/db';
import { executeInTransaction } from '@/application/transactionService';
import { ValidationError } from '@/domain/errors';

jest.mock('@/db', () => ({
  db: {
    query: {
      dailyClosures: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      sales: {
        findMany: jest.fn(),
      },
      recipes: {
        findMany: jest.fn(),
      },
      products: {
        findMany: jest.fn(),
      },
      cashRegisters: {
        findMany: jest.fn(),
      },
    },
    select: jest.fn().mockImplementation(() => ({
      from: jest.fn().mockImplementation(() => ({
        where: jest.fn().mockResolvedValue([{ count: 0 }]),
      })),
    })),
  },
}));

jest.mock('@/application/transactionService', () => ({
  executeInTransaction: jest.fn(),
}));

const mockedDb = db as unknown as {
  query: {
    dailyClosures: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
    };
    sales: { findMany: jest.Mock };
    recipes: { findMany: jest.Mock };
    products: { findMany: jest.Mock };
    cashRegisters: { findMany: jest.Mock };
  };
};

const mockedExecuteInTransaction = executeInTransaction as jest.MockedFunction<
  typeof executeInTransaction
>;

const BRANCH_ID = 1;

function createMockTransaction() {
  const insertReturning = jest.fn().mockResolvedValue([]);
  const insertValues = jest
    .fn()
    .mockImplementation((values: any) => {
      insertReturning.mockResolvedValue([values]);
      return { returning: insertReturning };
    });
  const insert = jest.fn().mockReturnValue({ values: insertValues });

  return {
    insert,
    insertValues,
    insertReturning,
    query: mockedDb.query,
  };
}

let mockTx: ReturnType<typeof createMockTransaction>;

describe('closureService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTx = createMockTransaction();
    mockedExecuteInTransaction.mockImplementation(async (fn: any) => {
      return await fn(mockTx as any);
    });
  });

  describe('generateClosure', () => {
    test('rechaza generar un cierre duplicado', async () => {
      const date = new Date(2026, 4, 10);
      mockedDb.query.dailyClosures.findFirst.mockResolvedValue({
        id: 99,
        branchId: BRANCH_ID,
        date,
      } as any);

      await expect(generateClosure(BRANCH_ID, date)).rejects.toThrow(ValidationError);
      await expect(generateClosure(BRANCH_ID, date)).rejects.toThrow(
        'Ya existe un cierre para la fecha seleccionada.'
      );
      expect(mockedDb.query.sales.findMany).not.toHaveBeenCalled();
      expect(mockedDb.query.cashRegisters.findMany).not.toHaveBeenCalled();
      expect(mockedExecuteInTransaction).toHaveBeenCalled();
    });

    test('rechaza generar un cierre para una fecha futura', async () => {
      const date = new Date(2099, 11, 31);
      mockedDb.query.dailyClosures.findFirst.mockResolvedValue(undefined);

      await expect(generateClosure(BRANCH_ID, date)).rejects.toThrow(ValidationError);
      await expect(generateClosure(BRANCH_ID, date)).rejects.toThrow(
        'No se puede generar un cierre para una fecha futura.'
      );
      expect(mockedDb.query.dailyClosures.findFirst).not.toHaveBeenCalled();
    });

    test('rechaza generar un cierre si hay cajas abiertas con ventas', async () => {
      const date = new Date(2026, 4, 10);
      mockedDb.query.dailyClosures.findFirst.mockResolvedValue(undefined);
      mockedDb.query.cashRegisters.findMany.mockResolvedValue([
        {
          id: 1,
          branchId: BRANCH_ID,
          status: 'open',
          sales: [
            {
              id: 1,
              createdAt: new Date(2026, 4, 10, 12, 0),
              status: 'active',
            },
          ],
        },
      ] as any);

      await expect(generateClosure(BRANCH_ID, date)).rejects.toThrow(ValidationError);
      await expect(generateClosure(BRANCH_ID, date)).rejects.toThrow(
        'No se puede generar el cierre porque hay cajas abiertas con ventas de esta fecha.'
      );
      expect(mockedDb.query.sales.findMany).not.toHaveBeenCalled();
    });

    test('calcula totales, resumen de productos e insumos críticos', async () => {
      const date = new Date(2026, 4, 10);
      mockedDb.query.dailyClosures.findFirst.mockResolvedValue(undefined);
      mockedDb.query.cashRegisters.findMany.mockResolvedValue([]);

      mockedDb.query.sales.findMany.mockResolvedValue([
        {
          id: 1,
          branchId: BRANCH_ID,
          total: 1500,
          paymentMethod: 'cash',
          status: 'active',
          cashRegisterId: 1,
          createdAt: new Date(2026, 4, 10, 12, 0),
          cashRegister: { deletedAt: null },
          items: [
            {
              quantity: 1,
              product: {
                id: 1,
                branchId: BRANCH_ID,
                name: 'Panchuque',
                type: 'compound',
              },
            },
          ],
        },
        {
          id: 2,
          branchId: BRANCH_ID,
          total: 800,
          paymentMethod: 'transfer',
          status: 'active',
          cashRegisterId: 1,
          createdAt: new Date(2026, 4, 10, 13, 0),
          cashRegister: { deletedAt: null },
          items: [
            {
              quantity: 2,
              product: {
                id: 3,
                branchId: BRANCH_ID,
                name: 'Gaseosa',
                type: 'critical_supply',
                criticalSupplyType: 'beverage',
              },
            },
          ],
        },
      ] as any);

      mockedDb.query.recipes.findMany.mockResolvedValue([
        {
          id: 1,
          compoundProductId: 1,
          supplyId: 2,
          quantity: 1,
          autoDiscount: true,
          supply: { id: 2, name: 'Pan' },
        },
      ] as any);

      mockedDb.query.products.findMany.mockResolvedValue([
        { id: 2, branchId: BRANCH_ID, name: 'Pan', type: 'critical_supply', isActive: true },
        { id: 4, branchId: BRANCH_ID, name: 'Salchicha', type: 'critical_supply', isActive: true },
      ] as any);

      const result = await generateClosure(BRANCH_ID, date);

      expect(result.total).toBe(2300);
      expect(result.cashTotal).toBe(1500);
      expect(result.transferTotal).toBe(800);
      expect(result.totalSales).toBe(2);

      expect(result.productsSummary).toEqual({
        Panchuque: 1,
        Gaseosa: 2,
      });

      expect(result.criticalSuppliesSummary).toEqual({
        Pan: 1,
        Gaseosa: 2,
        Salchicha: 0,
      });

      expect(mockTx.insert).toHaveBeenCalled();
    });

    test('ignora las ventas de cajas eliminadas al generar un cierre', async () => {
      const date = new Date(2026, 4, 10);
      mockedDb.query.dailyClosures.findFirst.mockResolvedValue(undefined);
      mockedDb.query.cashRegisters.findMany.mockResolvedValue([]);

      mockedDb.query.sales.findMany.mockResolvedValue([
        {
          id: 1,
          branchId: BRANCH_ID,
          total: 1500,
          paymentMethod: 'cash',
          status: 'active',
          cashRegisterId: 1,
          createdAt: new Date(2026, 4, 10, 12, 0),
          cashRegister: { deletedAt: new Date() },
          items: [
            {
              quantity: 1,
              product: {
                id: 1,
                branchId: BRANCH_ID,
                name: 'Panchuque',
                type: 'compound',
              },
            },
          ],
        },
        {
          id: 2,
          branchId: BRANCH_ID,
          total: 800,
          paymentMethod: 'transfer',
          status: 'active',
          cashRegisterId: 2,
          createdAt: new Date(2026, 4, 10, 13, 0),
          cashRegister: { deletedAt: null },
          items: [
            {
              quantity: 1,
              product: {
                id: 3,
                branchId: BRANCH_ID,
                name: 'Gaseosa',
                type: 'critical_supply',
                criticalSupplyType: 'beverage',
              },
            },
          ],
        },
      ] as any);

      mockedDb.query.recipes.findMany.mockResolvedValue([]);

      mockedDb.query.products.findMany.mockResolvedValue([
        { id: 3, branchId: BRANCH_ID, name: 'Gaseosa', type: 'critical_supply', isActive: true },
      ] as any);

      const result = await generateClosure(BRANCH_ID, date);

      expect(result.total).toBe(800);
      expect(result.totalSales).toBe(1);

      expect(result.productsSummary).toEqual({ Gaseosa: 1 });
    });
  });

  describe('getClosureByDate', () => {
    test('devuelve el cierre de una fecha determinada', async () => {
      const date = new Date(2026, 4, 10);
      const expectedClosure = {
        id: 1,
        branchId: BRANCH_ID,
        date: new Date(2026, 4, 10, 0, 0, 0),
        total: 2300,
        totalSales: 2,
      };
      mockedDb.query.dailyClosures.findFirst.mockResolvedValue(
        expectedClosure as any
      );

      const result = await getClosureByDate(BRANCH_ID, date);

      expect(result).toEqual(expectedClosure);
      expect(mockedDb.query.dailyClosures.findFirst).toHaveBeenCalled();
    });

    test('devuelve undefined si no hay cierre para la fecha', async () => {
      mockedDb.query.dailyClosures.findFirst.mockResolvedValue(undefined);

      const result = await getClosureByDate(BRANCH_ID, new Date(2026, 4, 10));

      expect(result).toBeUndefined();
    });
  });

  describe('listClosures', () => {
    test('devuelve la lista de cierres en un rango de fechas', async () => {
      const closures = [
        { id: 1, branchId: BRANCH_ID, date: new Date(2026, 4, 10) },
        { id: 2, branchId: BRANCH_ID, date: new Date(2026, 4, 9) },
      ];
      mockedDb.query.dailyClosures.findMany.mockResolvedValue(closures as any);

      const result = await listClosures(
        BRANCH_ID,
        new Date(2026, 4, 9),
        new Date(2026, 4, 10)
      );

      expect(result.items).toEqual(closures);
      expect(result.total).toBe(0);
      expect(mockedDb.query.dailyClosures.findMany).toHaveBeenCalled();
    });

    test('puede paginar la lista de cierres', async () => {
      const closures = [{ id: 1, branchId: BRANCH_ID, date: new Date(2026, 4, 10) }];
      mockedDb.query.dailyClosures.findMany.mockResolvedValue(closures as any);

      const result = await listClosures(
        BRANCH_ID,
        new Date(2026, 4, 9),
        new Date(2026, 4, 10),
        { page: 2, limit: 5 }
      );

      expect(result.items).toEqual(closures);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(5);
    });
  });
});
