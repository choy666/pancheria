import * as auditRepository from '@/repositories/auditRepository';
import { getOrderExpirationMs } from '@/config/orders';
import { getCajaOverdueHours } from '@/config/caja';
import {
  getSanityAuditSampleLimit,
  getSanityAuditStalePendingMaxAgeHours,
} from '@/config/audit';
import { nowUTC } from '@/lib/date';

/**
 * Auditoría de cordura de solo lectura (`GET /api/cron/sanity-audit`).
 * Recorre invariantes operativas del dominio y devuelve hallazgos con
 * severidad para que un scheduler externo (sanity-audit.yml) pueda
 * archivarlos y alertar. No escribe en la base de datos.
 *
 * Severidades:
 * - `critical`: integridad rota (stock negativo, reserva huérfana, pedido
 *   pagado sin venta). El workflow falla cuando hay al menos uno.
 * - `warning`: situación anómala pero autocorregible o esperable (pending
 *   vencido sin barrer por más del umbral, caja abierta vieja, stock bajo,
 *   ítem compuesto sin snapshot — el reintegro usa la receta vigente).
 * - `info`: informativo.
 */

type SanityAuditSeverity = 'info' | 'warning' | 'critical';

type SanityAuditFinding = {
  code: string;
  severity: SanityAuditSeverity;
  count: number;
  detail: string;
  sample?: unknown;
};

export type SanityAuditReport = {
  generatedAt: string;
  thresholds: Record<string, number>;
  findings: SanityAuditFinding[];
  metrics: Record<string, unknown>;
};

export async function runSanityAudit(): Promise<SanityAuditReport> {
  const now = nowUTC();
  const orderExpirationMs = getOrderExpirationMs();
  const stalePendingMaxAgeHours = getSanityAuditStalePendingMaxAgeHours();
  const cajaOverdueHours = getCajaOverdueHours();
  const sampleLimit = getSanityAuditSampleLimit();

  const expiredCutoff = new Date(now.getTime() - orderExpirationMs);
  const staleCutoff = new Date(now.getTime() - stalePendingMaxAgeHours * 3_600_000);
  const overdueCutoff = new Date(now.getTime() - cajaOverdueHours * 3_600_000);
  const last24h = new Date(now.getTime() - 24 * 3_600_000);

  const [
    expiredPending,
    openCashRegisters,
    negativeStock,
    lowStock,
    orphanReservations,
    paidWithoutSale,
    compoundSaleItemsMissingSnapshot,
    compoundOrderItemsMissingSnapshot,
    ordersByStatus24h,
    salesByStatus24h,
    movementsByType24h,
    rateLimitRows,
    loginAttemptRows,
    branchesByActive,
  ] = await Promise.all([
    auditRepository.getExpiredPendingStats(expiredCutoff, staleCutoff),
    auditRepository.listOpenCashRegisters(),
    auditRepository.findNegativeStockProducts(sampleLimit),
    auditRepository.findLowStockProducts(sampleLimit),
    auditRepository.findOrphanReservations(sampleLimit),
    auditRepository.findPaidOrdersWithoutSale(sampleLimit),
    auditRepository.countCompoundSaleItemsMissingSnapshot(),
    auditRepository.countCompoundOrderItemsMissingSnapshot(),
    auditRepository.countOrdersByStatusSince(last24h),
    auditRepository.sumSalesByStatusSince(last24h),
    auditRepository.countStockMovementsByTypeSince(last24h),
    auditRepository.countRateLimitRows(),
    auditRepository.countLoginAttemptRows(),
    auditRepository.countBranchesByActive(),
  ]);

  const findings: SanityAuditFinding[] = [];

  // Un pending vencido sin barrer es esperable entre corridas del scheduler
  // (~3-9 h reales): solo escala a warning cuando el más viejo supera el
  // umbral configurado — ahí el scheduler probablemente está roto.
  if (expiredPending.count > 0) {
    findings.push({
      code: 'expired_pending_unswept',
      severity: expiredPending.staleCount > 0 ? 'warning' : 'info',
      count: expiredPending.count,
      detail:
        `Pedidos 'pending' vencidos sin barrer (más antiguo: ` +
        `${expiredPending.oldestCreatedAt?.toISOString() ?? 'desconocido'}; ` +
        `${expiredPending.staleCount} superan ${stalePendingMaxAgeHours} h).`,
    });
  }

  const overdueCashRegisters = openCashRegisters.filter(
    (cashRegister) => cashRegister.openedAt < overdueCutoff
  );
  if (overdueCashRegisters.length > 0) {
    findings.push({
      code: 'open_cash_register_overdue',
      severity: 'warning',
      count: overdueCashRegisters.length,
      detail: `Cajas abiertas hace más de ${cajaOverdueHours} h.`,
      sample: overdueCashRegisters.map((cashRegister) => ({
        id: cashRegister.id,
        branchId: cashRegister.branchId,
        openedAt: cashRegister.openedAt.toISOString(),
      })),
    });
  }

  if (negativeStock.length > 0) {
    findings.push({
      code: 'negative_stock',
      severity: 'critical',
      count: negativeStock.length,
      detail: 'Productos con stock negativo (debería ser imposible por CHECK).',
      sample: negativeStock,
    });
  }

  if (lowStock.length > 0) {
    findings.push({
      code: 'low_stock',
      severity: 'warning',
      count: lowStock.length,
      detail: 'Productos activos con stock <= min_stock (min_stock > 0).',
      sample: lowStock,
    });
  }

  if (orphanReservations.length > 0) {
    findings.push({
      code: 'orphan_reservations',
      severity: 'critical',
      count: orphanReservations.length,
      detail:
        `Reservas de stock de pedidos que no están 'in_process' ` +
        `(deberían haberse liberado).`,
      sample: orphanReservations,
    });
  }

  if (paidWithoutSale.length > 0) {
    findings.push({
      code: 'paid_order_without_sale',
      severity: 'critical',
      count: paidWithoutSale.length,
      detail:
        `Pedidos 'paid' sin converted_sale_id: cobrados sin venta viva ` +
        `(rama legada; cancelarlos no toca caja ni stock).`,
      sample: paidWithoutSale,
    });
  }

  if (compoundSaleItemsMissingSnapshot > 0) {
    findings.push({
      code: 'compound_sale_item_missing_snapshot',
      severity: 'warning',
      count: compoundSaleItemsMissingSnapshot,
      detail:
        'Ítems de venta de productos compuestos sin snapshot de receta ' +
        '(típico de ventas anteriores a la migración de snapshots): al ' +
        'anularse, el reintegro usa la receta vigente, que pudo haber ' +
        'cambiado desde la venta.',
    });
  }

  if (compoundOrderItemsMissingSnapshot > 0) {
    findings.push({
      code: 'compound_order_item_missing_snapshot',
      severity: 'warning',
      count: compoundOrderItemsMissingSnapshot,
      detail:
        'Ítems de pedido de productos compuestos sin snapshot de receta ' +
        '(receiveOrder los reconstruye defensivamente).',
    });
  }

  return {
    generatedAt: now.toISOString(),
    thresholds: {
      orderExpirationMs,
      stalePendingMaxAgeHours,
      cajaOverdueHours,
      sampleLimit,
    },
    findings,
    metrics: {
      openCashRegisters: openCashRegisters.map((cashRegister) => ({
        id: cashRegister.id,
        branchId: cashRegister.branchId,
        openedAt: cashRegister.openedAt.toISOString(),
      })),
      branchesByActive,
      ordersByStatusLast24h: ordersByStatus24h,
      salesByStatusLast24h: salesByStatus24h,
      stockMovementsByTypeLast24h: movementsByType24h,
      publicOrderRateLimitRows: rateLimitRows,
      loginAttemptRows,
    },
  };
}
