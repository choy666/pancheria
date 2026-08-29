'use client';

import { useState } from 'react';
import { addHours, format, intervalToDuration } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useClockInterval } from '@/hooks/use-clock-interval';
import {
  getAutoCloseHours,
  getCajaClockIntervalMs,
} from '@/config/caja';
import type { CashRegister } from '@/config/caja';
import { safeFormatDuration } from '@/lib/date';

interface CajaStatusProps {
  cashRegister: CashRegister | null;
  onOpen: (initialAmount?: number) => Promise<void>;
  onClose: (closingCashCount?: number, closingNotes?: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

function parseAmount(value: string): number {
  const trimmed = value.trim().replace(',', '.');
  if (trimmed === '') return 0;
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
}

export function CajaStatus({
  cashRegister,
  onOpen,
  onClose,
  loading,
  error,
}: CajaStatusProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);
  const [initialAmount, setInitialAmount] = useState('');
  const [closingCashCount, setClosingCashCount] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const now = useClockInterval(getCajaClockIntervalMs());

  async function handleOpen() {
    setIsSubmitting(true);
    await onOpen(parseAmount(initialAmount));
    setIsSubmitting(false);
    setOpenDialog(false);
    setInitialAmount('');
  }

  async function handleClose() {
    setIsSubmitting(true);
    const count = closingCashCount.trim() === '' ? undefined : parseAmount(closingCashCount);
    const notes = closingNotes.trim() === '' ? undefined : closingNotes.trim();
    await onClose(count, notes);
    setIsSubmitting(false);
    setCloseDialog(false);
    setClosingCashCount('');
    setClosingNotes('');
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
            disabled={isSubmitting || loading}
            onClick={() => setOpenDialog(true)}
          >
            {isSubmitting || loading ? 'Abriendo...' : 'Abrir caja'}
          </Button>
          <Dialog open={openDialog} onOpenChange={setOpenDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Abrir caja</DialogTitle>
                <DialogDescription>
                  Ingresá el monto inicial si la caja arranca con dinero para vuelto o eventualidades.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="initial-amount">Monto inicial de caja</Label>
                  <Input
                    id="initial-amount"
                    data-testid="initial-amount-input"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    value={initialAmount}
                    onChange={(e) => setInitialAmount(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Dejalo en 0 si no hay monto inicial.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpenDialog(false)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleOpen}
                  disabled={isSubmitting}
                  data-testid="confirm-open-cash-register"
                >
                  {isSubmitting ? 'Abriendo...' : 'Abrir caja'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
        {cashRegister.initialAmount > 0 && (
          <p className="text-base">
            Monto inicial:{' '}
            <span className="font-mono font-medium">
              ${cashRegister.initialAmount.toFixed(2)}
            </span>
          </p>
        )}
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
          disabled={isSubmitting || loading}
          className="w-full sm:w-auto"
          onClick={() => setCloseDialog(true)}
        >
          {isSubmitting || loading ? 'Cerrando...' : 'Cerrar caja'}
        </Button>
        <Dialog open={closeDialog} onOpenChange={setCloseDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cerrar caja</DialogTitle>
              <DialogDescription>
                Ingresá el monto contado en efectivo para calcular la diferencia con el esperado.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="closing-cash-count">Efectivo contado</Label>
                <Input
                  id="closing-cash-count"
                  data-testid="closing-cash-count-input"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={closingCashCount}
                  onChange={(e) => setClosingCashCount(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Esperado en efectivo: ${(cashRegister.cashInDrawer ?? cashRegister.cashTotal + cashRegister.initialAmount).toFixed(2)}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="closing-notes">Notas (opcional)</Label>
                <Textarea
                  id="closing-notes"
                  data-testid="closing-notes-input"
                  placeholder="Ej.: sobrante por vueltos, faltante..."
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCloseDialog(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                data-testid="confirm-close-cash-register"
              >
                {isSubmitting ? 'Cerrando...' : 'Cerrar caja'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
