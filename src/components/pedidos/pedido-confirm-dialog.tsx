'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PaymentPartsInput } from '@/components/pagos/payment-parts-input';
import { usePaymentParts } from '@/hooks/usePaymentParts';
import { formatMoney } from '@/lib/money';
import type { PaymentPart } from '@/domain/types';

interface PedidoConfirmDialogProps {
  orderNumber: string;
  customerName: string;
  total: number;
  isSubmitting: boolean;
  error: string | null;
  onConfirm: (payments: PaymentPart[]) => void;
  onCancel: () => void;
}

/**
 * Diálogo de cobro del listado de pedidos: el operador registra cómo pagó
 * el cliente (efectivo, transferencia o mixto) antes de convertir el pedido
 * en venta. Evita asumir efectivo por defecto, que distorsionaba el arqueo
 * de caja cuando el pago real era por transferencia.
 *
 * Se monta solo mientras hay un pedido seleccionado en la lista padre, así
 * `usePaymentParts` arranca siempre con el total del pedido actual.
 */
export function PedidoConfirmDialog({
  orderNumber,
  customerName,
  total,
  isSubmitting,
  error,
  onConfirm,
  onCancel,
}: PedidoConfirmDialogProps) {
  const { paymentParts, setPayments, isComplete } = usePaymentParts(total, {
    defaultMethod: 'cash',
  });

  function handleConfirm() {
    if (!isComplete || isSubmitting) return;
    onConfirm(paymentParts.filter((part) => part.amount > 0));
  }

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmar pago — Pedido #{orderNumber}</DialogTitle>
          <DialogDescription>
            Registrá cómo pagó {customerName}. El total a cobrar es{' '}
            {formatMoney(total)}.
          </DialogDescription>
        </DialogHeader>

        <PaymentPartsInput
          total={total}
          payments={paymentParts}
          onChange={setPayments}
          disabled={isSubmitting}
        />

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            data-testid="confirm-order-dialog-submit"
            onClick={handleConfirm}
            disabled={!isComplete || isSubmitting}
            className="w-full sm:w-auto"
          >
            {isSubmitting ? 'Confirmando...' : 'Confirmar pago'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
