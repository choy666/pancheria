'use client';

import { useState } from 'react';
import { addHours, format, intervalToDuration } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useClockInterval } from '@/hooks/use-clock-interval';
import {
  getAutoCloseHours,
  getCajaClockIntervalMs,
} from '@/config/caja';
import type { CashRegister, CloseCashRegisterInput } from '@/config/caja';
import { safeFormatDuration } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import { AlertCircle } from 'lucide-react';
import {
  isCashRegisterFromPreviousDay,
  isCashRegisterOverdue,
} from '@/lib/cash-register-helpers';

interface CajaStatusProps {
  cashRegister: CashRegister | null;
  onOpen: (initialAmount?: number) => Promise<void>;
  onClose: (input: CloseCashRegisterInput) => Promise<void>;
  loading: boolean;
  error: string | null;
  role?: 'admin' | 'operator';
  userName?: string | null;
}

function parseAmount(value: string): number {
  return parseMoneyAmount(value, 0) ?? 0;
}

export function CajaStatus({
  cashRegister,
  onOpen,
  onClose,
  loading,
  error,
  role = 'operator',
  userName,
}: CajaStatusProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);
  const [initialAmount, setInitialAmount] = useState('');
  const [closingCashCount, setClosingCashCount] = useState('');
  const [closingTransferCount, setClosingTransferCount] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [forcedCloseReason, setForcedCloseReason] = useState('');
  const now = useClockInterval(getCajaClockIntervalMs());

  const isAdmin = role === 'admin';
  const isOwner = cashRegister ? cashRegister.openedBy === userName : false;
  const canClose = isOwner || isAdmin;
  const isForcedClose = isAdmin && !isOwner;

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
    const transferCount = closingTransferCount.trim() === '' ? undefined : parseAmount(closingTransferCount);
    const notes = closingNotes.trim() === '' ? undefined : closingNotes.trim();
    const reason = isForcedClose ? forcedCloseReason.trim() || undefined : undefined;
    await onClose({
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
          <p data-testid="cash-register-empty-message" className="text-base text-muted-foreground">
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
                  <MoneyAmountInput
                    id="initial-amount"
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
        </CardContent>
      </Card>
    );
  }

  const openedAt = new Date(cashRegister.openedAt);
  const autoCloseHours = getAutoCloseHours();
  const autoCloseAt = autoCloseHours > 0 ? addHours(openedAt, autoCloseHours) : null;
  const current = now;

  const elapsed = intervalToDuration({ start: openedAt, end: current });
  const remaining =
    autoCloseAt && autoCloseAt > current
      ? intervalToDuration({ start: current, end: autoCloseAt })
      : null;

  const openedAtTime = format(openedAt, 'HH:mm', { locale: es });
  const isPreviousDay = isCashRegisterFromPreviousDay(cashRegister.openedAt);
  const isOverdue = isCashRegisterOverdue(cashRegister.openedAt);

  return (
    <Card className="border-primary/30">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-lg">Estado de la caja</CardTitle>
          <p data-testid="cash-register-opened-by" className="text-sm text-muted-foreground">
            Abierta por {cashRegister.openedBy}
          </p>
        </div>
        <Badge variant="default">Abierta</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {isPreviousDay && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-base text-amber-700">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">Caja del día anterior</p>
              <p className="text-sm">
                Esta caja fue abierta el día anterior. Cerrala antes de abrir una nueva.
              </p>
            </div>
          </div>
        )}

        {!isPreviousDay && isOverdue && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-base text-amber-700">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">Caja abierta hace más de 12 horas</p>
              <p className="text-sm">
                La caja lleva mucho tiempo abierta. Recomendamos cerrarla y abrir una nueva.
              </p>
            </div>
          </div>
        )}

        <p className="text-base">
          Caja abierta desde{' '}
          <span className="font-mono font-medium">{openedAtTime}</span> (hace{' '}
          {safeFormatDuration(elapsed)})
        </p>
        {cashRegister.initialAmount > 0 && (
          <p className="text-base">
            Monto inicial:{' '}
            <span className="font-mono font-medium">
              {formatMoney(cashRegister.initialAmount)}
            </span>
          </p>
        )}
        {autoCloseHours > 0 && (
          <p className="text-base text-muted-foreground">
            Se cierra automáticamente en{' '}
            <span className="font-mono text-foreground">
              {safeFormatDuration(remaining)}
            </span>
          </p>
        )}
        {canClose ? (
          <Button
            type="button"
            data-testid="close-cash-register"
            variant={isForcedClose ? 'destructive' : 'outline'}
            disabled={isSubmitting || loading}
            className="w-full sm:w-auto"
            onClick={() => setCloseDialog(true)}
          >
            {isSubmitting || loading
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
                  <Label htmlFor="forced-close-reason">Motivo del cierre forzado (opcional)</Label>
                  <Textarea
                    id="forced-close-reason"
                    data-testid="forced-close-reason-input"
                    placeholder="Ej.: cambio de turno, ausencia del operador..."
                    value={forcedCloseReason}
                    onChange={(e) => setForcedCloseReason(e.target.value)}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="closing-cash-count">{PAYMENT_METHOD_LABELS.cash} contado</Label>
                <MoneyAmountInput
                  id="closing-cash-count"
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
                <Label htmlFor="closing-transfer-count">{PAYMENT_METHOD_LABELS.transfer} contada</Label>
                <MoneyAmountInput
                  id="closing-transfer-count"
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
                {isSubmitting
                  ? 'Cerrando...'
                  : isForcedClose
                    ? 'Cierre forzado'
                    : 'Cerrar caja'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
