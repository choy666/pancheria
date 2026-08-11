'use client';

import { authenticatedFetch } from '@/lib/fetch';
import { useCallback, useState } from 'react';
import { subDays } from 'date-fns';
import {
  CAJA_HISTORIAL_API,
  CAJA_ELIMINADAS_API,
} from '@/config/api';
import { DEFAULT_CAJA_HISTORY_DAYS, type CashRegister } from '@/config/caja';
import { nowUTC, startOfDayUTC, endOfDayUTC } from '@/lib/date';
import { usePaginatedData } from '@/hooks/use-paginated-data';
import type { PaginatedResult } from '@/domain/types';

export interface UseCashRegisterHistoryOptions {
  statusFilter?: 'all' | 'closed';
  deletedOnly?: boolean;
}

export interface UseCashRegisterHistoryReturn {
  data: CashRegister[];
  total: number;
  page: number;
  limit: number;
  startDate: string;
  endDate: string;
  error: string | null;
  isLoading: boolean;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  refresh: () => void;
}

export function useCashRegisterHistory({
  statusFilter = 'closed',
  deletedOnly = false,
}: UseCashRegisterHistoryOptions = {}): UseCashRegisterHistoryReturn {
  const [dateRange] = useState(() => {
    const now = nowUTC();
    const end = endOfDayUTC(now);
    const start = startOfDayUTC(subDays(now, DEFAULT_CAJA_HISTORY_DAYS));
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  });

  const load = useCallback(
    async (page: number, limit: number, signal: AbortSignal) => {
      const params = new URLSearchParams({
        start: dateRange.startDate,
        end: dateRange.endDate,
        page: String(page),
        limit: String(limit),
      });

      const endpoint = deletedOnly ? CAJA_ELIMINADAS_API : CAJA_HISTORIAL_API;

      if (!deletedOnly && statusFilter !== 'all') {
        params.set('status', statusFilter);
      }

      const response = await authenticatedFetch(`${endpoint}?${params}`, {
        signal,
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Error al cargar historial de cajas');
      }

      return (await response.json()) as PaginatedResult<CashRegister>;
    },
    [dateRange, deletedOnly, statusFilter]
  );

  const {
    items,
    total,
    page,
    limit,
    isLoading,
    error,
    setPage,
    setLimit,
    refresh,
  } = usePaginatedData(load);

  return {
    data: items,
    total,
    page,
    limit,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    error,
    isLoading,
    setPage,
    setLimit,
    refresh,
  };
}
