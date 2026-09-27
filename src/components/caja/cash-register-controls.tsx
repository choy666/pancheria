'use client';

import { useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { formatMoney } from '@/lib/money';
import type { CashRegister, CloseCashRegisterInput } from '@/config/caja';

function parseAmount(value: string): number {
  return parseMoneyAmount(value, 0) ?? 0;
}

interface CashRegisterOpenControlsProps {
  /** Error del último fetch o acción; se muestra sobre el mensaje vacío. */
  error: string | null;
  /** Deshabilita la acción mientras hay una request en curso. */
  loading?: boolean;
  /** Abre la caja con el monto inicial ingresado. */
  onOpen: (initialAmount: number) => Promise<void>;
  /** Valor de `data-tour` del botón (contrato declarado para /cierre). */
  dataTour?: string;
}

/**
 * Estado vacío de caja: mensaje, botón "Abrir caja" y diálogo de monto
 * inicial. Lo comparten `/cierre` (`CajaPanel`) y `/ventas` (`CajaStatus`).
 */
export function CashRegisterOpenControls({
  error,
  loading = false,
  onOpen,
  dataTour,
}: CashRegisterOpenControlsProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [initialAmount, setInitialAmount] = useState('');
  const busy = isSubmitting || loading;

  function handleDialogChange(open: boolean) {
    if (!open) setInitialAmount('');
    setOpenDialog(open);
  }

  async function handleOpen() {
    setIsSubmitting(true);
    try {
      await onOpen(parseAmount(initialAmount));
    } finally {
      setIsSubmitting(false);
      setOpenDialog(false);
      setInitialAmount('');
    }
  }

  return (
    <>
      {error && (
        <div className="rounded-lg bg-destructive/15 p-4 text-base text-destructive">
          {error}
        </div>
      )}
      <p data-testid="cash-register-empty-message" className="text-base text-muted-foreground">
        No hay una caja abierta. Abrí una caja para comenzar a vender.
      </p>
      <Button
        data-tour={dataTour}
        data-testid="open-cash-register"
        type="button"
        disabled={busy}
        className="w-full sm:w-auto"
        onClick={() => setOpenDialog(true)}
      >
        {busy ? 'Abriendo...' : 'Abrir caja'}
      </Button>
      <Dialog open={openDialog} onOpenChange={handleDialogChange}>
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
              onClick={() => handleDialogChange(false)}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleOpen}
              disabled={busy}
              data-testid="confirm-open-cash-register"
            >
              {busy ? 'Abriendo...' : 'Abrir caja'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface CashRegisterCloseControlsProps {
  /** Caja abierta: `openedBy` resuelve permisos; los totales alimentan el diálogo. */
  cashRegister: Pick<
    CashRegister,
    'openedBy' | 'cashInDrawer' | 'cashTotal' | 'transferTotal' | 'initialAmount'
  >;
  role?: 'admin' | 'operator';
  userName?: string | null;
  /** Deshabilita la acción mientras hay una request en curso. */
  loading?: boolean;
  /** Cierra la caja con los montos contados y notas del diálogo. */
  onClose: (input: CloseCashRegisterInput) => Promise<void>;
  /** Tamaño del botón de cierre (`lg` en /cierre). */
  size?: 'default' | 'lg';
  /** Valor de `data-tour` del botón (contrato declarado para /cierre). */
  dataTour?: string;
}

/**
 * Acción de cierre: botón "Cerrar caja" / "Cierre forzado" (o el aviso de
 * quién puede cerrarla) junto con el diálogo de conteo. Lo comparten
 * `/cierre` (`CajaPanel`) y `/ventas` (`CajaStatus`).
 */
export function CashRegisterCloseControls({
  cashRegister,
  role = 'operator',
  userName,
  loading = false,
  onClose,
  size,
  dataTour,
}: CashRegisterCloseControlsProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);
  const [closingCashCount, setClosingCashCount] = useState('');
  const [closingTransferCount, setClosingTransferCount] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [forcedCloseReason, setForcedCloseReason] = useState('');

  const isAdmin = role === 'admin';
  const isOwner = cashRegister.openedBy === userName;
  const canClose = isOwner || isAdmin;
  const isForcedClose = isAdmin && !isOwner;
  const busy = isSubmitting || loading;

  function resetCloseInputs() {
    setClosingCashCount('');
    setClosingTransferCount('');
    setClosingNotes('');
    setForcedCloseReason('');
  }

  function handleDialogChange(open: boolean) {
    if (!open) resetCloseInputs();
    setCloseDialog(open);
  }

  async function handleClose() {
    setIsSubmitting(true);
    const count = closingCashCount.trim() === '' ? undefined : parseAmount(closingCashCount);
    const transferCount = closingTransferCount.trim() === '' ? undefined : parseAmount(closingTransferCount);
    const notes = closingNotes.trim() === '' ? undefined : closingNotes.trim();
    const reason = isForcedClose ? forcedCloseReason.trim() || undefined : undefined;
    try {
      await onClose({
        closingCashCount: count,
        closingTransferCount: transferCount,
        closingNotes: notes,
        forcedCloseReason: reason,
      });
    } finally {
      setIsSubmitting(false);
      setCloseDialog(false);
      resetCloseInputs();
    }
  }

  return (
    <>
      {canClose ? (
        <Button
          data-tour={dataTour}
          data-testid="close-cash-register"
          type="button"
          disabled={busy}
          variant={isForcedClose ? 'destructive' : 'default'}
          size={size}
          className="w-full sm:w-auto"
          onClick={() => setCloseDialog(true)}
        >
          <LockKeyhole className="h-4 w-4" />
          {busy
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
      <Dialog open={closeDialog} onOpenChange={handleDialogChange}>
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
              onClick={() => handleDialogChange(false)}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleClose}
              disabled={busy}
              variant={isForcedClose ? 'destructive' : 'default'}
              data-testid="confirm-close-cash-register"
            >
              {busy
                ? 'Cerrando...'
                : isForcedClose
                  ? 'Cierre forzado'
                  : 'Cerrar caja'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
