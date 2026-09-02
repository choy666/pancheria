import { formatMoney } from '@/lib/money';
import { formatRecipeSummary } from '@/lib/recipe-helpers';
import type { RecipeItemConfig } from '@/domain/types';

interface OrderDetailItem {
  id: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  product?: {
    name: string;
    unit: string;
  } | null;
  recipeSnapshot?: RecipeItemConfig[];
}

interface PedidoItemsListProps {
  items: OrderDetailItem[];
}

function ItemRecipeDetails({
  recipeSnapshot,
}: {
  recipeSnapshot?: RecipeItemConfig[];
}) {
  if (!recipeSnapshot || recipeSnapshot.length === 0) return null;

  const summary = formatRecipeSummary(recipeSnapshot);
  if (!summary) return null;

  return <p className="text-xs text-muted-foreground">{summary}</p>;
}

export function PedidoItemsList({ items }: PedidoItemsListProps) {
  return (
    <div className="rounded-2xl border border-white/8">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/8 text-left text-muted-foreground">
            <th className="p-3">Producto</th>
            <th className="p-3 text-right">Cantidad</th>
            <th className="p-3 text-right">Precio unitario</th>
            <th className="p-3 text-right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className="border-b border-white/8 last:border-0"
            >
              <td className="p-3">
                <div>
                  {item.product?.name ?? `Producto ${item.productId}`}
                  <ItemRecipeDetails recipeSnapshot={item.recipeSnapshot} />
                </div>
              </td>
              <td className="p-3 text-right">{item.quantity}</td>
              <td className="p-3 text-right">
                {formatMoney(item.unitPrice)}
              </td>
              <td className="p-3 text-right font-mono">
                {formatMoney(item.subtotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
