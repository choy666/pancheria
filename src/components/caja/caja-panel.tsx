'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { MoneyAmountInput } from '@/components/pagos/money-amount-input';
import { parseMoneyAmount, PAYMENT_METHOD_LABELS } from '@/lib/payment-helpers';
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
import { AlertCircle } from 'lucide-react';
import {
  isCashRegisterFromPreviousDay,
  isCashRegisterOverdue,
} from '@/lib/cash-register-helpers';

interface CajaPanelProps {
  branchName?: string | null;
  role?: 'admin' | 'operator';
  userName?: string | null;
}

function parseAmount(value: string): number {
  return parseMoneyAmount(value, 0) ?? 0;
}

export function CajaPanel({ branchName, role = 'operator', userName }: CajaPanelProps) {
  const { cashRegister, loading, error, lastUpdated, open, close } =
    useCashRegister();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);
  const [initialAmount, setInitialAmount] = useState('');
  const [closingCashCount, setClosingCashCount] = useState('');
  const [closingTransferCount, setClosingTransferCount] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [forcedCloseReason, setForcedCloseReason] = useState('');

  const isAdmin = role === 'admin';
  const isOwner = cashRegister ? cashRegister.openedBy === userName : false;
  const canClose = isOwner || isAdmin;
  const isForcedClose = isAdmin && !isOwner;

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
    const transferCount = closingTransferCount.trim() === '' ? undefined : parseAmount(closingTransferCount);
    const notes = closingNotes.trim() === '' ? undefined : closingNotes.trim();
    const reason = isForcedClose ? forcedCloseReason.trim() || undefined : undefined;
    await close({
      closingCashCount: count,
      closingTransferCount: transferCount,
      closingNotes: notes,
      forcedCloseReason: reason,
    });
    setIsSubmitting(false);
    setCloseDialog(false);
    setClosingCashCount('');
    setClosingTransferCount('');
    setClosingNotes('');
    setForcedCloseReason('');
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

  const isPreviousDay = isCashRegisterFromPreviousDay(cashRegister.openedAt);
  const isOverdue = isCashRegisterOverdue(cashRegister.openedAt);

  return (
    <div data-tour="caja-panel" className="space-y-5">
      {error && (
        <div className="rounded-lg bg-destructive/15 p-4 text-base text-destructive">
          {error}
        </div>
      )}

      {isPreviousDay && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-base text-amber-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Caja del día anterior</p>
            <p>
              Esta caja fue abierta el día anterior. Cerrala antes de abrir una nueva.
            </p>
          </div>
        </div>
      )}

      {!isPreviousDay && isOverdue && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-base text-amber-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Caja abierta hace más de 12 horas</p>
            <p>
              La caja lleva mucho tiempo abierta. Recomendamos cerrarla y abrir una nueva.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Caja #{cashRegister.id}</h2>
          <Badge variant="default">Abierta</Badge>
        </div>
        {canClose ? (
          <Button
            data-tour="caja-action"
            data-testid="close-cash-register"
            type="button"
            disabled={isSubmitting}
            variant={isForcedClose ? 'destructive' : 'outline'}
            className="w-full sm:w-auto"
            onClick={() => setCloseDialog(true)}
          >
            {isSubmitting
              ? 'Cerrando...'
              : isForcedClose
                ? 'Cierre forzado'
                : 'Cerrar caja'}
          </Button>
        ) : (
          <p className="text-base text-muted-foreground">
            Esta caja fue abierta por {cashRegister.openedBy}. Solo{' '}
            {cashRegister.openedBy} o un administrador pueden cerrarla.
          </p>
        )}
        <Dialog open={closeDialog} onOpenChange={setCloseDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {isForcedClose ? 'Cierre forzado de caja' : 'Cerrar caja'}
              </DialogTitle>
              <DialogDescription>
                {isForcedClose
                  ? 'Vas a cerrar la caja de otro usuario. Podés dejar un motivo para la auditoría.'
                  : 'Ingresá los montos contados para calcular la diferencia con lo esperado en cada medio de pago.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {isForcedClose && (
                <div className="space-y-2">
                  <Label htmlFor="panel-forced-close-reason">Motivo del cierre forzado (opcional)</Label>
                  <Textarea
                    id="panel-forced-close-reason"
                    data-testid="forced-close-reason-input"
                    placeholder="Ej.: cambio de turno, ausencia del operador..."
                    value={forcedCloseReason}
                    onChange={(e) => setForcedCloseReason(e.target.value)}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="panel-closing-cash-count">{PAYMENT_METHOD_LABELS.cash} contado</Label>
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
                  Esperado en {PAYMENT_METHOD_LABELS.cash.toLowerCase()}: {formatMoney((cashRegister.cashInDrawer ?? cashRegister.cashTotal + cashRegister.initialAmount))}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="panel-closing-transfer-count">{PAYMENT_METHOD_LABELS.transfer} contada</Label>
                <MoneyAmountInput
                  id="panel-closing-transfer-count"
                  testId="closing-transfer-count-input"
                  amount={parseMoneyAmount(closingTransferCount, 0) ?? 0}
                  decimals={0}
                  onRawChange={setClosingTransferCount}
                  ariaLabel="Transferencia contada al cerrar caja"
                  className="bg-background font-mono text-base font-semibold"
                />
                <p className="text-sm text-muted-foreground">
                  Esperado en {PAYMENT_METHOD_LABELS.transfer.toLowerCase()}: {formatMoney(cashRegister.transferTotal)}
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
                {isSubmitting
                  ? 'Cerrando...'
                  : isForcedClose
                    ? 'Cierre forzado'
                    : 'Cerrar caja'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <CashRegisterSummary cashRegister={cashRegister} branchName={branchName} now={new Date()} />

      <p className="text-xs text-muted-foreground">
        Última actualización: {formatLastUpdated(lastUpdated)}
      </p>
    </div>
  );
}
