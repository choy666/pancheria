'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { nanoid } from 'nanoid';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CajaStatus } from '@/components/caja/caja-status';
import { useCashRegister } from '@/hooks/useCashRegister';
import { useSellableCart } from '@/hooks/useSellableCart';
import { PromoOptionsDialog } from '@/components/promo/promo-options-dialog';
import type { PromoOptionsConfirmPayload } from '@/components/promo/promo-options-dialog';
import { isPublicSellableProduct } from '@/lib/catalog';
import { authenticatedFetch, throwApiError } from '@/lib/fetch';
import { groupCartItemsForSubmit, hasOptionalRecipeItems } from '@/lib/cart-helpers';
import {
  sortSellableProducts,
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

interface SalesTerminalProps {
  role?: 'admin' | 'operator';
  userName?: string | null;
}

export function SalesTerminal({ role = 'operator', userName }: SalesTerminalProps) {
  const router = useRouter();
  const isMountedRef = useRef(true);
  const [products, setProducts] = useState<SellableProduct[]>([]);
  const [showOutOfStock, setShowOutOfStock] = useState(false);
  const [promoDialogProduct, setPromoDialogProduct] =
    useState<SellableProduct | null>(null);
  const [promoDialogKey, setPromoDialogKey] = useState(0);
  const [editingLine, setEditingLine] = useState<{
    lineId: string;
    product: SellableProduct;
    initialSelectedIds: number[];
    dialogKey: string;
  } | null>(null);
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
  const lastAvailabilityCartRef = useRef<Record<number, number>>({});

  const getAvailability = useCallback(
    (productId: number) => {
      const product = products.find((p) => p.id === productId);
      if (!product) return 0;
      if (product.type === 'service') return Number.MAX_SAFE_INTEGER;
      const inCartRequest = lastAvailabilityCartRef.current[productId] ?? 0;
      const additional = cartAvailability[productId] ?? product.availability;
      return inCartRequest + additional;
    },
    [products, cartAvailability]
  );

  const handleOutOfStock = useCallback(
    () => setIsCheckingAvailability(false),
    []
  );

  const {
    lines,
    total,
    addItem: addLine,
    updateQuantity: updateLineQuantity,
    removeItem: removeLine,
    updateSelectedRecipeItemIds: updateLineSelection,
    clearCart: clearLines,
  } = useSellableCart<SellableProduct>({
    getAvailability,
    onOutOfStock: handleOutOfStock,
  });

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
      if (!response.ok) {
        await throwApiError(response, 'Error al cargar productos');
      }

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

      const requestItems = groupCartItemsForSubmit(
        lines.map((line) => ({
          productId: line.product.id,
          quantity: line.quantity,
          selectedRecipeItemIds: line.selectedRecipeItemIds,
        }))
      );

      try {
        const response = await authenticatedFetch(VENTAS_DISPONIBILIDAD_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: requestItems,
            productIds: products.map((p) => p.id),
          }),
        });

        if (!response.ok) {
          await throwApiError(response, 'Error al calcular disponibilidad');
        }

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

        const requestCart: Record<number, number> = {};
        for (const item of requestItems) {
          requestCart[item.productId] =
            (requestCart[item.productId] ?? 0) + item.quantity;
        }
        lastAvailabilityCartRef.current = requestCart;
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
  }, [lines, products]);

  function addToCart(
    product: SellableProduct,
    selectedRecipeItemIds?: number[]
  ) {
    if (!cashRegister || cashRegister.status !== 'open') return;
    setError(null);

    if (hasOptionalRecipeItems(product) && selectedRecipeItemIds === undefined) {
      setPromoDialogKey((prev) => prev + 1);
      setPromoDialogProduct(product);
      return;
    }

    setIsCheckingAvailability(true);
    addLine(product, selectedRecipeItemIds);
  }

  function removeFromCart(lineId: string) {
    setError(null);
    setIsCheckingAvailability(true);
    removeLine(lineId);
  }

  function clearCart() {
    setError(null);
    setCustomPayments(null);
    setIsCheckingAvailability(true);
    clearLines();
  }

  function updateQuantity(lineId: string, quantity: number) {
    if (quantity <= 0) {
      removeFromCart(lineId);
      return;
    }

    setError(null);
    setIsCheckingAvailability(true);
    updateLineQuantity(lineId, quantity);
  }

  const startEditLine = useCallback((lineId: string) => {
    const item = lines.find((i) => i.lineId === lineId);
    if (!item) return;

    const product =
      products.find((p) => p.id === item.product.id) ?? item.product;
    setEditingLine({
      lineId,
      product,
      initialSelectedIds: item.selectedRecipeItemIds,
      dialogKey: nanoid(),
    });
    setPromoDialogProduct(null);
  }, [lines, products]);

  const cancelEditLine = useCallback(() => {
    setEditingLine(null);
  }, []);

  const confirmEditLine = useCallback(
    ({ selectedRecipeItemIds }: PromoOptionsConfirmPayload) => {
      if (!editingLine) return;

      setIsCheckingAvailability(true);
      updateLineSelection(editingLine.lineId, selectedRecipeItemIds);
      setEditingLine(null);
    },
    [editingLine, updateLineSelection]
  );

  const {
    paymentParts,
    setPayments: setCustomPayments,
    remaining,
    isComplete,
  } = usePaymentParts(total, { redistributeOnTotalChange: true });

  async function confirmSale() {
    if (lines.length === 0) {
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
          items: groupCartItemsForSubmit(
            lines.map((line) => ({
              productId: line.product.id,
              quantity: line.quantity,
              selectedRecipeItemIds: line.selectedRecipeItemIds,
            }))
          ),
          payments: paymentParts.filter((p) => p.amount > 0),
          idempotencyKey: nanoid(),
        }),
      });

      if (!response.ok) {
        await throwApiError(response, 'Error al confirmar la venta');
      }

      clearLines();
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
          role={role}
          userName={userName}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
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
              const inCartQuantity = lines.reduce(
                (sum, line) =>
                  line.product.id === product.id
                    ? sum + line.quantity
                    : sum,
                0
              );

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
          cart={lines}
          cartAvailability={cartAvailability}
          cartShortage={cartShortage}
          cartDisabled={cartDisabled}
          isSubmitting={isSubmitting}
          isCheckingAvailability={isCheckingAvailability}
          total={total}
          paymentParts={paymentParts}
          paymentRemaining={remaining}
          isPaymentComplete={isComplete}
          error={error}
          onPaymentChange={(next) => {
            setError(null);
            setCustomPayments(next);
          }}
          onUpdateQuantity={updateQuantity}
          onRemoveItem={removeFromCart}
          onClearCart={clearCart}
          onEditLine={startEditLine}
          onConfirm={confirmSale}
        />
      </div>

      {promoDialogProduct && !editingLine && (
        <PromoOptionsDialog
          key={promoDialogKey}
          open={promoDialogProduct !== null}
          onOpenChange={(open) => {
            if (!open) setPromoDialogProduct(null);
          }}
          productName={promoDialogProduct.name}
          productPrice={promoDialogProduct.price}
          recipe={promoDialogProduct.recipe ?? []}
          onConfirm={({ selectedRecipeItemIds }) => {
            addToCart(promoDialogProduct, selectedRecipeItemIds);
            setPromoDialogProduct(null);
          }}
          confirmLabel="Agregar a la venta"
        />
      )}

      {editingLine && (
        <PromoOptionsDialog
          key={editingLine.dialogKey}
          open={editingLine !== null}
          onOpenChange={(open) => {
            if (!open) cancelEditLine();
          }}
          productName={editingLine.product.name}
          productPrice={editingLine.product.price}
          recipe={editingLine.product.recipe ?? []}
          initialSelectedIds={editingLine.initialSelectedIds}
          onConfirm={confirmEditLine}
          mode="edit"
          confirmLabel="Guardar cambios"
        />
      )}
    </div>
  );
}
