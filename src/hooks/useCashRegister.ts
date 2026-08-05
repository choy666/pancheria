'use client';

import { useCallback, useEffect, useState } from 'react';
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
  const [cashRegister, setCashRegister] = useState<CashRegister | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchCaja = useCallback(async () => {
    try {
      const response = await fetch(CAJA_RESUMEN_API, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Error al cargar caja');
      }

      const data = (await response.json()) as CashRegister | { status: 'closed' };

      if ('status' in data && data.status === 'closed') {
        setCashRegister(null);
      } else {
        setCashRegister(data as CashRegister);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setCashRegister(null);
    } finally {
      setLoading(false);
    }

    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void fetchCaja(), 0);
    const interval = setInterval(
      () => void fetchCaja(),
      getCajaRefreshInterval()
    );

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [fetchCaja]);

  const open = useCallback(async () => {
    setError(null);

    try {
      const response = await fetch(CAJA_OPEN_API, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Error al abrir caja');
      }

      await fetchCaja();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  }, [fetchCaja, router]);

  const close = useCallback(async () => {
    if (!cashRegister) return;

    setError(null);

    try {
      const response = await fetch(CAJA_CLOSE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: cashRegister.id }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Error al cerrar caja');
      }

      await fetchCaja();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
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
