import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/money';
import type { CartItem } from '@/hooks/useCart';

function CartItemRecipeDetails({ item }: { item: CartItem }) {
  if (!item.recipe || item.recipe.length === 0) return null;

  const selectedIds = new Set(item.selectedRecipeItemIds ?? []);
  const selected = item.recipe.filter(
    (r) => !r.isOptional || selectedIds.has(r.supplyId)
  );
  const removed = item.recipe.filter(
    (r) => r.isOptional && !selectedIds.has(r.supplyId)
  );

  return (
    <span>
      {selected.length > 0 && `Incluye: ${selected.map((r) => r.supplyName).join(', ')}.`}
      {removed.length > 0 && ` Sin: ${removed.map((r) => r.supplyName).join(', ')}.`}
    </span>
  );
}

interface CartSummaryProps {
  branchName?: string;
  items: CartItem[];
  total: number;
  onUpdateQuantity: (productId: number, quantity: number) => void;
  onRemove: (productId: number) => void;
  onCheckout: () => void;
  disabled?: boolean;
}

export function CartSummary({
  branchName,
  items,
  total,
  onUpdateQuantity,
  onRemove,
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
                key={item.id}
                data-testid={`cart-item-${item.id}`}
                className="flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="font-mono text-sm text-muted-foreground">
                    {formatMoney(item.price)} x {item.quantity}
                  </p>
                  {item.type === 'compound' && item.recipe && item.recipe.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      <CartItemRecipeDetails item={item} />
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
                      onUpdateQuantity(item.id, item.quantity - 1)
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
                      onUpdateQuantity(item.id, item.quantity + 1)
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
                    onClick={() => onRemove(item.id)}
                    disabled={disabled}
                  >
                    ×
                  </Button>
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
