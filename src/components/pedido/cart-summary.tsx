import { Button } from '@/components/ui/button';
import { CardTitle } from '@/components/ui/card';
import { ShoppingBag } from 'lucide-react';
import { formatMoney } from '@/lib/money';
import { CartPanel } from '@/components/cart/cart-panel';
import { CartItemRecipeDetails } from './cart-item-recipe-details';
import { hasOptionalRecipeItems } from '@/lib/cart-helpers';
import type { CartItem } from '@/hooks/useCart';

/**
 * El API público solo expone qué productos no alcanzan la disponibilidad
 * (presencia), sin nombres de insumos ni cantidades internas.
 */
type ShortageByProduct = Record<number, boolean>;

interface CartSummaryProps {
  branchName?: string;
  items: CartItem[];
  total: number;
  shortageByProduct?: ShortageByProduct;
  onUpdateQuantity: (lineId: string, quantity: number) => void;
  onRemove: (lineId: string) => void;
  onEditLine?: (lineId: string) => void;
  onCheckout: () => void;
  disabled?: boolean;
  /** `true` mientras se verifica la disponibilidad de los ítems. */
  isCheckingAvailability?: boolean;
}

export function CartSummary({
  branchName,
  items,
  total,
  shortageByProduct = {},
  onUpdateQuantity,
  onRemove,
  onEditLine,
  onCheckout,
  disabled = false,
  isCheckingAvailability = false,
}: CartSummaryProps) {
  const top = branchName ? (
    <p className="text-sm text-muted-foreground">
      Sucursal: <span className="text-foreground">{branchName}</span>
    </p>
  ) : null;

  const empty = (
    <div className="flex flex-col items-center gap-2 py-2 text-center">
      <ShoppingBag
        className="size-6 text-muted-foreground"
        aria-hidden="true"
      />
      <p className="text-base text-muted-foreground">
        Todavía no agregaste productos. Elegí del catálogo para empezar.
      </p>
    </div>
  );

  const list = (() => {
    const shownShortageProductIds = new Set<number>();
    return (
      <ul className="space-y-3">
        {items.map((item) => {
          const personalizable = hasOptionalRecipeItems(item);
          const shortage = shortageByProduct[item.id];
          const showShortage =
            shortage && !shownShortageProductIds.has(item.id);
          if (showShortage) shownShortageProductIds.add(item.id);
          return (
            <li
              key={item.lineId}
              data-testid="cart-item"
              data-line-id={item.lineId}
              data-product-id={item.id}
              data-product-name={item.name}
              className="flex items-center justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.name}</p>
                <p className="font-mono text-sm text-muted-foreground">
                  {personalizable
                    ? formatMoney(item.price)
                    : `${formatMoney(item.price)} x ${item.quantity}`}
                </p>
                {item.type === 'compound' &&
                  item.recipe &&
                  item.recipe.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      <CartItemRecipeDetails
                        recipe={item.recipe}
                        selectedRecipeItemIds={item.selectedRecipeItemIds}
                      />
                    </p>
                  )}
                {showShortage && (
                  <p
                    data-testid="cart-item-shortage"
                    className="text-xs font-medium text-amber-700"
                  >
                    {item.name}: no alcanza la disponibilidad. Bajá la cantidad
                    o quitalo.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!personalizable && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label="Disminuir cantidad"
                      onClick={() =>
                        onUpdateQuantity(item.lineId, item.quantity - 1)
                      }
                      disabled={disabled}
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
                      aria-label="Aumentar cantidad"
                      onClick={() =>
                        onUpdateQuantity(item.lineId, item.quantity + 1)
                      }
                      disabled={disabled}
                    >
                      +
                    </Button>
                  </>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Quitar producto"
                  onClick={() => onRemove(item.lineId)}
                  disabled={disabled}
                >
                  ×
                </Button>
                {personalizable && onEditLine && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Editar personalización de ${item.name}`}
                    onClick={() => onEditLine(item.lineId)}
                    disabled={disabled}
                  >
                    Editar
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    );
  })();

  const footer = (
    <>
      <div className="border-t border-white/10 pt-4">
        <p className="font-mono text-2xl font-bold">Total: {formatMoney(total)}</p>
      </div>

      {isCheckingAvailability && items.length > 0 && (
        <p
          role="status"
          className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground"
        >
          <span className="inline-block size-2 animate-pulse rounded-full bg-muted-foreground" />
          Verificando disponibilidad...
        </p>
      )}

      <div className="space-y-1.5">
        <Button
          type="button"
          className="w-full"
          disabled={
            items.length === 0 ||
            disabled ||
            Object.keys(shortageByProduct).length > 0
          }
          onClick={onCheckout}
          data-testid="checkout-button"
        >
          Hacer pedido
        </Button>
        {Object.keys(shortageByProduct).length > 0 && (
          <p
            data-testid="checkout-blocker"
            aria-live="polite"
            className="text-center text-xs text-muted-foreground"
          >
            Algunos productos no alcanzan la disponibilidad. Revisá las líneas
            marcadas.
          </p>
        )}
      </div>
    </>
  );

  return (
    <CartPanel
      title={<CardTitle data-testid="cart-title" className="text-lg">Tu pedido</CardTitle>}
      top={top}
      hasItems={items.length > 0}
      list={list}
      empty={empty}
      footer={footer}
    />
  );
}
