'use client';

import { authenticatedFetch, throwApiError } from '@/lib/fetch';
import { useCallback } from 'react';
import {
  CAJA_HISTORIAL_API,
  CAJA_ELIMINADAS_API,
} from '@/config/api';
import { type CashRegister } from '@/config/caja';
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
  const load = useCallback(
    async (page: number, limit: number, signal: AbortSignal) => {
      const params = new URLSearchParams({
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
        await throwApiError(response, 'Error al cargar historial de cajas');
      }

      return (await response.json()) as PaginatedResult<CashRegister>;
    },
    [deletedOnly, statusFilter]
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
    error,
    isLoading,
    setPage,
    setLimit,
    refresh,
  };
}
