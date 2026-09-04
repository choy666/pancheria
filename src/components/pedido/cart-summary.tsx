import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/money';
import { CartItemRecipeDetails } from './cart-item-recipe-details';
import type { CartItem } from '@/hooks/useCart';

interface CartSummaryProps {
  branchName?: string;
  items: CartItem[];
  total: number;
  onUpdateQuantity: (lineId: string, quantity: number) => void;
  onRemove: (lineId: string) => void;
  onEditLine?: (lineId: string) => void;
  onCheckout: () => void;
  disabled?: boolean;
}

export function CartSummary({
  branchName,
  items,
  total,
  onUpdateQuantity,
  onRemove,
  onEditLine,
  onCheckout,
  disabled = false,
}: CartSummaryProps) {
  return (
    <Card className="lg:sticky lg:top-24">
      <CardHeader>
        <CardTitle className="text-lg">Tu pedido</CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        {branchName && (
          <p className="text-sm text-muted-foreground">
            Sucursal: <span className="text-foreground">{branchName}</span>
          </p>
        )}

        {items.length === 0 ? (
          <p className="text-base text-muted-foreground">
            El carrito está vacío.
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
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
                    {formatMoney(item.price)} x {item.quantity}
                  </p>
                  {item.type === 'compound' && item.recipe && item.recipe.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      <CartItemRecipeDetails
                        recipe={item.recipe}
                        selectedRecipeItemIds={item.selectedRecipeItemIds}
                      />
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
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
                  {item.type === 'compound' &&
                    item.recipe &&
                    item.recipe.some((r) => r.isOptional) &&
                    onEditLine && (
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
            ))}
          </ul>
        )}

        <div className="border-t border-white/10 pt-4">
          <p className="font-mono text-2xl font-bold">
            Total: {formatMoney(total)}
          </p>
        </div>

        <Button
          type="button"
          className="w-full"
          disabled={items.length === 0 || disabled}
          onClick={onCheckout}
          data-testid="checkout-button"
        >
          Hacer pedido
        </Button>
      </CardContent>
    </Card>
  );
}
