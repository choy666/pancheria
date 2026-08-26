'use client';

import { useState } from 'react';
import { addHours, format, intervalToDuration } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useClockInterval } from '@/hooks/use-clock-interval';
import {
  getAutoCloseHours,
  getCajaClockIntervalMs,
} from '@/config/caja';
import type { CashRegister } from '@/config/caja';
import { safeFormatDuration } from '@/lib/date';

interface CajaStatusProps {
  cashRegister: CashRegister | null;
  onOpen: () => Promise<void>;
  onClose: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

export function CajaStatus({
  cashRegister,
  onOpen,
  onClose,
  loading,
  error,
}: CajaStatusProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const now = useClockInterval(getCajaClockIntervalMs());

  async function handleOpen() {
    setIsSubmitting(true);
    await onOpen();
    setIsSubmitting(false);
  }

  async function handleClose() {
    setIsSubmitting(true);
    await onClose();
    setIsSubmitting(false);
  }

  if (!cashRegister || cashRegister.status === 'closed') {
    return (
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-lg">Estado de la caja</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-lg bg-destructive/15 p-3 text-base text-destructive">
              {error}
            </div>
          )}
          <p className="text-base text-muted-foreground">
            No hay una caja abierta. Abrí una caja para comenzar a vender.
          </p>
          <Button
            type="button"
            data-testid="open-cash-register"
            className="w-full sm:w-auto"
            onClick={handleOpen}
            disabled={isSubmitting || loading}
          >
            {isSubmitting || loading ? 'Abriendo...' : 'Abrir caja'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const openedAt = new Date(cashRegister.openedAt);
  const autoCloseAt = addHours(openedAt, getAutoCloseHours());
  const current = now;

  const elapsed = intervalToDuration({ start: openedAt, end: current });
  const remaining = intervalToDuration({ start: current, end: autoCloseAt });

  const openedAtTime = format(openedAt, 'HH:mm', { locale: es });

  return (
    <Card className="border-primary/30">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-lg">Estado de la caja</CardTitle>
          <p className="text-sm text-muted-foreground">
            Abierta por {cashRegister.openedBy}
          </p>
        </div>
        <Badge variant="default">Abierta</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-base">
          Caja abierta desde{' '}
          <span className="font-mono font-medium">{openedAtTime}</span> (hace{' '}
          {safeFormatDuration(elapsed)})
        </p>
        <p className="text-base text-muted-foreground">
          Se cierra automáticamente en{' '}
          <span className="font-mono text-foreground">
            {safeFormatDuration(remaining)}
          </span>
        </p>
        <Button
          type="button"
          data-testid="close-cash-register"
          variant="outline"
          onClick={handleClose}
          disabled={isSubmitting || loading}
          className="w-full sm:w-auto"
        >
          {isSubmitting || loading ? 'Cerrando...' : 'Cerrar caja'}
        </Button>
      </CardContent>
    </Card>
  );
}
