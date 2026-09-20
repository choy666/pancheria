export function getAutoCloseHours(): number {
  const raw = process.env.CAJA_AUTO_CLOSE_HOURS ?? process.env.NEXT_PUBLIC_CAJA_AUTO_CLOSE_HOURS;
  if (!raw) return 0;
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < 0) return 0;
  return parsed;
}

export function getAutoClosedBy(): string {
  return process.env.CAJA_AUTO_CLOSED_BY ?? 'Sistema';
}

const DEFAULT_CAJA_OVERDUE_HOURS = 12;

/**
 * Umbral en horas para el aviso de "caja abierta hace mucho tiempo" cuando la
 * sucursal no tiene horarios configurados (fallback legacy). Con horarios
 * configurados no se usa: el aviso depende de los turnos.
 *
 * Server-only: solo lee `CAJA_OVERDUE_HOURS`. En el bundle del cliente la
 * variable no existe y devuelve el default, que es la semántica deseada para
 * payloads viejos sin `alertaCaja` (ver `resolveDisplayedCashRegisterAlert`).
 */
export function getCajaOverdueHours(): number {
  const raw = process.env.CAJA_OVERDUE_HOURS;
  if (!raw) return DEFAULT_CAJA_OVERDUE_HOURS;
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed <= 0) return DEFAULT_CAJA_OVERDUE_HOURS;
  return parsed;
}

const DEFAULT_CAJA_REFRESH_INTERVAL_MS = 5000;
const MIN_CAJA_REFRESH_INTERVAL_MS = 5000;

const DEFAULT_CAJA_CLOCK_INTERVAL_MS = 60000;
const MIN_CAJA_CLOCK_INTERVAL_MS = 10000;

export function getCajaClockIntervalMs(): number {
  const raw = process.env.NEXT_PUBLIC_CAJA_CLOCK_INTERVAL_MS;
  if (!raw) return DEFAULT_CAJA_CLOCK_INTERVAL_MS;
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed <= 0) return DEFAULT_CAJA_CLOCK_INTERVAL_MS;
  // Mínimo práctico: valores menores se ajustan al mínimo, no al default.
  if (parsed < MIN_CAJA_CLOCK_INTERVAL_MS) return MIN_CAJA_CLOCK_INTERVAL_MS;
  return parsed;
}

/**
 * Días de historial de caja por defecto cuando la request no trae `start`.
 *
 * Server-only: solo lee `CAJA_DEFAULT_HISTORY_DAYS` y solo lo usan las rutas
 * API. En el bundle del cliente la variable no existe y devuelve el default.
 */
export function getDefaultCajaHistoryDays(): number {
  const raw = process.env.CAJA_DEFAULT_HISTORY_DAYS;
  if (!raw) return 30;
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed <= 0) return 30;
  return parsed;
}

import type {
  CashRegisterAlert,
  CashRegisterShiftInfoDTO,
} from '@/domain/types';

export const CAJA_RESUMEN_API = '/api/caja/resumen';
export const CAJA_OPEN_API = '/api/caja/abrir';
export const CAJA_CLOSE_API = '/api/caja/cerrar';

export interface CashRegister {
  id: number;
  branchId: number;
  openedAt: string;
  closedAt: string | null;
  openedBy: string;
  closedBy: string | null;
  status: 'open' | 'closed';
  autoClosed: boolean;
  initialAmount: number;
  total: number;
  cashTotal: number;
  transferTotal: number;
  totalSales: number;
  cashInDrawer?: number;
  closingCashCount?: number | null;
  closingDifference?: number | null;
  closingTransferCount?: number | null;
  closingTransferDifference?: number | null;
  closingNotes?: string | null;
  forcedClosed?: boolean;
  forcedCloseReason?: string | null;
  productsSummary?: Record<string, number>;
  criticalSuppliesSummary?: Record<string, number>;
  recipeSuppliesSummary?: Record<string, number>;
  /**
   * Estado del turno calculado en el servidor contra los horarios vigentes de
   * la sucursal. Presente en los payloads de `/api/caja/resumen`,
   * `/api/panel/resumen` y en el detalle SSR de caja.
   */
  estadoTurno?: CashRegisterShiftInfoDTO | null;
  /**
   * Aviso a mostrar para la caja (única fuente de verdad calculada en el
   * servidor). `null` cuando no hay aviso; `undefined` en payloads viejos.
   */
  alertaCaja?: CashRegisterAlert | null;
  /**
   * Horas de cierre automático resueltas en el servidor
   * (`CAJA_AUTO_CLOSE_HOURS` ?? `NEXT_PUBLIC_CAJA_AUTO_CLOSE_HOURS`). El
   * cliente debe preferir este valor sobre leer la env local: la variable
   * sin prefijo no existe en el bundle del navegador y divergiría del
   * comportamiento real del servidor (y del HTML en páginas SSR).
   */
  autoCloseHours?: number | null;
  createdAt: string;
  deletedAt?: string | null;
}

export interface CloseCashRegisterInput {
  closingCashCount?: number;
  closingTransferCount?: number;
  closingNotes?: string;
  forcedCloseReason?: string;
}

const DEFAULT_TRASH_RESTORE_BATCH_SIZE = 20;

/**
 * Cantidad máxima de cajas eliminadas que se procesan por transacción al
 * vaciar la papelera (`emptyTrash`). Cada lote restaura el stock y borra la
 * caja en una transacción propia: un corte no deja estados a medias y la
 * operación puede reintentarse de forma segura.
 */
export function getTrashRestoreBatchSize(): number {
  const raw = process.env.TRASH_RESTORE_BATCH_SIZE;
  if (!raw) return DEFAULT_TRASH_RESTORE_BATCH_SIZE;

  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < 1) return DEFAULT_TRASH_RESTORE_BATCH_SIZE;

  return Math.floor(parsed);
}

const DEFAULT_CAJA_SUMMARY_PAGE_SIZE = 500;
const MIN_CAJA_SUMMARY_PAGE_SIZE = 50;

/**
 * Cantidad de ventas activas que se cargan por página al calcular el resumen
 * de una caja. Evita materializar items, snapshots de receta y pagos de todo
 * el historial de la caja en memoria cuando el volumen es grande.
 */
export function getCashRegisterSummaryPageSize(): number {
  const raw = process.env.CAJA_SUMMARY_PAGE_SIZE;
  if (!raw) return DEFAULT_CAJA_SUMMARY_PAGE_SIZE;

  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed <= 0) return DEFAULT_CAJA_SUMMARY_PAGE_SIZE;
  if (parsed < MIN_CAJA_SUMMARY_PAGE_SIZE) return MIN_CAJA_SUMMARY_PAGE_SIZE;

  return Math.floor(parsed);
}

export function getCajaRefreshInterval(): number {
  const env = process.env.NEXT_PUBLIC_CAJA_REFRESH_INTERVAL_MS;
  if (!env) return DEFAULT_CAJA_REFRESH_INTERVAL_MS;

  const parsed = Number(env);
  if (Number.isNaN(parsed) || parsed <= 0) return DEFAULT_CAJA_REFRESH_INTERVAL_MS;
  // Mínimo práctico: valores menores se ajustan al mínimo, no al default.
  if (parsed < MIN_CAJA_REFRESH_INTERVAL_MS) return MIN_CAJA_REFRESH_INTERVAL_MS;

  return parsed;
}
