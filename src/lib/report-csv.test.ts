import { buildSalesReportCsv } from './report-csv';
import type { SalesReport } from '@/application/services/reportService';

function buildReport(overrides: Partial<SalesReport> = {}): SalesReport {
  return {
    range: {
      start: '2026-10-01T00:00:00.000Z',
      end: '2026-10-05T00:00:00.000Z',
    },
    totals: {
      total: 1500,
      cashTotal: 900,
      transferTotal: 600,
      salesCount: 3,
      cancelledSalesCount: 1,
      cashRegistersCount: 2,
      cashDifference: -50,
      transferDifference: 0,
    },
    byDay: [
      {
        date: '2026-10-02',
        total: 1000,
        cashTotal: 600,
        transferTotal: 400,
        salesCount: 2,
      },
    ],
    byProduct: [
      { name: 'Pancho;Grande', quantity: 4, total: 4000 },
      { name: 'Gaseosa', quantity: 2, total: 1000 },
    ],
    cashRegisters: [
      {
        id: 7,
        status: 'closed',
        openedAt: new Date('2026-10-02T10:00:00.000Z'),
        closedAt: new Date('2026-10-02T22:00:00.000Z'),
        total: 1000,
        cashTotal: 800,
        transferTotal: 200,
        totalSales: 4,
        closingDifference: -50,
        closingTransferDifference: null,
      },
    ],
    ...overrides,
  };
}

describe('buildSalesReportCsv', () => {
  test('genera las cuatro secciones con separador punto y coma', () => {
    const csv = buildSalesReportCsv(buildReport());
    const lines = csv.split('\n');

    expect(lines[0]).toBe('RESUMEN');
    expect(lines).toContain('VENTAS POR DÍA');
    expect(lines).toContain('VENTAS POR PRODUCTO');
    expect(lines).toContain('CAJAS DEL PERÍODO');
    expect(csv).toContain('Total vendido;1500');
    expect(csv).toContain('Ventas anuladas;1');
    expect(csv).toContain('2026-10-02;2;1000;600;400');
  });

  test('escapa celdas que contienen el separador o comillas', () => {
    const csv = buildSalesReportCsv(buildReport());

    // 'Pancho;Grande' debe quedar entre comillas para no romper la columna.
    expect(csv).toContain('"Pancho;Grande";4;4000');
  });

  test('renderiza campos vacíos sin separadores extra', () => {
    const csv = buildSalesReportCsv(buildReport());
    // La diferencia de transferencia null se exporta vacía.
    expect(csv).toMatch(/;Cerrada;4;1000;800;200;-50;$/m);
  });
});
