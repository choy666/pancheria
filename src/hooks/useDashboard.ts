'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { authenticatedFetch } from '@/lib/fetch';
import { PANEL_RESUMEN_API } from '@/config/api';
import type { CashRegister } from '@/config/caja';
import type { OrderStatus } from '@/domain/types';

type DashboardCashRegister = CashRegister | { status: 'closed' };

type DashboardData = {
  cashRegister: DashboardCashRegister;
  lowStockCount: number;
  orderCounts: Record<OrderStatus, number>;
};

export interface UseDashboardResult {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const DASHBOARD_REFRESH_INTERVAL_MS = 30000;

export function useDashboard(): UseDashboardResult {
  const isMountedRef = useRef(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await authenticatedFetch(PANEL_RESUMEN_API);

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error || 'Error al cargar el panel');
      }

      const result = (await response.json()) as DashboardData;

      if (!isMountedRef.current) return;

      setData(result);
      setError(null);
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    queueMicrotask(() => void fetchDashboard());

    let intervalId: NodeJS.Timeout | null = null;

    function startInterval() {
      intervalId = setInterval(
        () => void fetchDashboard(),
        DASHBOARD_REFRESH_INTERVAL_MS
      );
    }

    function stopInterval() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        stopInterval();
      } else {
        queueMicrotask(() => void fetchDashboard());
        startInterval();
      }
    }

    startInterval();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      stopInterval();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchDashboard]);

  return {
    data,
    loading,
    error,
    refresh: fetchDashboard,
  };
}
