'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
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
import { getCurrentOrNextOpening } from '@/lib/branch-helpers';
import { BranchMap } from './branch-map';
import { BranchPhones, BranchSocialLinks } from './branch-contact';
import type { CreatedOrder } from './usePedidoClient';
import type { PublicOrderItem } from '@/domain/types';
import type { Branch } from '@/domain/types';

export function OrderItemRecipeDetails({
  item,
}: {
  item: Pick<PublicOrderItem, 'notes' | 'recipeSnapshot'>;
}) {
  const hasRecipe = !!item.recipeSnapshot && item.recipeSnapshot.length > 0;
  if (!hasRecipe && !item.notes) return null;

  // Vista del cliente: solo los insumos elegidos; los opcionales quitados se
  // listan en el detalle de preparación del panel y del chat, no acá.
  const selected = (item.recipeSnapshot ?? []).filter(
    (r) => !r.isOptional || r.selected
  );

  return (
    <>
      {hasRecipe && (
        <p className="text-xs text-muted-foreground">
          {selected.length > 0 && `Incluye: ${selected.map((r) => r.supplyName).join(', ')}.`}
        </p>
      )}
      {item.notes && (
        <p className="text-xs italic text-muted-foreground">
          Nota: {item.notes}
        </p>
      )}
    </>
  );
}

interface PedidoSuccessDialogProps {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  createdOrder: CreatedOrder | null;
  /** `true` cuando el servidor devolvió un pedido ya registrado (dedup). */
  deduplicated?: boolean;
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
  deduplicated,
  branch,
  cancellationReason,
  setCancellationReason,
  isCancelling,
  cancellationError,
  onCancel,
  onGoToChat,
}: PedidoSuccessDialogProps) {
  const [numberCopied, setNumberCopied] = useState(false);

  async function handleCopyOrderNumber() {
    if (!createdOrder) return;

    try {
      await navigator.clipboard.writeText(createdOrder.orderNumber);
      setNumberCopied(true);
      setTimeout(() => setNumberCopied(false), 2000);
    } catch {
      // Si el portapapeles no está disponible, el número sigue visible.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-theme="light">
        <DialogHeader>
          <DialogTitle data-testid="order-success-title">Pedido creado</DialogTitle>
          <DialogDescription data-testid="order-success-description">
            {`El pedido ${createdOrder?.orderNumber ? '#' + createdOrder.orderNumber : ''} se creó correctamente. Usá el chat para coordinar con la sucursal.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {deduplicated && (
            <div
              className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
              data-testid="order-dedup-notice"
            >
              Este pedido ya estaba registrado: se recuperó el pedido
              original, no se creó uno nuevo.
            </div>
          )}

          {cancellationError && (
            <div className="rounded-lg bg-destructive/15 p-3 text-sm text-destructive">
              {cancellationError}
            </div>
          )}

          {createdOrder && (
            <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-center">
              <p className="text-xs text-muted-foreground">Número de pedido</p>
              <p
                data-testid="order-success-number"
                className="font-mono text-lg font-semibold text-foreground"
              >
                #{createdOrder.orderNumber}
              </p>
              <div className="mt-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleCopyOrderNumber}
                >
                  {numberCopied ? (
                    <Check className="size-4" aria-hidden="true" />
                  ) : (
                    <Copy className="size-4" aria-hidden="true" />
                  )}
                  {numberCopied ? 'Copiado' : 'Copiar número'}
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Guardalo para seguir tu pedido desde &quot;Seguimiento&quot;.
              </p>
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
                <BranchPhones
                  phones={branch.phones ?? []}
                  numberClassName="font-mono text-foreground"
                />
                <BranchSocialLinks links={branch.socialLinks ?? []} />
                {branch.location && (
                  <BranchMap
                    location={branch.location}
                    branchName={createdOrder.branchName ?? branch.name}
                  />
                )}
                {createdOrder.deliveryType === 'delivery' ? (
                  createdOrder.address && (
                    <p>
                      Enviaremos tu pedido a:{' '}
                      <span className="text-foreground">
                        {createdOrder.address}
                      </span>
                    </p>
                  )
                ) : (
                  <p>
                    Horario de retiro estimado:{' '}
                    <span className="text-foreground">
                      {branch.openingHours && branch.openingHours.length > 0
                        ? getCurrentOrNextOpening(branch)
                        : 'Consultá el horario por el chat'}
                    </span>
                  </p>
                )}
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

          <details className="rounded-lg border border-border p-3 text-sm">
            <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
              ¿Necesitás cancelar el pedido?
            </summary>
            <div className="mt-3 space-y-2">
              <Label htmlFor="cancellation-reason">
                Motivo de cancelación (opcional)
              </Label>
              <Textarea
                id="cancellation-reason"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Por qué querés cancelar el pedido"
              />
              <Button
                type="button"
                variant="destructive"
                onClick={onCancel}
                disabled={isCancelling || !createdOrder}
                className="w-full sm:w-auto"
              >
                {isCancelling ? 'Cancelando...' : 'Cancelar pedido'}
              </Button>
            </div>
          </details>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            data-testid="order-success-close"
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
