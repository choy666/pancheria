'use client';

import { useEffect, useState, useCallback } from 'react';
import { subDays } from 'date-fns';
import {
  CAJA_HISTORIAL_API,
  CAJA_ELIMINADAS_API,
} from '@/config/api';
import { DEFAULT_CAJA_HISTORY_DAYS } from '@/config/caja';

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
  deletedAt: string | null;
  createdAt: string;
}

interface LoadSuccess {
  data: CashRegister[];
  startDate: string;
  endDate: string;
}

interface LoadFailure {
  error: string;
}

type LoadResult = LoadSuccess | LoadFailure;

export interface UseCashRegisterHistoryOptions {
  statusFilter?: 'all' | 'closed';
  deletedOnly?: boolean;
}

export interface UseCashRegisterHistoryReturn {
  data: CashRegister[] | null;
  startDate: string | null;
  endDate: string | null;
  error: string | null;
  isLoading: boolean;
  refresh: () => void;
}

function loadCashRegisterHistory(
  statusFilter: 'all' | 'closed',
  deletedOnly: boolean
): Promise<LoadResult> {
  const end = new Date();
  const start = subDays(end, DEFAULT_CAJA_HISTORY_DAYS);
  const endStr = end.toISOString().split('T')[0];
  const startStr = start.toISOString().split('T')[0];

  const params = new URLSearchParams({
    start: startStr,
    end: endStr,
  });

  const endpoint = deletedOnly ? CAJA_ELIMINADAS_API : CAJA_HISTORIAL_API;

  if (!deletedOnly && statusFilter !== 'all') {
    params.set('status', statusFilter);
  }

  return fetch(`${endpoint}?${params}`, {
    credentials: 'include',
  })
    .then(async (response) => {
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Error al cargar historial de cajas');
      }

      const data = (await response.json()) as CashRegister[];
      return {
        data,
        startDate: startStr,
        endDate: endStr,
      };
    })
    .catch((err) => ({
      error: err instanceof Error ? err.message : 'Error desconocido',
    }));
}

export function useCashRegisterHistory({
  statusFilter = 'closed',
  deletedOnly = false,
}: UseCashRegisterHistoryOptions = {}): UseCashRegisterHistoryReturn {
  const [result, setResult] = useState<LoadResult | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void loadCashRegisterHistory(statusFilter, deletedOnly).then((res) => {
      if (!cancelled) {
        setResult(res);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [statusFilter, deletedOnly, refreshKey]);

  const refresh = useCallback(() => {
    setResult(null);
    setRefreshKey((prev) => prev + 1);
  }, []);

  if (result === null) {
    return {
      data: null,
      startDate: null,
      endDate: null,
      error: null,
      isLoading: true,
      refresh,
    };
  }

  if ('error' in result) {
    return {
      data: null,
      startDate: null,
      endDate: null,
      error: result.error,
      isLoading: false,
      refresh,
    };
  }

  return {
    data: result.data,
    startDate: result.startDate,
    endDate: result.endDate,
    error: null,
    isLoading: false,
    refresh,
  };
}
