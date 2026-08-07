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
    },
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
  };
};

const mockedExecuteInTransaction = executeInTransaction as jest.MockedFunction<
  typeof executeInTransaction
>;

function createMockTransaction() {
  const insertReturning = jest.fn().mockResolvedValue([]);
  const insertValues = jest
    .fn()
    .mockImplementation((values: any) => {
      insertReturning.mockResolvedValue([values]);
      return { returning: insertReturning };
    });
  const insert = jest.fn().mockReturnValue({ values: insertValues });

  return { insert, insertValues, insertReturning };
}

describe('closureService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateClosure', () => {
    test('rechaza generar un cierre duplicado', async () => {
      const date = new Date(2026, 4, 10);
      mockedDb.query.dailyClosures.findFirst.mockResolvedValue({
        id: 99,
        date,
      } as any);

      await expect(generateClosure(date)).rejects.toThrow(ValidationError);
      await expect(generateClosure(date)).rejects.toThrow(
        'Ya existe un cierre para la fecha seleccionada.'
      );
      expect(mockedDb.query.sales.findMany).not.toHaveBeenCalled();
      expect(mockedExecuteInTransaction).not.toHaveBeenCalled();
    });

    test('calcula totales, resumen de productos e insumos críticos', async () => {
      const date = new Date(2026, 4, 10);
      mockedDb.query.dailyClosures.findFirst.mockResolvedValue(undefined);

      mockedDb.query.sales.findMany.mockResolvedValue([
        {
          id: 1,
          total: 1500,
          paymentMethod: 'cash',
          status: 'active',
          cashRegisterId: 1,
          createdAt: new Date(2026, 4, 10, 12, 0),
          items: [
            {
              quantity: 1,
              product: {
                id: 1,
                name: 'Panchuque',
                type: 'compound',
              },
            },
          ],
        },
        {
          id: 2,
          total: 800,
          paymentMethod: 'transfer',
          status: 'active',
          cashRegisterId: 1,
          createdAt: new Date(2026, 4, 10, 13, 0),
          items: [
            {
              quantity: 2,
              product: {
                id: 3,
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
        { id: 2, name: 'Pan', type: 'critical_supply', isActive: true },
        { id: 4, name: 'Salchicha', type: 'critical_supply', isActive: true },
      ] as any);

      const mockTx = createMockTransaction();
      mockedExecuteInTransaction.mockImplementation(async (fn: any) => {
        return await fn(mockTx as any);
      });

      const result = await generateClosure(date);

      expect(result.total).toBe(2300);
      expect(result.cashTotal).toBe(1500);
      expect(result.transferTotal).toBe(800);
      expect(result.totalSales).toBe(2);

      const productsSummary = JSON.parse(result.productsSummary as string);
      expect(productsSummary).toEqual({
        Panchuque: 1,
        Gaseosa: 2,
      });

      const criticalSuppliesSummary = JSON.parse(
        result.criticalSuppliesSummary as string
      );
      expect(criticalSuppliesSummary).toEqual({
        Pan: 1,
        Gaseosa: 2,
        Salchicha: 0,
      });

      expect(mockTx.insert).toHaveBeenCalled();
    });
  });

  describe('getClosureByDate', () => {
    test('devuelve el cierre de una fecha determinada', async () => {
      const date = new Date(2026, 4, 10);
      const expectedClosure = {
        id: 1,
        date: new Date(2026, 4, 10, 0, 0, 0),
        total: 2300,
        totalSales: 2,
      };
      mockedDb.query.dailyClosures.findFirst.mockResolvedValue(
        expectedClosure as any
      );

      const result = await getClosureByDate(date);

      expect(result).toEqual(expectedClosure);
      expect(mockedDb.query.dailyClosures.findFirst).toHaveBeenCalled();
    });

    test('devuelve undefined si no hay cierre para la fecha', async () => {
      mockedDb.query.dailyClosures.findFirst.mockResolvedValue(undefined);

      const result = await getClosureByDate(new Date(2026, 4, 10));

      expect(result).toBeUndefined();
    });
  });

  describe('listClosures', () => {
    test('devuelve la lista de cierres en un rango de fechas', async () => {
      const closures = [
        { id: 1, date: new Date(2026, 4, 10) },
        { id: 2, date: new Date(2026, 4, 9) },
      ];
      mockedDb.query.dailyClosures.findMany.mockResolvedValue(closures as any);

      const result = await listClosures(
        new Date(2026, 4, 9),
        new Date(2026, 4, 10)
      );

      expect(result).toEqual(closures);
      expect(mockedDb.query.dailyClosures.findMany).toHaveBeenCalled();
    });
  });
});
