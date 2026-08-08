'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { nanoid } from 'nanoid';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CajaStatus } from '@/components/caja/caja-status';
import { useCashRegister } from '@/hooks/useCashRegister';
import { Skeleton } from '@/components/ui/skeleton';
import { PRODUCTOS_API, VENTAS_API } from '@/config/api';

interface Product {
  id: number;
  name: string;
  price: number;
  unit: string;
  type: string;
  criticalSupplyType: string | null;
  availability: number;
}

interface CartItem {
  product: Product;
  quantity: number;
}

export function SalesTerminal() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    cashRegister,
    loading: cashLoading,
    error: cashError,
    open,
    close,
    refresh,
  } = useCashRegister();

  async function fetchProducts() {
    try {
      const response = await fetch(`${PRODUCTOS_API}?includeAvailability=true`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Error al cargar productos');

      const allProducts = (await response.json()) as Product[];
      const sellable = allProducts.filter(
        (p) =>
          p.type === 'compound' ||
          p.type === 'service' ||
          p.criticalSupplyType === 'beverage'
      );

      setProducts(sellable);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => void fetchProducts());
  }, []);

  function addToCart(product: Product) {
    if (!cashRegister || cashRegister.status !== 'open') return;

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.availability) return prev;
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      if (product.availability <= 0) return prev;
      return [...prev, { product, quantity: 1 }];
    });
  }

  function removeFromCart(productId: number) {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  }

  function updateQuantity(productId: number, quantity: number) {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id !== productId) return item;
        const max = item.product.availability;
        return { ...item, quantity: Math.min(quantity, max) };
      })
    );
  }

  const total = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  async function confirmSale() {
    if (cart.length === 0) {
      setError('El carrito está vacío.');
      return;
    }

    if (!cashRegister || cashRegister.status !== 'open') {
      setError('No hay una caja abierta. Abrí la caja para comenzar a vender.');
      await refresh();
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(VENTAS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          items: cart.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
          })),
          paymentMethod,
          idempotencyKey: nanoid(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al confirmar la venta');
      }

      setCart([]);
      router.refresh();
      await refresh();
      await fetchProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      if (
        err instanceof Error &&
        err.message.includes('No hay una caja abierta')
      ) {
        await refresh();
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  const cartDisabled = !cashRegister || cashRegister.status !== 'open';

  return (
    <div className="space-y-5">
      <CajaStatus
        cashRegister={cashRegister}
        onOpen={open}
        onClose={close}
        loading={cashLoading}
        error={cashError}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {error && (
            <div className="rounded-lg bg-destructive/15 p-4 text-base text-destructive">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <Card
                key={product.id}
                className={`transition-all ${
                  (product.type !== 'service' && product.availability <= 0) ||
                  cartDisabled
                    ? 'opacity-50'
                    : 'cursor-pointer touch-manipulation hover:border-primary/30 hover:bg-muted/40 active:scale-[0.98]'
                }`}
                onClick={() => addToCart(product)}
              >
                <CardHeader className="p-5">
                  <CardTitle className="text-lg font-semibold leading-tight">
                    {product.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 pt-0">
                  <p className="font-mono text-2xl font-bold text-primary">
                    ${product.price.toFixed(2)}
                  </p>
                  <p className="mt-1 text-base text-muted-foreground">
                    {product.type === 'service'
                      ? 'Disponible: sin límite'
                      : `Disponible: ${product.availability} ${product.unit}`}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="space-y-4">
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
                  {cart.map((item) => (
                    <li
                      key={item.product.id}
                      className="flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{item.product.name}</p>
                        <p className="font-mono text-sm text-muted-foreground">
                          ${item.product.price.toFixed(2)} x {item.quantity}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          aria-label="Disminuir cantidad"
                          onClick={() =>
                            updateQuantity(item.product.id, item.quantity - 1)
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
                          aria-label="Aumentar cantidad"
                          onClick={() =>
                            updateQuantity(item.product.id, item.quantity + 1)
                          }
                          disabled={cartDisabled}
                        >
                          +
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

              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                onClick={() => setPaymentMethod('cash')}
                disabled={cartDisabled}
              >
                Efectivo
              </Button>
              <Button
                type="button"
                variant={paymentMethod === 'transfer' ? 'default' : 'outline'}
                onClick={() => setPaymentMethod('transfer')}
                disabled={cartDisabled}
              >
                Transferencia
              </Button>
            </div>

            <Button
              type="button"
              className="w-full"
              disabled={cart.length === 0 || isSubmitting || cartDisabled}
              onClick={confirmSale}
            >
              {isSubmitting ? 'Procesando...' : 'Confirmar venta'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
    </div>
  );
}
