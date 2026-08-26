'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCashRegister } from '@/hooks/useCashRegister';
import { Skeleton } from '@/components/ui/skeleton';
import { CashRegisterSummary } from '@/components/caja/cash-register-summary';
import { formatLastUpdated } from '@/lib/date';

interface CajaPanelProps {
  branchName?: string | null;
}

export function CajaPanel({ branchName }: CajaPanelProps) {
  const { cashRegister, loading, error, lastUpdated, open, close } =
    useCashRegister();
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      <div data-tour="caja-panel" className="space-y-5">
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
      <div data-tour="caja-panel" className="space-y-5">
        {error && (
          <div className="rounded-lg bg-destructive/15 p-4 text-base text-destructive">
            {error}
          </div>
        )}
        <p className="text-base text-muted-foreground">
          No hay una caja abierta. Abrí una caja para comenzar a vender.
        </p>
        <Button
          data-tour="caja-action"
          data-testid="open-cash-register"
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

  return (
    <div data-tour="caja-panel" className="space-y-5">
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
          data-tour="caja-action"
          data-testid="close-cash-register"
          type="button"
          onClick={handleClose}
          disabled={isSubmitting}
          variant="outline"
          className="w-full sm:w-auto"
        >
          {isSubmitting ? 'Cerrando...' : 'Cerrar caja'}
        </Button>
      </div>

      <CashRegisterSummary cashRegister={cashRegister} branchName={branchName} />

      <p className="text-xs text-muted-foreground">
        Última actualización: {formatLastUpdated(lastUpdated)}
      </p>
    </div>
  );
}
