'use client';

import { useEffect, useState } from 'react';
import { addHours, intervalToDuration } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCashRegister } from '@/hooks/useCashRegister';
import { Skeleton } from '@/components/ui/skeleton';
import { AUTO_CLOSE_HOURS } from '@/config/caja';
import { formatDateTime, safeFormatDuration, formatLastUpdated } from '@/lib/date';

export function CajaPanel() {
  const { cashRegister, loading, error, lastUpdated, open, close } =
    useCashRegister();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [now, setNow] = useState<Date | null>(() => new Date());

  useEffect(() => {
    const intervalDuration = 60000;
    let intervalId: NodeJS.Timeout | null = null;

    function startInterval() {
      intervalId = setInterval(() => setNow(new Date()), intervalDuration);
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
        queueMicrotask(() => setNow(new Date()));
        startInterval();
      }
    }

    startInterval();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopInterval();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  async function handleOpen() {
    setIsSubmitting(true);
    await open();
    setIsSubmitting(false);
  }

  async function handleClose() {
    setIsSubmitting(true);
    await close();
    setIsSubmitting(false);
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!cashRegister) {
    return (
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-lg">Caja actual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-lg bg-destructive/15 p-4 text-base text-destructive">
              {error}
            </div>
          )}
          <p className="text-base text-muted-foreground">
            No hay una caja abierta. Abrí una caja para comenzar a vender.
          </p>
          <Button
            type="button"
            onClick={handleOpen}
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            {isSubmitting ? 'Abriendo...' : 'Abrir caja'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const openedAt = new Date(cashRegister.openedAt);
  const current = now ?? new Date();
  const elapsed = intervalToDuration({ start: openedAt, end: current });
  const remaining = intervalToDuration({
    start: current,
    end: addHours(openedAt, AUTO_CLOSE_HOURS),
  });

  const productsSummary = cashRegister.productsSummary ?? {};
  const criticalSuppliesSummary = cashRegister.criticalSuppliesSummary ?? {};

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
          <Badge variant="default">Abierta</Badge>
        </div>
        <Button
          type="button"
          onClick={handleClose}
          disabled={isSubmitting}
          variant="outline"
          className="w-full sm:w-auto"
        >
          {isSubmitting ? 'Cerrando...' : 'Cerrar caja'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">Resumen de caja</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Abierta: {formatDateTime(cashRegister.openedAt)}
              <br />
              Tiempo transcurrido: {safeFormatDuration(elapsed)}
              <br />
              Cierre automático en: {safeFormatDuration(remaining)}
              <br />
              Abierta por: {cashRegister.openedBy}
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
            <p className="text-xs text-muted-foreground">
              Última actualización: {formatLastUpdated(lastUpdated)}
            </p>
          </CardContent>
        </Card>

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
      </div>
    </div>
  );
}
