import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PaymentPartsInput } from '@/components/pagos/payment-parts-input';
import type { CashRegister } from '@/config/caja';
import type { OrderStatus, PaymentPart } from '@/domain/types';

interface PedidoActionsProps {
  status: OrderStatus;
  total: number;
  cashRegister: CashRegister | null;
  payments: PaymentPart[];
  setPayments: (value: PaymentPart[]) => void;
  cancelReason: string;
  setCancelReason: (value: string) => void;
  actionError: string | null;
  isSubmitting: boolean;
  whatsappUrl: string | null;
  onReceive: () => Promise<void>;
  onConfirm: () => Promise<void>;
  onFinish: () => Promise<void>;
  onCancel: () => Promise<void>;
}

export function PedidoActions({
  status,
  total,
  cashRegister,
  payments,
  setPayments,
  cancelReason,
  setCancelReason,
  actionError,
  isSubmitting,
  whatsappUrl,
  onReceive,
  onConfirm,
  onFinish,
  onCancel,
}: PedidoActionsProps) {
  const canReceive = status === 'pending';
  const canConfirm =
    (status === 'pending' || status === 'in_process') && !!cashRegister;
  const canFinish = status === 'paid';
  const canCancel =
    status === 'pending' ||
    status === 'in_process' ||
    status === 'paid';

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Acciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {actionError && (
            <div className="rounded-lg bg-destructive/15 p-3 text-sm text-destructive">
              {actionError}
            </div>
          )}

          {!cashRegister && (status === 'pending' || status === 'in_process') && (
            <div className="rounded-lg bg-amber-500/15 p-3 text-sm text-amber-500">
              No hay una caja abierta. Abrí la caja para confirmar el pago.
            </div>
          )}

          {canReceive && (
            <Button
              className="w-full"
              onClick={onReceive}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Recibiendo...' : 'Recibir y reservar'}
            </Button>
          )}

          <div className="space-y-2">
            <Label htmlFor="paymentMethod">Medio de pago</Label>
            <PaymentPartsInput
              total={total}
              payments={payments}
              onChange={setPayments}
              disabled={!canConfirm || isSubmitting}
            />
          </div>

          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center rounded-md bg-[#25D366] px-3 py-2 text-sm font-medium text-white hover:bg-[#128C7E]"
            >
              Abrir WhatsApp del cliente
            </a>
          )}

          <Button
            className="w-full"
            onClick={onConfirm}
            disabled={!canConfirm || isSubmitting}
          >
            {isSubmitting ? 'Confirmando...' : 'Confirmar pago'}
          </Button>

          {canFinish && (
            <Button
              className="w-full"
              variant="outline"
              onClick={onFinish}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Finalizando...' : 'Finalizar pedido'}
            </Button>
          )}

          <div className="space-y-2">
            <Label htmlFor="cancelReason">Motivo de cancelación</Label>
            <Textarea
              id="cancelReason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Motivo de la cancelación"
              disabled={!canCancel || isSubmitting}
            />
          </div>

          <Button
            className="w-full"
            variant="destructive"
            onClick={onCancel}
            disabled={!canCancel || isSubmitting}
          >
            {isSubmitting ? 'Cancelando...' : 'Cancelar pedido'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
