export function getAutoCloseHours(): number {
  const raw = process.env.CAJA_AUTO_CLOSE_HOURS ?? process.env.NEXT_PUBLIC_CAJA_AUTO_CLOSE_HOURS;
  if (!raw) return 12;
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed <= 0) return 12;
  return parsed;
}

export function getAutoClosedBy(): string {
  return process.env.CAJA_AUTO_CLOSED_BY ?? 'Sistema';
}

const DEFAULT_CAJA_REFRESH_INTERVAL_MS = 5000;

export function getCajaClockIntervalMs(): number {
  const raw = process.env.NEXT_PUBLIC_CAJA_CLOCK_INTERVAL_MS;
  if (!raw) return 60000;
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed <= 0) return 60000;
  return parsed;
}

export function getDefaultCajaHistoryDays(): number {
  const raw = process.env.CAJA_DEFAULT_HISTORY_DAYS ?? process.env.NEXT_PUBLIC_CAJA_DEFAULT_HISTORY_DAYS;
  if (!raw) return 30;
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed <= 0) return 30;
  return parsed;
}

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
  closingNotes?: string | null;
  productsSummary?: Record<string, number>;
  criticalSuppliesSummary?: Record<string, number>;
  recipeSuppliesSummary?: Record<string, number>;
  createdAt: string;
  deletedAt?: string | null;
}

export function getCajaRefreshInterval(): number {
  const env = process.env.NEXT_PUBLIC_CAJA_REFRESH_INTERVAL_MS;
  if (!env) return DEFAULT_CAJA_REFRESH_INTERVAL_MS;

  const parsed = Number(env);
  if (Number.isNaN(parsed) || parsed <= 0) return DEFAULT_CAJA_REFRESH_INTERVAL_MS;

  return parsed;
}
