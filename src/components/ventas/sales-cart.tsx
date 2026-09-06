'use client';

import { useRef, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PaymentPartsInput } from '@/components/pagos/payment-parts-input';
import { CartItemRecipeDetails } from '@/components/pedido/cart-item-recipe-details';
import { getProductAdditional, type CartItem } from '@/lib/ventas-helpers';
import {
  formatMoney,
  moneyToNumber,
  multiplyMoney,
  parseMoney,
} from '@/lib/money';
import type { PaymentPart } from '@/domain/types';

interface CartShortageInfo {
  available: number;
  required: number;
  supplyName: string;
}

interface SalesCartProps {
  cart: CartItem[];
  cartAvailability: Record<number, number>;
  cartShortage: Record<number, CartShortageInfo>;
  cartDisabled: boolean;
  isSubmitting: boolean;
  isCheckingAvailability: boolean;
  total: number;
  paymentParts: PaymentPart[];
  paymentRemaining: number;
  isPaymentComplete: boolean;
  error: string | null;
  onPaymentChange: (payments: PaymentPart[]) => void;
  onUpdateQuantity: (lineId: string, quantity: number) => void;
  onRemoveItem: (lineId: string) => void;
  onClearCart: () => void;
  onEditLine?: (lineId: string) => void;
  onConfirm: () => void;
}

export function SalesCart({
  cart,
  cartAvailability,
  cartShortage,
  cartDisabled,
  isSubmitting,
  isCheckingAvailability,
  total,
  paymentParts,
  paymentRemaining,
  isPaymentComplete,
  error,
  onPaymentChange,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onEditLine,
  onConfirm,
}: SalesCartProps) {
  const cartRef = useRef<HTMLDivElement>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const hasShortage = Object.keys(cartShortage).length > 0;
  const controlsDisabled = cartDisabled || isSubmitting;

  const confirmDisabled =
    cart.length === 0 ||
    isSubmitting ||
    cartDisabled ||
    hasShortage ||
    isCheckingAvailability ||
    !isPaymentComplete;

  const blockerReason = isSubmitting
    ? null
    : cartDisabled
      ? 'Abrí la caja para poder confirmar la venta.'
      : cart.length === 0
        ? 'Agregá productos para armar la venta.'
        : hasShortage
          ? 'Hay productos sin insumos suficientes. Revisá las líneas marcadas.'
          : isCheckingAvailability
            ? 'Verificando disponibilidad…'
            : !isPaymentComplete
              ? paymentRemaining > 0
                ? `Faltan ${formatMoney(paymentRemaining)} por cobrar.`
                : `Sobran ${formatMoney(
                    Math.abs(paymentRemaining)
                  )}: ajustá los montos.`
              : null;

  return (
    <div data-tour="sales-cart" className="space-y-4" ref={cartRef}>
      <Card className="lg:sticky lg:top-24">
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Venta actual</CardTitle>
            {itemCount > 0 && (
              <Badge variant="secondary" data-testid="cart-item-count">
                {itemCount} {itemCount === 1 ? 'ítem' : 'ítems'}
              </Badge>
            )}
          </div>
          {cart.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-testid="cart-clear"
              disabled={controlsDisabled}
              onClick={() => setConfirmClearOpen(true)}
            >
              Vaciar
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-5">
          {cartDisabled && (
            <div
              data-testid="cart-closed-register"
              className="rounded-lg border border-amber-600/20 bg-amber-600/10 p-3 text-sm text-amber-700"
            >
              La caja está cerrada. Abrí la caja desde el panel superior para
              comenzar a vender.
            </div>
          )}

          {cart.length === 0 ? (
            <p
              data-testid="empty-cart-message"
              className="text-base text-muted-foreground"
            >
              El carrito está vacío.
            </p>
          ) : (
            <ul className="space-y-4">
              {cart.map((item) => {
                const additional = getProductAdditional(
                  item.product,
                  cartAvailability,
                  item.quantity
                );
                const canIncrease =
                  item.product.type === 'service' || additional > 0;
                const lineSubtotal = moneyToNumber(
                  multiplyMoney(
                    parseMoney(item.product.price),
                    item.quantity
                  )
                );
                const shortage = cartShortage[item.product.id];

                return (
                  <li
                    key={item.lineId}
                    data-testid="cart-item"
                    data-line-id={item.lineId}
                    data-product-id={item.product.id}
                    data-product-name={item.product.name}
                    className="space-y-1"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate font-medium">
                        {item.product.name}
                      </p>
                      <p className="shrink-0 font-mono text-sm font-medium">
                        {formatMoney(lineSubtotal)}
                      </p>
                    </div>
                    <p className="font-mono text-xs text-muted-foreground">
                      {formatMoney(item.product.price)} c/u
                    </p>
                    {item.product.type === 'compound' &&
                      item.product.recipe &&
                      item.product.recipe.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          <CartItemRecipeDetails
                            recipe={item.product.recipe}
                            selectedRecipeItemIds={item.selectedRecipeItemIds}
                          />
                        </p>
                      )}
                    {shortage && (
                      <p
                        data-testid="cart-item-shortage"
                        className="text-xs font-medium text-amber-700"
                      >
                        Sin insumos suficientes: falta {shortage.supplyName}{' '}
                        (disponible {shortage.available}, requerido{' '}
                        {shortage.required}).
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label={`Disminuir cantidad de ${item.product.name}`}
                        onClick={() =>
                          onUpdateQuantity(item.lineId, item.quantity - 1)
                        }
                        disabled={controlsDisabled}
                      >
                        -
                      </Button>
                      <span className="min-w-8 text-center font-mono text-base">
                        {item.quantity}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label={`Aumentar cantidad de ${item.product.name}`}
                        onClick={() =>
                          onUpdateQuantity(item.lineId, item.quantity + 1)
                        }
                        disabled={controlsDisabled || !canIncrease}
                      >
                        +
                      </Button>
                      {item.product.type === 'compound' &&
                        item.product.recipe &&
                        item.product.recipe.some((r) => r.isOptional) &&
                        onEditLine && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={`Personalizar ${item.product.name}`}
                            onClick={() => onEditLine(item.lineId)}
                            disabled={controlsDisabled}
                            className="gap-1"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Personalizar
                          </Button>
                        )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        data-testid="cart-item-remove"
                        aria-label={`Quitar ${item.product.name}`}
                        onClick={() => onRemoveItem(item.lineId)}
                        disabled={controlsDisabled}
                        className="ml-auto text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="border-t border-white/10 pt-4">
            <p
              className="font-mono text-2xl font-bold"
              aria-live="polite"
            >
              Total: {formatMoney(total)}
            </p>
          </div>

          <div className="space-y-3 border-t border-white/10 pt-4">
            <p className="text-sm font-semibold">Cobro</p>
            <PaymentPartsInput
              total={total}
              payments={paymentParts}
              onChange={onPaymentChange}
              disabled={controlsDisabled}
            />
          </div>

          {error && (
            <div
              data-testid="sale-error"
              className="rounded-lg bg-destructive/15 p-3 text-sm text-destructive"
            >
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Button
              type="button"
              className="w-full"
              data-testid="confirm-sale-button"
              disabled={confirmDisabled}
              onClick={onConfirm}
            >
              {isSubmitting ? 'Procesando…' : 'Confirmar venta'}
            </Button>
            {blockerReason && (
              <p
                data-testid="confirm-sale-blocker"
                aria-live="polite"
                className="text-center text-xs text-muted-foreground"
              >
                {blockerReason}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmClearOpen}
        title="Vaciar venta"
        description="Se quitan todos los productos y el pago de la venta actual."
        confirmLabel="Vaciar"
        onConfirm={() => {
          setConfirmClearOpen(false);
          onClearCart();
        }}
        onCancel={() => setConfirmClearOpen(false)}
      />

      {itemCount > 0 && (
        <>
          <div className="h-14 lg:hidden" aria-hidden="true" />
          <button
            type="button"
            data-testid="cart-mobile-bar"
            onClick={() =>
              cartRef.current?.scrollIntoView({ behavior: 'smooth' })
            }
            className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t bg-background/95 px-4 py-3 text-sm font-medium backdrop-blur lg:hidden"
          >
            <span>
              {itemCount} {itemCount === 1 ? 'ítem' : 'ítems'}
            </span>
            <span className="font-mono">{formatMoney(total)}</span>
            <span className="text-primary">Ver venta</span>
          </button>
        </>
      )}
    </div>
  );
}
