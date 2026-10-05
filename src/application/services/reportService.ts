import { addMoney, moneyToNumber, parseMoney } from '@/lib/money';
import { dateKeyInTimezone } from '@/lib/date';
import * as saleRepository from '@/repositories/saleRepository';
import * as cashRegisterRepository from '@/repositories/cashRegisterRepository';
import type { SaleWithDetails } from '@/repositories/saleRepository';

const REPORT_PAGE_SIZE = 500;

type SalesReportDay = {
  date: string;
  total: number;
  cashTotal: number;
  transferTotal: number;
  salesCount: number;
};

type SalesReportProduct = {
  name: string;
  quantity: number;
  total: number;
};

type SalesReportCashRegister = {
  id: number;
  status: string;
  openedAt: Date;
  closedAt: Date | null;
  total: number;
  cashTotal: number;
  transferTotal: number;
  totalSales: number;
  closingDifference: number | null;
  closingTransferDifference: number | null;
};

export type SalesReport = {
  range: { start: string; end: string };
  totals: {
    total: number;
    cashTotal: number;
    transferTotal: number;
    salesCount: number;
    cancelledSalesCount: number;
    cashRegistersCount: number;
    cashDifference: number;
    transferDifference: number;
  };
  byDay: SalesReportDay[];
  byProduct: SalesReportProduct[];
  cashRegisters: SalesReportCashRegister[];
};

type DayAccumulator = {
  total: ReturnType<typeof parseMoney>;
  cashTotal: ReturnType<typeof parseMoney>;
  transferTotal: ReturnType<typeof parseMoney>;
  salesCount: number;
};

type ProductAccumulator = {
  quantity: number;
  total: ReturnType<typeof parseMoney>;
};

/**
 * Consolidación contable del período para el administrador.
 *
 * Los totales de dinero salen de `sales` por `createdAt` dentro del rango —
 * no por join a `cash_registers`, porque `sales.cash_register_id` queda en
 * NULL si la caja se elimina (`onDelete: 'set null'`). Solo las ventas
 * `active` suman dinero; las `cancelled` se cuentan aparte. El desglose por
 * día agrupa por el día calendario de la timezone de la sucursal.
 */
export async function getSalesReport(
  branchId: number,
  start: Date,
  end: Date
): Promise<SalesReport> {
  let total = parseMoney(0);
  let cashTotal = parseMoney(0);
  let transferTotal = parseMoney(0);
  let salesCount = 0;
  let cancelledSalesCount = 0;

  const byDay = new Map<string, DayAccumulator>();
  const byProduct = new Map<string, ProductAccumulator>();

  for (let page = 1; ; page += 1) {
    const result = await saleRepository.findByDateRange(branchId, start, end, undefined, {
      page,
      limit: REPORT_PAGE_SIZE,
    });
    if (result.items.length === 0) break;

    // `findByDateRange` tipa como `SalePublicRow`, pero la consulta incluye
    // `items`/`payments`/`cashRegister` (mismas relaciones que
    // `SaleWithDetails`), así que el cast refleja el runtime real.
    for (const sale of result.items as unknown as SaleWithDetails[]) {
      if (sale.status === 'cancelled') {
        cancelledSalesCount += 1;
        continue;
      }

      salesCount += 1;
      total = addMoney(total, parseMoney(sale.total));

      const dayKey = dateKeyInTimezone(sale.createdAt);
      let day = byDay.get(dayKey);
      if (!day) {
        day = {
          total: parseMoney(0),
          cashTotal: parseMoney(0),
          transferTotal: parseMoney(0),
          salesCount: 0,
        };
        byDay.set(dayKey, day);
      }
      day.salesCount += 1;
      day.total = addMoney(day.total, parseMoney(sale.total));

      let saleCash = parseMoney(0);
      let saleTransfer = parseMoney(0);
      if (sale.payments && sale.payments.length > 0) {
        for (const payment of sale.payments) {
          const amount = parseMoney(payment.amount);
          if (payment.method === 'cash') {
            saleCash = addMoney(saleCash, amount);
          } else {
            saleTransfer = addMoney(saleTransfer, amount);
          }
        }
      } else if (sale.paymentMethod === 'cash') {
        saleCash = parseMoney(sale.total);
      } else {
        saleTransfer = parseMoney(sale.total);
      }
      cashTotal = addMoney(cashTotal, saleCash);
      transferTotal = addMoney(transferTotal, saleTransfer);
      day.cashTotal = addMoney(day.cashTotal, saleCash);
      day.transferTotal = addMoney(day.transferTotal, saleTransfer);

      for (const item of sale.items ?? []) {
        const name = item.product?.name ?? `Producto #${item.productId}`;
        const product = byProduct.get(name) ?? {
          quantity: 0,
          total: parseMoney(0),
        };
        product.quantity += item.quantity;
        product.total = addMoney(product.total, parseMoney(item.subtotal));
        byProduct.set(name, product);
      }
    }

    if (result.items.length < REPORT_PAGE_SIZE) break;
  }

  const cashRegisters: SalesReportCashRegister[] = [];
  for (let page = 1; ; page += 1) {
    const result = await cashRegisterRepository.findInRange(
      branchId,
      start,
      end,
      undefined,
      { page, limit: REPORT_PAGE_SIZE }
    );
    if (result.items.length === 0) break;

    for (const cr of result.items) {
      cashRegisters.push({
        id: cr.id,
        status: cr.status,
        openedAt: cr.openedAt,
        closedAt: cr.closedAt,
        total: cr.total ?? 0,
        cashTotal: cr.cashTotal ?? 0,
        transferTotal: cr.transferTotal ?? 0,
        totalSales: cr.totalSales ?? 0,
        closingDifference: cr.closingDifference,
        closingTransferDifference: cr.closingTransferDifference,
      });
    }

    if (result.items.length < REPORT_PAGE_SIZE) break;
  }

  const cashDifference = cashRegisters.reduce(
    (acc, cr) => addMoney(acc, parseMoney(cr.closingDifference ?? 0)),
    parseMoney(0)
  );
  const transferDifference = cashRegisters.reduce(
    (acc, cr) => addMoney(acc, parseMoney(cr.closingTransferDifference ?? 0)),
    parseMoney(0)
  );

  return {
    range: { start: start.toISOString(), end: end.toISOString() },
    totals: {
      total: moneyToNumber(total),
      cashTotal: moneyToNumber(cashTotal),
      transferTotal: moneyToNumber(transferTotal),
      salesCount,
      cancelledSalesCount,
      cashRegistersCount: cashRegisters.length,
      cashDifference: moneyToNumber(cashDifference),
      transferDifference: moneyToNumber(transferDifference),
    },
    byDay: Array.from(byDay.entries())
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([date, day]) => ({
        date,
        total: moneyToNumber(day.total),
        cashTotal: moneyToNumber(day.cashTotal),
        transferTotal: moneyToNumber(day.transferTotal),
        salesCount: day.salesCount,
      })),
    byProduct: Array.from(byProduct.entries())
      .map(([name, product]) => ({
        name,
        quantity: product.quantity,
        total: moneyToNumber(product.total),
      }))
      .sort((a, b) => b.total - a.total || b.quantity - a.quantity),
    cashRegisters,
  };
}
