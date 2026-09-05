import {
  calculateCompoundAvailability,
  calculateSummaryFromSales,
} from './summaryService';
import { findRecipesForProducts, groupRecipesByProduct } from '@/lib/recipe-helpers';
import { db } from '@/db';
import * as money from '@/lib/money';

jest.mock('@/db', () => ({
  db: {
    query: {
      recipes: {
        findMany: jest.fn(),
      },
      products: {
        findMany: jest.fn(),
      },
    },
  },
}));

jest.mock('@/lib/money', () => ({
  addMoney: jest.fn((a: any, b: any) => ({
    amount: (a?.amount ?? 0) + (b?.amount ?? 0),
    currency: a?.currency ?? b?.currency,
  })),
  moneyToNumber: jest.fn((m: any) => m?.amount ?? 0),
  parseMoney: jest.fn((amount: number) => ({ amount, currency: 'ARS' })),
}));

const mockedDb = db as unknown as {
  query: {
    recipes: { findMany: jest.Mock };
    products: { findMany: jest.Mock };
  };
};

const BRANCH_ID = 1;

describe('summaryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findRecipesForProducts', () => {
    test('devuelve recetas filtradas por branchId', async () => {
      mockedDb.query.recipes.findMany.mockResolvedValue([
        {
          compoundProductId: 1,
          supplyId: 2,
          quantity: 1,
          autoDiscount: true,
          supply: { id: 2, branchId: BRANCH_ID, name: 'Pan' },
        },
        {
          compoundProductId: 1,
          supplyId: 3,
          quantity: 2,
          autoDiscount: true,
          supply: { id: 3, branchId: 999, name: 'Otra' },
        },
      ]);

      const result = await findRecipesForProducts(BRANCH_ID, [1], db);

      expect(result).toHaveLength(1);
      expect(result[0].supply?.name).toBe('Pan');
    });

    test('devuelve array vacío si no hay productos compuestos', async () => {
      const result = await findRecipesForProducts(BRANCH_ID, [], db);
      expect(result).toEqual([]);
      expect(mockedDb.query.recipes.findMany).not.toHaveBeenCalled();
    });
  });

  describe('groupRecipesByProduct', () => {
    test('agrupa recetas por compoundProductId', () => {
      const recipes = [
        { compoundProductId: 1, supplyId: 2, quantity: 1, autoDiscount: true },
        { compoundProductId: 1, supplyId: 3, quantity: 2, autoDiscount: true },
        { compoundProductId: 2, supplyId: 4, quantity: 1, autoDiscount: false },
      ] as any;

      const result = groupRecipesByProduct(recipes);

      expect(result.get(1)).toHaveLength(2);
      expect(result.get(2)).toHaveLength(1);
    });
  });

  describe('calculateCompoundAvailability', () => {
    test('devuelve 0 si no hay insumos críticos con autoDiscount', () => {
      const result = calculateCompoundAvailability([
        { supplyId: 1, quantity: 1, autoDiscount: false },
      ] as any);
      expect(result).toBe(0);
    });

    test('calcula disponibilidad con stock de los insumos', () => {
      const recipeItems = [
        { supplyId: 1, quantity: 1, autoDiscount: true, supply: { stock: 10 } },
        { supplyId: 2, quantity: 2, autoDiscount: true, supply: { stock: 8 } },
      ] as any;

      const result = calculateCompoundAvailability(recipeItems);

      expect(result).toBe(4);
    });

    test('considera stock ya consumido', () => {
      const recipeItems = [
        { supplyId: 1, quantity: 1, autoDiscount: true, supply: { stock: 10 } },
      ] as any;

      const result = calculateCompoundAvailability(recipeItems, { 1: 10 }, { 1: 3 });

      expect(result).toBe(7);
    });

    test('usa stockBySupplyId cuando no hay supply.stock', () => {
      const recipeItems = [
        { supplyId: 1, quantity: 1, autoDiscount: true, supply: null },
      ] as any;

      const result = calculateCompoundAvailability(recipeItems, { 1: 50 });

      expect(result).toBe(50);
    });
  });

  describe('calculateSummaryFromSales', () => {
    test('calcula totales y resúmenes', async () => {
      const activeSales = [
        {
          total: 1500,
          payments: [{ method: 'cash' as const, amount: 1500 }],
          items: [
            {
              quantity: 1,
              product: {
                id: 1,
                name: 'Promo',
                type: 'compound',
                criticalSupplyType: null,
              },
            },
          ],
        },
        {
          total: 800,
          payments: [{ method: 'transfer' as const, amount: 800 }],
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
      ];

      mockedDb.query.recipes.findMany.mockResolvedValue([
        {
          compoundProductId: 1,
          supplyId: 2,
          quantity: 1,
          autoDiscount: true,
          supply: { id: 2, branchId: BRANCH_ID, name: 'Pan' },
        },
        {
          compoundProductId: 1,
          supplyId: 3,
          quantity: 2,
          autoDiscount: true,
          supply: { id: 3, branchId: BRANCH_ID, name: 'Salchicha' },
        },
      ]);

      mockedDb.query.products.findMany.mockResolvedValue([
        {
          id: 2,
          branchId: BRANCH_ID,
          name: 'Pan',
          type: 'critical_supply',
          isActive: true,
        },
        {
          id: 3,
          branchId: BRANCH_ID,
          name: 'Salchicha',
          type: 'critical_supply',
          isActive: true,
        },
        {
          id: 4,
          branchId: BRANCH_ID,
          name: 'Gaseosa',
          type: 'critical_supply',
          isActive: true,
        },
      ]);

      const result = await calculateSummaryFromSales(BRANCH_ID, activeSales as any, db);

      expect(result.totalSales).toBe(2);
      expect(result.productsSummary).toEqual({
        Promo: 1,
        Gaseosa: 2,
      });
      expect(result.criticalSuppliesSummary).toEqual({
        Pan: 1,
        Salchicha: 2,
        Gaseosa: 2,
      });
    });

    test('calcula totales con pago mixto en una sola venta', async () => {
      const activeSales = [
        {
          total: 2000,
          payments: [
            { method: 'cash' as const, amount: 500 },
            { method: 'transfer' as const, amount: 1500 },
          ],
          items: [],
        },
      ];

      mockedDb.query.recipes.findMany.mockResolvedValue([]);
      mockedDb.query.products.findMany.mockResolvedValue([]);

      const result = await calculateSummaryFromSales(
        BRANCH_ID,
        activeSales as any,
        db
      );

      expect(result.totalSales).toBe(1);
      expect(result.total).toBe(2000);
      expect(result.cashTotal).toBe(500);
      expect(result.transferTotal).toBe(1500);
    });

    test('maneja ventas sin items', async () => {
      const activeSales = [
        { total: 500, payments: [{ method: 'cash' as const, amount: 500 }], items: [] },
      ];

      mockedDb.query.recipes.findMany.mockResolvedValue([]);
      mockedDb.query.products.findMany.mockResolvedValue([]);

      const result = await calculateSummaryFromSales(BRANCH_ID, activeSales as any, db);

      expect(result.totalSales).toBe(1);
      expect(result.productsSummary).toEqual({});
      expect(result.criticalSuppliesSummary).toEqual({});
    });
  });
});
