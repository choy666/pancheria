'use client';

import { authenticatedFetch } from '@/lib/fetch';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CAJA_CLOSE_API,
  CAJA_OPEN_API,
  CAJA_RESUMEN_API,
  getCajaRefreshInterval,
} from '@/config/caja';
import type { CashRegister } from '@/config/caja';

export type { CashRegister };

export interface UseCashRegisterResult {
  cashRegister: CashRegister | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  open: () => Promise<void>;
  close: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useCashRegister(): UseCashRegisterResult {
  const router = useRouter();
  const isMountedRef = useRef(true);
  const [cashRegister, setCashRegister] = useState<CashRegister | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchCaja = useCallback(async () => {
    try {
      const response = await authenticatedFetch(CAJA_RESUMEN_API);

      if (!response.ok) {
        throw new Error('Error al cargar caja');
      }

      const data = (await response.json()) as CashRegister | { status: 'closed' };

      if (!isMountedRef.current) return;

      if ('status' in data && data.status === 'closed') {
        setCashRegister(null);
      } else {
        setCashRegister(data as CashRegister);
      }

      setError(null);
    } catch (error) {
      if (!isMountedRef.current) return;
      setError(error instanceof Error ? error.message : 'Error desconocido');
      setCashRegister(null);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setLastUpdated(new Date());
      }
    }
  }, []);


  useEffect(() => {
    isMountedRef.current = true;
    queueMicrotask(() => void fetchCaja());

    const intervalDuration = getCajaRefreshInterval();
    let intervalId: NodeJS.Timeout | null = null;

    function startInterval() {
      intervalId = setInterval(() => void fetchCaja(), intervalDuration);
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
        queueMicrotask(() => void fetchCaja());
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
  }, [fetchCaja]);

  const open = useCallback(async () => {
    setError(null);

    try {
      const response = await authenticatedFetch(CAJA_OPEN_API, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Error al abrir caja');
      }

      await fetchCaja();
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error desconocido');
    }
  }, [fetchCaja, router]);

  const close = useCallback(async () => {
    if (!cashRegister) return;

    setError(null);

    try {
      const response = await authenticatedFetch(CAJA_CLOSE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cashRegister.id }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Error al cerrar caja');
      }

      await fetchCaja();
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error desconocido');
    }
  }, [cashRegister, fetchCaja, router]);

  return {
    cashRegister,
    loading,
    error,
    lastUpdated,
    open,
    close,
    refresh: fetchCaja,
  };
}
