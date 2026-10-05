import { getSalesReport } from './reportService';
import * as saleRepository from '@/repositories/saleRepository';
import * as cashRegisterRepository from '@/repositories/cashRegisterRepository';
import type { SaleWithDetails } from '@/repositories/saleRepository';

jest.mock('@/repositories/saleRepository');
jest.mock('@/repositories/cashRegisterRepository');

const mockedSaleRepository = saleRepository as jest.Mocked<
  typeof saleRepository
>;
const mockedCashRegisterRepository = cashRegisterRepository as jest.Mocked<
  typeof cashRegisterRepository
>;

const BRANCH_ID = 1;
const START = new Date('2026-10-01T00:00:00.000Z');
const END = new Date('2026-10-05T00:00:00.000Z');

function buildSale(overrides: Partial<SaleWithDetails>): SaleWithDetails {
  return {
    id: 1,
    branchId: BRANCH_ID,
    total: 100,
    paymentMethod: 'cash',
    status: 'active',
    cashRegisterId: 5,
    idempotencyKey: null,
    createdAt: new Date('2026-10-02T12:00:00.000Z'),
    cancelledAt: null,
    cancellationReason: null,
    items: [],
    payments: [],
    cashRegister: null,
    ...overrides,
  } as SaleWithDetails;
}

function salesPage(items: SaleWithDetails[], limit = 500) {
  return {
    items,
    total: items.length,
    page: 1,
    limit,
  };
}

describe('reportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSaleRepository.findByDateRange.mockResolvedValue(salesPage([]));
    mockedCashRegisterRepository.findInRange.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 500,
    } as never);
  });

  describe('getSalesReport', () => {
    test('devuelve ceros en un período sin ventas ni cajas', async () => {
      const report = await getSalesReport(BRANCH_ID, START, END);

      expect(report.totals).toEqual({
        total: 0,
        cashTotal: 0,
        transferTotal: 0,
        salesCount: 0,
        cancelledSalesCount: 0,
        cashRegistersCount: 0,
        cashDifference: 0,
        transferDifference: 0,
      });
      expect(report.byDay).toEqual([]);
      expect(report.byProduct).toEqual([]);
      expect(report.cashRegisters).toEqual([]);
      expect(report.range).toEqual({
        start: START.toISOString(),
        end: END.toISOString(),
      });
    });

    test('consolida totales por método y separa ventas anuladas', async () => {
      mockedSaleRepository.findByDateRange.mockResolvedValue(
        salesPage([
          buildSale({
            id: 1,
            total: 1000,
            payments: [
              { id: 1, saleId: 1, method: 'cash', amount: 400, createdAt: new Date() },
              { id: 2, saleId: 1, method: 'transfer', amount: 600, createdAt: new Date() },
            ] as never,
          }),
          buildSale({
            id: 2,
            total: 500,
            paymentMethod: 'transfer',
          }),
          buildSale({
            id: 3,
            total: 999,
            status: 'cancelled',
            paymentMethod: 'cash',
          }),
        ])
      );

      const report = await getSalesReport(BRANCH_ID, START, END);

      expect(report.totals.total).toBe(1500);
      expect(report.totals.cashTotal).toBe(400);
      expect(report.totals.transferTotal).toBe(1100);
      expect(report.totals.salesCount).toBe(2);
      expect(report.totals.cancelledSalesCount).toBe(1);
    });

    test('agrupa por día calendario de la timezone de la sucursal', async () => {
      // 2026-10-03 02:30 UTC = 2026-10-02 23:30 en America/Argentina/Buenos_Aires.
      mockedSaleRepository.findByDateRange.mockResolvedValue(
        salesPage([
          buildSale({
            id: 1,
            total: 100,
            createdAt: new Date('2026-10-03T02:30:00.000Z'),
          }),
          buildSale({
            id: 2,
            total: 200,
            paymentMethod: 'transfer',
            createdAt: new Date('2026-10-03T15:00:00.000Z'),
          }),
        ])
      );

      const report = await getSalesReport(BRANCH_ID, START, END);

      expect(report.byDay).toEqual([
        {
          date: '2026-10-02',
          total: 100,
          cashTotal: 100,
          transferTotal: 0,
          salesCount: 1,
        },
        {
          date: '2026-10-03',
          total: 200,
          cashTotal: 0,
          transferTotal: 200,
          salesCount: 1,
        },
      ]);
    });

    test('agrega productos por nombre y suma cantidad y subtotal', async () => {
      const items = (saleId: number) =>
        [
          {
            id: saleId * 10,
            saleId,
            productId: 10,
            quantity: 2,
            unitPrice: 1000,
            subtotal: 2000,
            notes: null,
            product: { id: 10, name: 'Pancho' },
            recipeSnapshots: [],
          },
          {
            id: saleId * 10 + 1,
            saleId,
            productId: 11,
            quantity: 1,
            unitPrice: 500,
            subtotal: 500,
            notes: null,
            product: { id: 11, name: 'Gaseosa' },
            recipeSnapshots: [],
          },
        ] as unknown as SaleWithDetails['items'];

      mockedSaleRepository.findByDateRange.mockResolvedValue(
        salesPage([
          buildSale({ id: 1, total: 2500, items: items(1) }),
          buildSale({ id: 2, total: 2500, items: items(2) }),
        ])
      );

      const report = await getSalesReport(BRANCH_ID, START, END);

      expect(report.byProduct).toEqual([
        { name: 'Pancho', quantity: 4, total: 4000 },
        { name: 'Gaseosa', quantity: 2, total: 1000 },
      ]);
    });

    test('cuenta ventas sin caja asociada (cashRegisterId null)', async () => {
      mockedSaleRepository.findByDateRange.mockResolvedValue(
        salesPage([
          buildSale({ id: 1, total: 300, cashRegisterId: null }),
        ])
      );

      const report = await getSalesReport(BRANCH_ID, START, END);

      expect(report.totals.total).toBe(300);
      expect(report.totals.salesCount).toBe(1);
    });

    test('recorre todas las páginas de ventas', async () => {
      const first = Array.from({ length: 500 }, (_, i) =>
        buildSale({ id: i + 1, total: 1 })
      );
      mockedSaleRepository.findByDateRange
        .mockResolvedValueOnce(salesPage(first, 500))
        .mockResolvedValueOnce(salesPage([buildSale({ id: 999, total: 1 })], 500));

      const report = await getSalesReport(BRANCH_ID, START, END);

      expect(mockedSaleRepository.findByDateRange).toHaveBeenCalledTimes(2);
      expect(report.totals.salesCount).toBe(501);
      expect(report.totals.total).toBe(501);
    });

    test('lista cajas del rango y suma diferencias de arqueo', async () => {
      mockedCashRegisterRepository.findInRange.mockResolvedValue({
        items: [
          {
            id: 7,
            status: 'closed',
            openedAt: new Date('2026-10-02T10:00:00.000Z'),
            closedAt: new Date('2026-10-02T22:00:00.000Z'),
            total: 1000,
            cashTotal: 800,
            transferTotal: 200,
            totalSales: 4,
            closingDifference: 50,
            closingTransferDifference: -20,
          },
          {
            id: 8,
            status: 'open',
            openedAt: new Date('2026-10-04T10:00:00.000Z'),
            closedAt: null,
            total: 0,
            cashTotal: 0,
            transferTotal: 0,
            totalSales: 0,
            closingDifference: null,
            closingTransferDifference: null,
          },
        ],
        total: 2,
        page: 1,
        limit: 500,
      } as never);

      const report = await getSalesReport(BRANCH_ID, START, END);

      expect(report.totals.cashRegistersCount).toBe(2);
      expect(report.totals.cashDifference).toBe(50);
      expect(report.totals.transferDifference).toBe(-20);
      expect(report.cashRegisters).toHaveLength(2);
      expect(report.cashRegisters[0].id).toBe(7);
    });
  });
});
