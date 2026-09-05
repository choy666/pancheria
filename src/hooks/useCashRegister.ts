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
import { useVisibilityPolling } from '@/hooks/use-visibility-polling';

export interface UseCashRegisterResult {
  cashRegister: CashRegister | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  open: (initialAmount?: number) => Promise<void>;
  close: (closingCashCount?: number, closingNotes?: string) => Promise<void>;
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


  const pollCaja = useCallback(() => {
    void fetchCaja();
  }, [fetchCaja]);

  // `immediate: false` porque la carga inicial la dispara el efecto de
  // montaje de abajo, incluso si la pestaña arranca oculta. El hook pausa el
  // intervalo cuando la pestaña se oculta y hace un fetch inmediato al
  // volver a ser visible.
  useVisibilityPolling(pollCaja, getCajaRefreshInterval(), true, false);

  useEffect(() => {
    isMountedRef.current = true;
    queueMicrotask(() => void fetchCaja());

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchCaja]);

  const open = useCallback(async (initialAmount?: number) => {
    setError(null);

    try {
      const response = await authenticatedFetch(CAJA_OPEN_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initialAmount }),
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

  const close = useCallback(async (closingCashCount?: number, closingNotes?: string) => {
    if (!cashRegister) return;

    setError(null);

    try {
      const response = await authenticatedFetch(CAJA_CLOSE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: cashRegister.id,
          closingCashCount,
          closingNotes,
        }),
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
