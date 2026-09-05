'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { authenticatedFetch } from '@/lib/fetch';
import { PANEL_RESUMEN_API } from '@/config/api';
import { getDashboardRefreshIntervalMs } from '@/config/dashboard';
import { useVisibilityPolling } from '@/hooks/use-visibility-polling';
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

const DASHBOARD_REFRESH_INTERVAL_MS = getDashboardRefreshIntervalMs();

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

  const pollDashboard = useCallback(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  // `immediate: false` porque la carga inicial la dispara el efecto de
  // montaje de abajo, incluso si la pestaña arranca oculta. El hook pausa el
  // intervalo cuando la pestaña se oculta y hace un fetch inmediato al
  // volver a ser visible.
  useVisibilityPolling(
    pollDashboard,
    DASHBOARD_REFRESH_INTERVAL_MS,
    true,
    false
  );

  useEffect(() => {
    isMountedRef.current = true;
    queueMicrotask(() => void fetchDashboard());

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchDashboard]);

  return {
    data,
    loading,
    error,
    refresh: fetchDashboard,
  };
}
