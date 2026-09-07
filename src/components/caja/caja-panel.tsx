'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { MoneyAmountInput } from '@/components/pagos/money-amount-input';
import { parseMoneyAmount } from '@/lib/payment-helpers';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCashRegister } from '@/hooks/useCashRegister';
import { Skeleton } from '@/components/ui/skeleton';
import { CashRegisterSummary } from '@/components/caja/cash-register-summary';
import { formatLastUpdated } from '@/lib/date';
import { formatMoney } from '@/lib/money';

interface CajaPanelProps {
  branchName?: string | null;
}

function parseAmount(value: string): number {
  return parseMoneyAmount(value, 0) ?? 0;
}

export function CajaPanel({ branchName }: CajaPanelProps) {
  const { cashRegister, loading, error, lastUpdated, open, close } =
    useCashRegister();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);
  const [initialAmount, setInitialAmount] = useState('');
  const [closingCashCount, setClosingCashCount] = useState('');
  const [closingNotes, setClosingNotes] = useState('');

  async function handleOpen() {
    setIsSubmitting(true);
    await open(parseAmount(initialAmount));
    setIsSubmitting(false);
    setOpenDialog(false);
    setInitialAmount('');
  }

  async function handleClose() {
    setIsSubmitting(true);
    const count = closingCashCount.trim() === '' ? undefined : parseAmount(closingCashCount);
    const notes = closingNotes.trim() === '' ? undefined : closingNotes.trim();
    await close(count, notes);
    setIsSubmitting(false);
    setCloseDialog(false);
    setClosingCashCount('');
    setClosingNotes('');
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
        <p data-testid="cash-register-empty-message" className="text-base text-muted-foreground">
          No hay una caja abierta. Abrí una caja para comenzar a vender.
        </p>
        <Button
          data-tour="caja-action"
          data-testid="open-cash-register"
          type="button"
          disabled={isSubmitting}
          className="w-full sm:w-auto"
          onClick={() => setOpenDialog(true)}
        >
          {isSubmitting ? 'Abriendo...' : 'Abrir caja'}
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
                <Label htmlFor="panel-initial-amount">Monto inicial de caja</Label>
                <MoneyAmountInput
                  id="panel-initial-amount"
                  testId="initial-amount-input"
                  amount={parseMoneyAmount(initialAmount, 0) ?? 0}
                  decimals={0}
                  onRawChange={setInitialAmount}
                  ariaLabel="Monto inicial de caja"
                  className="bg-background font-mono text-base font-semibold"
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
          disabled={isSubmitting}
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => setCloseDialog(true)}
        >
          {isSubmitting ? 'Cerrando...' : 'Cerrar caja'}
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
                <Label htmlFor="panel-closing-cash-count">Efectivo contado</Label>
                <MoneyAmountInput
                  id="panel-closing-cash-count"
                  testId="closing-cash-count-input"
                  amount={parseMoneyAmount(closingCashCount, 0) ?? 0}
                  decimals={0}
                  onRawChange={setClosingCashCount}
                  ariaLabel="Efectivo contado al cerrar caja"
                  className="bg-background font-mono text-base font-semibold"
                />
                <p className="text-sm text-muted-foreground">
                  Esperado en efectivo: {formatMoney((cashRegister.cashInDrawer ?? cashRegister.cashTotal + cashRegister.initialAmount))}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="panel-closing-notes">Notas (opcional)</Label>
                <Textarea
                  id="panel-closing-notes"
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
      </div>

      <CashRegisterSummary cashRegister={cashRegister} branchName={branchName} />

      <p className="text-xs text-muted-foreground">
        Última actualización: {formatLastUpdated(lastUpdated)}
      </p>
    </div>
  );
}
