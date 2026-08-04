'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { nanoid } from 'nanoid';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch('/api/productos', { credentials: 'include' });
        if (!response.ok) throw new Error('Error al cargar productos');

        const allProducts = (await response.json()) as Product[];
        const sellable = allProducts.filter(
          (p) => p.type === 'compound' || p.criticalSupplyType === 'beverage'
        );

        const withAvailability = await Promise.all(
          sellable.map(async (p) => {
            const res = await fetch(`/api/productos/disponibilidad?productId=${p.id}`, { credentials: 'include' });
            const data = (await res.json()) as { availability: number };
            return { ...p, availability: data.availability };
          })
        );

        setProducts(withAvailability);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  function addToCart(product: Product) {
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

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/ventas', {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) return <p>Cargando...</p>;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-destructive">
            {error}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <Card
              key={product.id}
              className={`cursor-pointer transition-colors ${
                product.availability <= 0 ? 'opacity-60' : 'hover:bg-muted'
              }`}
              onClick={() => addToCart(product)}
            >
              <CardHeader className="p-4">
                <CardTitle className="text-lg">{product.name}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-2xl font-bold">
                  ${product.price.toFixed(2)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Disponible: {product.availability} {product.unit}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Pedido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {cart.length === 0 ? (
              <p className="text-muted-foreground">El carrito está vacío.</p>
            ) : (
              <ul className="space-y-2">
                {cart.map((item) => (
                  <li
                    key={item.product.id}
                    className="flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium">{item.product.name}</p>
                      <p className="text-sm text-muted-foreground">
                        ${item.product.price.toFixed(2)} x {item.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateQuantity(item.product.id, item.quantity - 1)
                        }
                      >
                        -
                      </Button>
                      <span className="w-6 text-center">{item.quantity}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateQuantity(item.product.id, item.quantity + 1)
                        }
                      >
                        +
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="border-t pt-4">
              <p className="text-2xl font-bold">Total: ${total.toFixed(2)}</p>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setPaymentMethod('cash')}
              >
                Efectivo
              </Button>
              <Button
                type="button"
                variant={paymentMethod === 'transfer' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setPaymentMethod('transfer')}
              >
                Transferencia
              </Button>
            </div>

            <Button
              type="button"
              className="w-full"
              disabled={cart.length === 0 || isSubmitting}
              onClick={confirmSale}
            >
              {isSubmitting ? 'Procesando...' : 'Confirmar venta'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
