import type { SalesReport } from '@/application/services/reportService';
import { formatDateTime } from '@/lib/date';

/**
 * Escapa una celda CSV: envuelve en comillas si contiene separador, comillas
 * o salto de línea, y duplica las comillas internas.
 */
function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function row(...cells: (string | number | null | undefined)[]): string {
  return cells.map(csvCell).join(';');
}

/**
 * Genera el CSV del reporte de ventas con secciones: resumen, por día, por
 * producto y por caja. Separador `;` (convención es-AR de Excel) y decimales
 * con `.` consistentes con el resto de la app.
 */
export function buildSalesReportCsv(report: SalesReport): string {
  const lines: string[] = [];

  lines.push('RESUMEN');
  lines.push(row('Desde', formatDateTime(report.range.start)));
  lines.push(row('Hasta', formatDateTime(report.range.end)));
  lines.push(row('Total vendido', report.totals.total));
  lines.push(row('Efectivo', report.totals.cashTotal));
  lines.push(row('Transferencia', report.totals.transferTotal));
  lines.push(row('Ventas', report.totals.salesCount));
  lines.push(row('Ventas anuladas', report.totals.cancelledSalesCount));
  lines.push(row('Cajas en el período', report.totals.cashRegistersCount));
  lines.push(row('Diferencia efectivo (arqueo)', report.totals.cashDifference));
  lines.push(
    row('Diferencia transferencia (arqueo)', report.totals.transferDifference)
  );
  lines.push('');

  lines.push('VENTAS POR DÍA');
  lines.push(row('Fecha', 'Ventas', 'Total', 'Efectivo', 'Transferencia'));
  for (const day of report.byDay) {
    lines.push(
      row(day.date, day.salesCount, day.total, day.cashTotal, day.transferTotal)
    );
  }
  lines.push('');

  lines.push('VENTAS POR PRODUCTO');
  lines.push(row('Producto', 'Cantidad', 'Total'));
  for (const product of report.byProduct) {
    lines.push(row(product.name, product.quantity, product.total));
  }
  lines.push('');

  lines.push('CAJAS DEL PERÍODO');
  lines.push(
    row(
      'Caja',
      'Apertura',
      'Cierre',
      'Estado',
      'Ventas',
      'Total',
      'Efectivo',
      'Transferencia',
      'Dif. efectivo',
      'Dif. transferencia'
    )
  );
  for (const cr of report.cashRegisters) {
    lines.push(
      row(
        cr.id,
        formatDateTime(cr.openedAt),
        formatDateTime(cr.closedAt),
        cr.status === 'open' ? 'Abierta' : 'Cerrada',
        cr.totalSales,
        cr.total,
        cr.cashTotal,
        cr.transferTotal,
        cr.closingDifference ?? '',
        cr.closingTransferDifference ?? ''
      )
    );
  }

  return lines.join('\n');
}
