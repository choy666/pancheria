'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { nanoid } from 'nanoid';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CajaStatus } from '@/components/caja/caja-status';
import { useCashRegister } from '@/hooks/useCashRegister';
import { PromoOptionsDialog } from '@/components/promo/promo-options-dialog';
import { isPublicSellableProduct } from '@/lib/catalog';
import { authenticatedFetch } from '@/lib/fetch';
import {
  getDefaultSelectedRecipeItemIds,
  getProductAdditional,
  isProductOutOfStock,
  sortSellableProducts,
  type CartItem,
  type SellableProduct,
} from '@/lib/ventas-helpers';
import { SalesProductCard } from '@/components/ventas/sales-product-card';
import { SalesCart } from '@/components/ventas/sales-cart';
import {
  PRODUCTOS_API,
  VENTAS_API,
  VENTAS_DISPONIBILIDAD_API,
} from '@/config/api';
import { formatMoney } from '@/lib/money';
import { usePaymentParts } from '@/hooks/usePaymentParts';

export function SalesTerminal() {
  const router = useRouter();
  const isMountedRef = useRef(true);
  const [products, setProducts] = useState<SellableProduct[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showOutOfStock, setShowOutOfStock] = useState(false);
  const [promoDialogProduct, setPromoDialogProduct] =
    useState<SellableProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cartAvailability, setCartAvailability] = useState<
    Record<number, number>
  >({});
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

  const displayProducts = useMemo(() => {
    if (showOutOfStock) return products;
    return products.filter((product) => {
      if (product.type === 'service') return true;
      const additional = cartAvailability[product.id] ?? product.availability;
      return additional > 0;
    });
  }, [products, showOutOfStock, cartAvailability]);

  async function fetchProducts() {
    try {
      const response = await authenticatedFetch(
        `${PRODUCTOS_API}?includeAvailability=true`,
        {}
      );
      if (!response.ok) throw new Error('Error al cargar productos');

      const allProducts = (await response.json()) as SellableProduct[];
      const sellable = sortSellableProducts(
        allProducts.filter(isPublicSellableProduct)
      );

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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: cart.map((item) => ({
              productId: item.product.id,
              quantity: item.quantity,
              selectedRecipeItemIds: item.selectedRecipeItemIds ?? [],
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

  function addToCart(
    product: SellableProduct,
    selectedRecipeItemIds?: number[]
  ) {
    if (!cashRegister || cashRegister.status !== 'open') return;

    const existing = cart.find((item) => item.product.id === product.id);
    const currentQuantity = existing?.quantity ?? 0;

    if (isProductOutOfStock(product, cartAvailability, currentQuantity)) return;

    const optionalItems =
      product.recipe?.filter((item) => item.isOptional) ?? [];
    if (optionalItems.length > 0 && selectedRecipeItemIds === undefined) {
      setPromoDialogProduct(product);
      return;
    }

    const resolvedSelected =
      selectedRecipeItemIds ?? getDefaultSelectedRecipeItemIds(product);

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
      return [
        ...prev,
        { product, quantity: 1, selectedRecipeItemIds: resolvedSelected },
      ];
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
        const additional = getProductAdditional(
          item.product,
          cartAvailability,
          item.quantity
        );
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

  const {
    paymentParts,
    setPayments: setCustomPayments,
    remaining,
    isComplete,
  } = usePaymentParts(total, { redistributeOnTotalChange: true });

  async function confirmSale() {
    if (cart.length === 0) {
      setError('El carrito está vacío.');
      return;
    }

    if (!cashRegister || cashRegister.status !== 'open') {
      setError(
        'No hay una caja abierta. Abrí la caja para comenzar a vender.'
      );
      await refresh();
      return;
    }

    if (!isComplete) {
      setError(
        `El pago no cubre el total. ${
          remaining > 0
            ? `Faltan ${formatMoney(remaining)}.`
            : `Sobran ${formatMoney(Math.abs(remaining))}.`
        }`
      );
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await authenticatedFetch(VENTAS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
            selectedRecipeItemIds: item.selectedRecipeItemIds ?? [],
          })),
          payments: paymentParts,
          idempotencyKey: nanoid(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al confirmar la venta');
      }

      setCart([]);
      setCustomPayments(null);
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
      <div
        data-tour="caja-status"
        data-loading={cashLoading ? 'true' : undefined}
        className="min-h-[120px]"
      >
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
            <div className="rounded-lg border border-amber-600/20 bg-amber-600/10 p-4 text-base text-amber-700">
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

          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Catálogo</h2>
            <Button
              type="button"
              variant={showOutOfStock ? 'default' : 'outline'}
              size="sm"
              aria-pressed={showOutOfStock}
              onClick={() => setShowOutOfStock((prev) => !prev)}
              data-testid="toggle-show-out-of-stock"
            >
              {showOutOfStock ? 'Ocultar agotados' : 'Mostrar agotados'}
            </Button>
          </div>

          <div
            data-tour="sales-products"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {displayProducts.map((product) => {
              const inCartQuantity =
                cart.find((item) => item.product.id === product.id)?.quantity ??
                0;

              return (
                <SalesProductCard
                  key={product.id}
                  product={product}
                  cartAvailability={cartAvailability}
                  inCartQuantity={inCartQuantity}
                  cartDisabled={cartDisabled}
                  onAdd={addToCart}
                />
              );
            })}
          </div>
        </div>

        <SalesCart
          cart={cart}
          cartAvailability={cartAvailability}
          cartDisabled={cartDisabled}
          isSubmitting={isSubmitting}
          isCheckingAvailability={isCheckingAvailability}
          hasShortage={Object.keys(cartShortage).length > 0}
          total={total}
          paymentParts={paymentParts}
          isPaymentComplete={isComplete}
          onPaymentChange={setCustomPayments}
          onUpdateQuantity={updateQuantity}
          onConfirm={confirmSale}
        />
      </div>

      {promoDialogProduct && (
        <PromoOptionsDialog
          open={promoDialogProduct !== null}
          onOpenChange={(open) => {
            if (!open) setPromoDialogProduct(null);
          }}
          productName={promoDialogProduct.name}
          productPrice={promoDialogProduct.price}
          recipe={promoDialogProduct.recipe ?? []}
          onConfirm={(selected) => {
            addToCart(promoDialogProduct, selected);
            setPromoDialogProduct(null);
          }}
        />
      )}
    </div>
  );
}
