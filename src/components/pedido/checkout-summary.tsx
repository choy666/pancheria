import { formatMoney } from '@/lib/money';
import { formatRecipeSummary } from '@/lib/recipe-helpers';
import type { CartItem } from '@/hooks/useCart';

interface CheckoutSummaryProps {
  items: CartItem[];
  total: number;
}

function CheckoutItemRecipeDetails({ item }: { item: CartItem }) {
  if (!item.recipe || item.recipe.length === 0) return null;

  const selectedIds = new Set(item.selectedRecipeItemIds ?? []);
  const recipeWithSelection = item.recipe.map((r) => ({
    ...r,
    selected: !r.isOptional || selectedIds.has(r.supplyId),
  }));

  const summary = formatRecipeSummary(recipeWithSelection);
  if (!summary) return null;

  return <span className="text-muted-foreground">{summary}</span>;
}

export function CheckoutSummary({ items, total }: CheckoutSummaryProps) {
  return (
    <div data-testid="checkout-summary" className="space-y-3 rounded-lg border border-border p-4">
      <h3 className="font-semibold">Resumen del pedido</h3>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">El carrito está vacío.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.lineId}
              className="flex items-start justify-between gap-3 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {item.name} x {item.quantity}
                </p>
                {item.type === 'compound' &&
                  item.recipe &&
                  item.recipe.length > 0 && (
                    <p className="text-xs">
                      <CheckoutItemRecipeDetails item={item} />
                    </p>
                  )}
              </div>
              <p className="font-mono text-muted-foreground">
                {formatMoney(item.price * item.quantity)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-border pt-3">
        <p className="font-mono text-xl font-bold">
          Total: {formatMoney(total)}
        </p>
      </div>
    </div>
  );
}
