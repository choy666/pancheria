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
import type { CreatedOrder } from './usePedidoClient';
import type { PublicOrderItem } from '@/lib/whatsapp';

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

interface WhatsAppIconProps {
  className?: string;
}

function WhatsAppIcon({ className }: WhatsAppIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      data-testid="whatsapp-icon"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 1.25C17.9371 1.25 22.75 6.06294 22.75 12C22.75 17.9371 17.9371 22.75 12 22.75C10.1409 22.75 8.39016 22.2775 6.86335 21.4455L2.12395 22.2397C1.88692 22.2794 1.6452 22.2031 1.47391 22.0345C1.30261 21.8659 1.2225 21.6255 1.25845 21.3878L2.05878 16.0977C1.53735 14.8339 1.25001 13.4496 1.25001 12C1.25001 6.06294 6.06295 1.25 12 1.25ZM7.94309 6.7002C7.20774 6.7002 6.599 7.32056 6.71374 8.08595C6.929 9.52188 7.56749 12.1676 9.46536 14.0799C11.4494 16.0789 14.2876 16.9343 15.8259 17.2715C16.6211 17.4459 17.3 16.8158 17.3 16.0387V14.2151C17.3 14.0909 17.2235 13.9796 17.1076 13.935L15.1475 13.1825C15.0949 13.1623 15.0377 13.1573 14.9824 13.1681L13.0048 13.5542C11.7304 12.894 10.958 12.1532 10.4942 11.0387L10.867 9.02365C10.8769 8.97021 10.8721 8.91508 10.8531 8.86416L10.1182 6.89529C10.0744 6.77797 9.96233 6.7002 9.83711 6.7002H7.94309Z"
        fill="currentColor"
      />
    </svg>
  );
}

interface PedidoSuccessDialogProps {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  createdOrder: CreatedOrder | null;
  branchName: string;
  cancellationReason: string;
  setCancellationReason: (value: string) => void;
  isCancelling: boolean;
  cancellationError: string | null;
  onCancel: () => Promise<void>;
  onWhatsApp: () => void;
  onGoToChat: () => void;
}

export function PedidoSuccessDialog({
  open,
  onOpenChange,
  createdOrder,
  branchName,
  cancellationReason,
  setCancellationReason,
  isCancelling,
  cancellationError,
  onCancel,
  onWhatsApp,
  onGoToChat,
}: PedidoSuccessDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pedido creado</DialogTitle>
          <DialogDescription>
            {`El pedido ${createdOrder?.orderNumber ? '#' + createdOrder.orderNumber : ''} se creó correctamente. Usá el chat para coordinar con la sucursal. También podés enviar el pedido por WhatsApp si preferís.`}
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
                    {createdOrder.branchName ?? branchName}
                  </span>
                </p>
                <p>
                  Total:{' '}
                  <span className="font-mono text-foreground">
                    ${createdOrder.total.toFixed(2)}
                  </span>
                </p>
              </div>
              {createdOrder.items.length > 0 && (
                <ul className="space-y-2 border-t border-border pt-2">
                  {createdOrder.items.map((item) => (
                    <li
                      key={item.productId}
                      className="flex items-start justify-between gap-2 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-foreground">
                          {item.quantity}x {item.name} ({item.unit})
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ${item.price.toFixed(2)} c/u
                        </p>
                        <OrderItemRecipeDetails item={item} />
                      </div>
                      <span className="font-mono text-foreground">
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {createdOrder?.whatsappUrl && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Si preferís, envialo por WhatsApp:
              </p>
              <a
                href={createdOrder.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md border border-[#25D366] bg-[#25D366]/10 px-3 py-2 text-sm font-medium text-[#128C7E] hover:bg-[#25D366]/20"
              >
                <WhatsAppIcon className="size-4" />
                Abrir WhatsApp
              </a>
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
          {createdOrder?.whatsappUrl && (
            <Button
              type="button"
              onClick={onWhatsApp}
              variant="outline"
              aria-label="Abrir WhatsApp"
              className="w-full sm:w-auto border-[#25D366] text-[#128C7E] hover:bg-[#25D366]/10"
            >
              <WhatsAppIcon className="size-4" />
              WhatsApp
            </Button>
          )}
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
