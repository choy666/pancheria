export const AUTO_CLOSE_HOURS = 12;

export const DEFAULT_CAJA_REFRESH_INTERVAL_MS = 5000;

export const CAJA_CLOCK_INTERVAL_MS = 60000;

export const DEFAULT_CAJA_HISTORY_DAYS = 30;

export const CAJA_RESUMEN_API = '/api/caja/resumen';
export const CAJA_OPEN_API = '/api/caja/abrir';
export const CAJA_CLOSE_API = '/api/caja/cerrar';

export interface CashRegister {
  id: number;
  openedAt: string;
  closedAt: string | null;
  openedBy: string;
  closedBy: string | null;
  status: 'open' | 'closed';
  autoClosed: boolean;
  total: number;
  cashTotal: number;
  transferTotal: number;
  totalSales: number;
  productsSummary: Record<string, number>;
  criticalSuppliesSummary: Record<string, number>;
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
