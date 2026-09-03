'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PaymentPartsInput } from '@/components/pagos/payment-parts-input';
import { getProductAdditional, type CartItem } from '@/lib/ventas-helpers';
import { formatMoney } from '@/lib/money';
import { formatRecipeSummary } from '@/lib/recipe-helpers';
import type { PaymentPart } from '@/domain/types';

interface SalesCartProps {
  cart: CartItem[];
  cartAvailability: Record<number, number>;
  cartDisabled: boolean;
  isSubmitting: boolean;
  isCheckingAvailability: boolean;
  hasShortage: boolean;
  total: number;
  paymentParts: PaymentPart[];
  isPaymentComplete: boolean;
  onPaymentChange: (payments: PaymentPart[]) => void;
  onUpdateQuantity: (lineId: string, quantity: number) => void;
  onEditLine?: (lineId: string) => void;
  onConfirm: () => void;
}

function SalesCartItemRecipeDetails({ item }: { item: CartItem }) {
  const recipe = item.product.recipe;
  if (!recipe || recipe.length === 0) return null;

  const selectedIds = new Set(item.selectedRecipeItemIds ?? []);
  const recipeWithSelection = recipe.map((r) => ({
    ...r,
    selected: !r.isOptional || selectedIds.has(r.supplyId),
  }));

  const summary = formatRecipeSummary(recipeWithSelection);
  if (!summary) return null;

  return <span>{summary}</span>;
}

export function SalesCart({
  cart,
  cartAvailability,
  cartDisabled,
  isSubmitting,
  isCheckingAvailability,
  hasShortage,
  total,
  paymentParts,
  isPaymentComplete,
  onPaymentChange,
  onUpdateQuantity,
  onEditLine,
  onConfirm,
}: SalesCartProps) {
  return (
    <div data-tour="sales-cart" className="space-y-4">
      <Card className="lg:sticky lg:top-24">
        <CardHeader>
          <CardTitle className="text-lg">Pedido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {cart.length === 0 ? (
            <p className="text-base text-muted-foreground">
              El carrito está vacío.
            </p>
          ) : (
            <ul className="space-y-3">
              {cart.map((item) => {
                const additional = getProductAdditional(
                  item.product,
                  cartAvailability,
                  item.quantity
                );
                const canIncrease =
                  item.product.type === 'service' || additional > 0;

                return (
                  <li
                    key={item.lineId}
                    data-testid="cart-item"
                    data-line-id={item.lineId}
                    data-product-id={item.product.id}
                    data-product-name={item.product.name}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {item.product.name}
                      </p>
                      <p className="font-mono text-sm text-muted-foreground">
                        {formatMoney(item.product.price)} x {item.quantity}
                      </p>
                      {item.product.type === 'compound' &&
                        item.product.recipe &&
                        item.product.recipe.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            <SalesCartItemRecipeDetails item={item} />
                          </p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label={`Disminuir cantidad de ${item.product.name}`}
                        onClick={() =>
                          onUpdateQuantity(item.lineId, item.quantity - 1)
                        }
                        disabled={cartDisabled}
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
                        disabled={cartDisabled || !canIncrease}
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
                            aria-label={`Editar personalización de ${item.product.name}`}
                            onClick={() => onEditLine(item.lineId)}
                            disabled={cartDisabled}
                          >
                            Editar
                          </Button>
                        )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="border-t border-white/10 pt-4">
            <p className="font-mono text-2xl font-bold">
              Total: {formatMoney(total)}
            </p>
          </div>

          <PaymentPartsInput
            total={total}
            payments={paymentParts}
            onChange={onPaymentChange}
            disabled={cartDisabled || isSubmitting}
          />

          <Button
            type="button"
            className="w-full"
            data-testid="confirm-sale-button"
            disabled={
              cart.length === 0 ||
              isSubmitting ||
              cartDisabled ||
              hasShortage ||
              isCheckingAvailability ||
              !isPaymentComplete
            }
            onClick={onConfirm}
          >
            {isSubmitting
              ? 'Procesando...'
              : isCheckingAvailability
                ? 'Calculando disponibilidad...'
                : 'Confirmar venta'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
