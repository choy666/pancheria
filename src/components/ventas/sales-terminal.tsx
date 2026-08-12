'use client';

import { authenticatedFetch } from '@/lib/fetch';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { nanoid } from 'nanoid';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CajaStatus } from '@/components/caja/caja-status';
import { useCashRegister } from '@/hooks/useCashRegister';
import { Skeleton } from '@/components/ui/skeleton';
import {
  PRODUCTOS_API,
  VENTAS_API,
  VENTAS_DISPONIBILIDAD_API,
} from '@/config/api';

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

function isSellableProduct(product: Product): boolean {
  return (
    product.type === 'compound' ||
    product.type === 'service' ||
    (product.type === 'critical_supply' && product.criticalSupplyType === 'beverage')
  );
}

function sellablePriority(product: Product): number {
  if (product.type === 'compound') return 1;
  if (
    product.type === 'critical_supply' &&
    product.criticalSupplyType === 'beverage'
  ) {
    return 2;
  }
  if (product.type === 'service') return 3;
  return 4;
}

function sortSellableProducts(products: Product[]): Product[] {
  return [...products].sort((a, b) => {
    const priorityA = sellablePriority(a);
    const priorityB = sellablePriority(b);
    if (priorityA !== priorityB) return priorityA - priorityB;
    return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
  });
}

export function SalesTerminal() {
  const router = useRouter();
  const isMountedRef = useRef(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cartAvailability, setCartAvailability] = useState<Record<number, number>>({});
  const [cartShortage, setCartShortage] = useState<
    Record<number, { available: number; required: number; supplyName: string }>
  >({});
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const availabilityRequestIdRef = useRef(0);

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
      const response = await authenticatedFetch(`${PRODUCTOS_API}?includeAvailability=true`, {});
      if (!response.ok) throw new Error('Error al cargar productos');

      const allProducts = (await response.json()) as Product[];
      const sellable = sortSellableProducts(allProducts.filter(isSellableProduct));

      if (!isMountedRef.current) return;
      setProducts(sellable);
      setIsCheckingAvailability(sellable.length > 0);
    } catch (error) {
      if (!isMountedRef.current) return;
      setError(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    isMountedRef.current = true;
    queueMicrotask(() => void fetchProducts());
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (products.length === 0) return;

    const requestId = ++availabilityRequestIdRef.current;

    const timer = setTimeout(async () => {
      if (requestId !== availabilityRequestIdRef.current) return;

      try {
        const response = await authenticatedFetch(VENTAS_DISPONIBILIDAD_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
            items: cart.map((item) => ({
              productId: item.product.id,
              quantity: item.quantity,
            })),
            productIds: products.map((p) => p.id),
          }),
        });

        if (!response.ok) throw new Error('Error al calcular disponibilidad');

        const data = (await response.json()) as {
          availabilityByProduct: Record<number, number>;
          shortageByProduct: Record<
            number,
            { available: number; required: number; supplyName: string }
          >;
        };

        if (requestId !== availabilityRequestIdRef.current) return;
        if (!isMountedRef.current) return;
        setCartAvailability(data.availabilityByProduct ?? {});
        setCartShortage(data.shortageByProduct ?? {});
      } catch {
        // No saturar la UI con errores de disponibilidad; el confirm mostrará el problema real.
      } finally {
        if (
          isMountedRef.current &&
          requestId === availabilityRequestIdRef.current
        ) {
          setIsCheckingAvailability(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [cart, products]);

  function addToCart(product: Product) {
    if (!cashRegister || cashRegister.status !== 'open') return;

    const existing = cart.find((item) => item.product.id === product.id);
    const currentQuantity = existing?.quantity ?? 0;
    const additional =
      cartAvailability[product.id] ??
      Math.max((product.availability ?? 0) - currentQuantity, 0);

    if (product.type !== 'service' && additional <= 0) return;

    setIsCheckingAvailability(true);
    setCart((prev) => {
      const item = prev.find((i) => i.product.id === product.id);
      if (item) {
        return prev.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  function removeFromCart(productId: number) {
    setIsCheckingAvailability(true);
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  }

  function updateQuantity(productId: number, quantity: number) {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setIsCheckingAvailability(true);
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id !== productId) return item;
        const additional =
          cartAvailability[productId] ?? item.product.availability;
        const max = item.quantity + additional;
        const nextQuantity =
          quantity > item.quantity ? Math.min(quantity, max) : quantity;
        return { ...item, quantity: nextQuantity };
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
      const response = await authenticatedFetch(VENTAS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
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
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error desconocido');
      if (
        error instanceof Error &&
        error.message.includes('No hay una caja abierta')
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
      <div data-tour="caja-status">
        <CajaStatus
          cashRegister={cashRegister}
          onOpen={open}
          onClose={close}
          loading={cashLoading}
          error={cashError}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {error && (
            <div className="rounded-lg bg-destructive/15 p-4 text-base text-destructive">
              {error}
            </div>
          )}

          {Object.keys(cartShortage).length > 0 && (
            <div className="rounded-lg bg-destructive/15 p-4 text-base text-destructive">
              {Object.entries(cartShortage).map(([productId, shortage]) => {
                const product =
                  products.find((p) => p.id === Number(productId)) ??
                  cart.find((i) => i.product.id === Number(productId))?.product;
                return (
                  <p key={productId}>
                    Faltan insumos para {product?.name ?? 'producto'}:{' '}
                    {shortage.supplyName} (disponible {shortage.available},
                    requerido {shortage.required}).
                  </p>
                );
              })}
            </div>
          )}

          <div data-tour="sales-products" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => {
              const additional =
                cartAvailability[product.id] ?? product.availability;
              const maxAdditional =
                product.type === 'service'
                  ? Number.MAX_SAFE_INTEGER
                  : additional;
              const isOutOfStock =
                product.type !== 'service' && maxAdditional <= 0;

              return (
                <Card
                  key={product.id}
                  className={`transition-all ${
                    isOutOfStock || cartDisabled
                      ? 'opacity-50'
                      : 'cursor-pointer touch-manipulation hover:border-primary/30 hover:bg-muted/40 active:scale-[0.98]'
                  }`}
                  onClick={() => {
                    if (isOutOfStock || cartDisabled) return;
                    addToCart(product);
                  }}
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
                    {product.type !== 'service' && (
                      <p className="text-sm text-muted-foreground">
                        En este pedido:{' '}
                        {maxAdditional === Number.MAX_SAFE_INTEGER
                          ? 'sin límite'
                          : `${maxAdditional} más`}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

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
                          disabled={
                            cartDisabled ||
                            (item.product.type !== 'service' &&
                              (cartAvailability[item.product.id] ??
                                item.product.availability) <= 0)
                          }
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
              disabled={
                cart.length === 0 ||
                isSubmitting ||
                cartDisabled ||
                Object.keys(cartShortage).length > 0 ||
                isCheckingAvailability
              }
              onClick={confirmSale}
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
    </div>
    </div>
  );
}
