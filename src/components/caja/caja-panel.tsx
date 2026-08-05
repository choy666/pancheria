'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Duration } from 'date-fns';
import { format, formatDuration, intervalToDuration } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface CashRegister {
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
  productsSummary: string;
  criticalSuppliesSummary: string;
}

function formatDateTime(date: string | Date | null): string {
  if (!date) return '-';
  return format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: es });
}

function safeFormatDuration(duration: Duration | null): string {
  if (!duration) return 'En curso';
  const text = formatDuration(duration, {
    format: ['hours', 'minutes'],
    locale: es,
  });
  return text || '0m';
}

export function CajaPanel() {
  const router = useRouter();
  const [cashRegister, setCashRegister] = useState<CashRegister | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/caja', { credentials: 'include' });
      if (!response.ok) throw new Error('Error al cargar caja');
      const data = (await response.json()) as CashRegister | { status: 'closed' };
      if ('status' in data && data.status === 'closed') {
        setCashRegister(null);
      } else {
        setCashRegister(data as CashRegister);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setCashRegister(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  async function handleOpen() {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/caja/abrir', {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al abrir caja');
      }
      const data = (await response.json()) as CashRegister;
      setCashRegister(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleClose() {
    if (!cashRegister) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/caja/cerrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: cashRegister.id }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al cerrar caja');
      }
      const data = (await response.json()) as CashRegister;
      setCashRegister(data);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) return <p>Cargando...</p>;

  if (!cashRegister) {
    return (
      <div className="space-y-5">
        {error && (
          <div className="rounded-lg bg-destructive/15 p-4 text-base text-destructive">
            {error}
          </div>
        )}
        <p className="text-muted-foreground">No hay una caja abierta.</p>
        <Button
          type="button"
          onClick={handleOpen}
          disabled={isSubmitting}
          className="w-full sm:w-auto"
        >
          {isSubmitting ? 'Abriendo...' : 'Abrir caja'}
        </Button>
      </div>
    );
  }

  const isOpen = cashRegister.status === 'open';
  const openedAt = new Date(cashRegister.openedAt);
  const closedAt = cashRegister.closedAt ? new Date(cashRegister.closedAt) : null;

  const duration =
    closedAt ? intervalToDuration({ start: openedAt, end: closedAt }) : null;

  const productsSummary = cashRegister.productsSummary
    ? (JSON.parse(cashRegister.productsSummary) as Record<string, number>)
    : {};
  const criticalSuppliesSummary = cashRegister.criticalSuppliesSummary
    ? (JSON.parse(cashRegister.criticalSuppliesSummary) as Record<string, number>)
    : {};

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg bg-destructive/15 p-4 text-base text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Caja #{cashRegister.id}</h2>
          {isOpen ? (
            <Badge variant="default">Abierta</Badge>
          ) : (
            <Badge variant="secondary">Cerrada</Badge>
          )}
        </div>
        {isOpen && (
          <Button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            variant="outline"
            className="w-full sm:w-auto"
          >
            {isSubmitting ? 'Cerrando...' : 'Cerrar caja'}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">Resumen de caja</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Abierta: {formatDateTime(cashRegister.openedAt)}
              {cashRegister.closedAt && (
                <>
                  <br />
                  Cerrada: {formatDateTime(cashRegister.closedAt)}
                </>
              )}
              <br />
              Duración: {safeFormatDuration(duration)}
              <br />
              Abierta por: {cashRegister.openedBy}
              {cashRegister.closedBy && (
                <>
                  <br />
                  Cerrada por: {cashRegister.closedBy}
                </>
              )}
              {cashRegister.autoClosed && (
                <>
                  <br />
                  Cierre automático
                </>
              )}
            </p>
            <p className="font-mono text-2xl font-bold text-primary">
              Total: ${cashRegister.total.toFixed(2)}
            </p>
            <div className="grid grid-cols-2 gap-3 text-base">
              <p className="rounded-lg bg-muted/30 p-3">
                Efectivo:{' '}
                <span className="font-mono font-medium">
                  ${cashRegister.cashTotal.toFixed(2)}
                </span>
              </p>
              <p className="rounded-lg bg-muted/30 p-3">
                Transferencia:{' '}
                <span className="font-mono font-medium">
                  ${cashRegister.transferTotal.toFixed(2)}
                </span>
              </p>
            </div>
            <p className="text-base">
              Ventas:{' '}
              <span className="font-mono font-semibold">
                {cashRegister.totalSales}
              </span>
            </p>
          </CardContent>
        </Card>

        {!isOpen && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Productos vendidos</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {Object.entries(productsSummary).map(([name, quantity]) => (
                    <li
                      key={name}
                      className="flex items-center justify-between rounded-lg bg-muted/20 p-2"
                    >
                      <span>{name}</span>
                      <span className="font-mono font-medium">{quantity}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Consumo de insumos críticos</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {Object.entries(criticalSuppliesSummary).map(([name, quantity]) => (
                    <li
                      key={name}
                      className="flex items-center justify-between rounded-lg bg-muted/20 p-2"
                    >
                      <span>{name}</span>
                      <span className="font-mono font-medium">{quantity}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
