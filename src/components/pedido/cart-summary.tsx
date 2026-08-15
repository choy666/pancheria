import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { CartItem } from '@/hooks/useCart';

interface CartSummaryProps {
  items: CartItem[];
  total: number;
  onUpdateQuantity: (productId: number, quantity: number) => void;
  onRemove: (productId: number) => void;
  onCheckout: () => void;
  disabled?: boolean;
}

export function CartSummary({
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
        {items.length === 0 ? (
          <p className="text-base text-muted-foreground">
            El carrito está vacío.
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="font-mono text-sm text-muted-foreground">
                    ${item.price.toFixed(2)} x {item.quantity}
                  </p>
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
            Total: ${total.toFixed(2)}
          </p>
        </div>

        <Button
          type="button"
          className="w-full"
          disabled={items.length === 0 || disabled}
          onClick={onCheckout}
        >
          Pedir por WhatsApp
        </Button>
      </CardContent>
    </Card>
  );
}
