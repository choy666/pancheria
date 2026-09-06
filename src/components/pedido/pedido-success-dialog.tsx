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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatMoney } from '@/lib/money';
import {
  getCurrentOrNextOpening,
} from '@/lib/branch-helpers';
import type { CreatedOrder } from './usePedidoClient';
import type { PublicOrderItem } from '@/domain/types';
import type { Branch } from '@/domain/types';

function OrderItemRecipeDetails({ item }: { item: PublicOrderItem }) {
  if (!item.recipeSnapshot || item.recipeSnapshot.length === 0) return null;

  const selected = item.recipeSnapshot.filter(
    (r) => !r.isOptional || r.selected
  );
  const removed = item.recipeSnapshot.filter(
    (r) => r.isOptional && !r.selected
  );

  return (
    <p className="text-xs text-muted-foreground">
      {selected.length > 0 && `Incluye: ${selected.map((r) => r.supplyName).join(', ')}.`}
      {removed.length > 0 && ` Sin: ${removed.map((r) => r.supplyName).join(', ')}.`}
    </p>
  );
}

interface PedidoSuccessDialogProps {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  createdOrder: CreatedOrder | null;
  branch: Branch;
  cancellationReason: string;
  setCancellationReason: (value: string) => void;
  isCancelling: boolean;
  cancellationError: string | null;
  onCancel: () => Promise<void>;
  onGoToChat: () => void;
}

export function PedidoSuccessDialog({
  open,
  onOpenChange,
  createdOrder,
  branch,
  cancellationReason,
  setCancellationReason,
  isCancelling,
  cancellationError,
  onCancel,
  onGoToChat,
}: PedidoSuccessDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle data-testid="order-success-title">Pedido creado</DialogTitle>
          <DialogDescription data-testid="order-success-description">
            {`El pedido ${createdOrder?.orderNumber ? '#' + createdOrder.orderNumber : ''} se creó correctamente. Usá el chat para coordinar con la sucursal.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {cancellationError && (
            <div className="rounded-lg bg-destructive/15 p-3 text-sm text-destructive">
              {cancellationError}
            </div>
          )}

          {createdOrder && (
            <div
              className="space-y-3 rounded-lg border border-border p-3"
              data-testid="order-summary"
            >
              <p className="text-sm font-medium text-foreground">
                Resumen del pedido
              </p>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>
                  Cliente:{' '}
                  <span className="text-foreground">
                    {createdOrder.customerName}
                  </span>
                  {createdOrder.customerPhone && (
                    <span className="font-mono text-foreground">
                      {' '}
                      ({createdOrder.customerPhone})
                    </span>
                  )}
                </p>
                <p>
                  Sucursal:{' '}
                  <span className="text-foreground">
                    {createdOrder.branchName ?? branch.name}
                  </span>
                </p>
                {branch.address && (
                  <p>
                    Dirección:{' '}
                    <span className="text-foreground">{branch.address}</span>
                  </p>
                )}
                {branch.phone && (
                  <p>
                    Teléfono:{' '}
                    <span className="text-foreground">{branch.phone}</span>
                  </p>
                )}
                {branch.location && (
                  <p>
                    <a
                      href={branch.location}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Ver ubicación en el mapa
                    </a>
                  </p>
                )}
                <p>
                  Horario de retiro estimado:{' '}
                  <span className="text-foreground">
                    {getCurrentOrNextOpening(branch)}
                  </span>
                </p>
                <p>
                  Total:{' '}
                  <span className="font-mono text-foreground">
                    {formatMoney(createdOrder.total)}
                  </span>
                </p>
              </div>
              {createdOrder.items.length > 0 && (
                <ul className="space-y-2 border-t border-border pt-2">
                  {createdOrder.items.map((item, index) => (
                    <li
                      key={`${item.productId}-${index}`}
                      className="flex items-start justify-between gap-2 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-foreground">
                          {item.quantity}x {item.name} ({item.unit})
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatMoney(item.price)} c/u
                        </p>
                        <OrderItemRecipeDetails item={item} />
                      </div>
                      <span className="font-mono text-foreground">
                        {formatMoney(item.price * item.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="cancellation-reason">
              Motivo de cancelación (opcional)
            </Label>
            <Textarea
              id="cancellation-reason"
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              placeholder="Por qué querés cancelar el pedido"
            />
          </div>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button
            type="button"
            variant="destructive"
            onClick={onCancel}
            disabled={isCancelling || !createdOrder}
            className="w-full sm:w-auto"
          >
            {isCancelling ? 'Cancelando...' : 'Cancelar pedido'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Cerrar
          </Button>
          <Button
            type="button"
            onClick={onGoToChat}
            disabled={!createdOrder}
            className="w-full sm:w-auto"
          >
            Ir al chat del pedido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
