'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { nanoid } from 'nanoid';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CajaStatus } from '@/components/caja/caja-status';
import { useCashRegister } from '@/hooks/useCashRegister';
import { useSellableCart } from '@/hooks/useSellableCart';
import { useVisibilityPolling } from '@/hooks/use-visibility-polling';
import { PromoOptionsDialog } from '@/components/promo/promo-options-dialog';
import type { PromoOptionsConfirmPayload } from '@/components/promo/promo-options-dialog';
import { isPublicSellableProduct } from '@/lib/catalog';
import { authenticatedFetch, throwApiError } from '@/lib/fetch';
import { fetchAllPages } from '@/lib/fetch-all-pages';
import { groupCartItemsForSubmit } from '@/lib/cart-helpers';
import { groupProductsByType } from '@/lib/product-grouping';
import {
  getProductAdditional,
  sortSellableProducts,
  type SellableProduct,
} from '@/lib/ventas-helpers';
import {
  typePriority,
  criticalSupplyTypePriority,
  salesProductTypeLabels,
  publicProductTypeGroupClasses,
} from '@/lib/product-style';
import { SalesProductCard } from '@/components/ventas/sales-product-card';
import { SalesCart } from '@/components/ventas/sales-cart';
import {
  PRODUCTOS_API,
  VENTAS_API,
  VENTAS_DISPONIBILIDAD_API,
} from '@/config/api';
import { getVentasCatalogRefreshIntervalMs } from '@/config/ventas';
import { formatMoney } from '@/lib/money';
import { usePaymentParts } from '@/hooks/usePaymentParts';
import {
  useSubmitIdempotencyKey,
  saleSignature,
} from '@/hooks/use-submit-idempotency-key';
import type { PaginatedResult } from '@/domain/types';

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
    initialNotes: string | null;
    dialogKey: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Espejo de `isSubmitting` para que el polling lea el valor vigente sin
  // re-crear el intervalo en cada cambio de estado.
  const isSubmittingRef = useRef(false);
  // La clave persiste durante reintentos y rota cuando cambia el payload de venta.
  const saleKey = useSubmitIdempotencyKey();
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
    updateLineNotes,
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

  // Grupos por tipo como en el catálogo público: respeta el orden vendible
  // (compound → insumos críticos por subtipo → servicios → resto) y ordena
  // por nombre dentro de cada grupo. Se calcula sobre `displayProducts`
  // para que "Mostrar agotados" solo agregue ítems a su grupo.
  const groupedDisplayProducts = useMemo(
    () =>
      groupProductsByType(
        displayProducts,
        typePriority,
        criticalSupplyTypePriority
      ),
    [displayProducts]
  );

  // `silent` se usa para los refrescos de fondo (reanudar visibilidad): no
  // enciende `isCheckingAvailability` ni muestra errores — el cambio de
  // `products` dispara el precheck reactivo, que sí informa su estado.
  async function fetchProducts(options?: { silent?: boolean }) {
    const silent = options?.silent ?? false;
    try {
      // El endpoint está paginado: el terminal necesita el catálogo completo
      // para precalcular disponibilidad, así que recorre todas las páginas.
      const allProducts = await fetchAllPages<SellableProduct>(
        async (page, limit) => {
          const response = await authenticatedFetch(
            `${PRODUCTOS_API}?includeAvailability=true&page=${page}&limit=${limit}`,
            {}
          );
          if (!response.ok) {
            await throwApiError(response, 'Error al cargar productos');
          }
          return (await response.json()) as PaginatedResult<SellableProduct>;
        }
      );
      const sellable = sortSellableProducts(
        allProducts.filter(isPublicSellableProduct)
      );

      if (!isMountedRef.current) return;
      setProducts(sellable);
      if (!silent) setIsCheckingAvailability(sellable.length > 0);
    } catch (error) {
      if (!isMountedRef.current) return;
      if (!silent) {
        setError(error instanceof Error ? error.message : 'Error desconocido');
      }
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

  // Precheck de disponibilidad contra `POST /api/ventas/disponibilidad` con el
  // carrito actual y el catálogo completo. `silent: true` lo usa el polling
  // periódico: actualiza `cartAvailability`/`cartShortage` sin encender el
  // indicador de verificación ni bloquear "Confirmar venta". El request más
  // reciente gana: todos comparten `availabilityRequestIdRef` y solo el
  // vigente aplica resultados y apaga el indicador.
  const runAvailabilityCheck = useCallback(
    async (options?: { silent?: boolean }) => {
      if (products.length === 0) return;

      const silent = options?.silent ?? false;
      const requestId = ++availabilityRequestIdRef.current;
      if (!silent) setIsCheckingAvailability(true);

      const requestItems = groupCartItemsForSubmit(
        lines.map((line) => ({
          productId: line.product.id,
          quantity: line.quantity,
          selectedRecipeItemIds: line.selectedRecipeItemIds,
          notes: line.notes,
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
    },
    [lines, products]
  );

  useEffect(() => {
    if (products.length === 0) return;

    // Invalidar de inmediato cualquier verificación en vuelo (incluidos los
    // ticks del polling) apenas cambian el carrito o el catálogo.
    availabilityRequestIdRef.current += 1;

    const timer = setTimeout(() => {
      void runAvailabilityCheck();
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [lines, products, runAvailabilityCheck]);

  // Refresco en vivo del catálogo del POS: el tick es el POST de
  // disponibilidad (liviano, incluye reservas y ventas ajenas); al reanudar
  // la pestaña se re-descarga el catálogo completo para ver altas/bajas o
  // ediciones hechas mientras dormía. `immediate: false` porque el montaje ya
  // dispara `fetchProducts` + el primer precheck por el cambio de `products`.
  const catalogRefreshIntervalMs = getVentasCatalogRefreshIntervalMs();
  useVisibilityPolling(
    () => {
      // La confirmación en curso ya refresca al terminar vía `confirmSale`.
      if (isSubmittingRef.current) return;
      void runAvailabilityCheck({ silent: true });
    },
    catalogRefreshIntervalMs,
    catalogRefreshIntervalMs > 0 && products.length > 0,
    false,
    () => void fetchProducts({ silent: true })
  );

  function addToCart(
    product: SellableProduct,
    payload?: PromoOptionsConfirmPayload
  ) {
    if (!cashRegister || cashRegister.status !== 'open') return;
    setError(null);

    setIsCheckingAvailability(true);
    // El diálogo puede pedir N unidades: una línea por unidad con la misma
    // aclaración y `useSellableCart` impone la disponibilidad en cada agregado.
    // El quick-add (sin payload) agrega una unidad con la selección por
    // defecto de la receta.
    const units = Math.max(1, Math.floor(payload?.quantity ?? 1));
    for (let i = 0; i < units; i += 1) {
      addLine(product, payload?.selectedRecipeItemIds, payload?.notes);
    }
  }

  // La personalización vive acá (no en la card) para compartir
  // `cartAvailability` en `maxQuantity` y confirmar por `addToCart`.
  function openCustomize(product: SellableProduct) {
    if (!cashRegister || cashRegister.status !== 'open') return;
    setPromoDialogKey((prev) => prev + 1);
    setPromoDialogProduct(product);
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
      initialNotes: item.notes ?? null,
      dialogKey: nanoid(),
    });
    setPromoDialogProduct(null);
  }, [lines, products]);

  const cancelEditLine = useCallback(() => {
    setEditingLine(null);
  }, []);

  const confirmEditLine = useCallback(
    ({ selectedRecipeItemIds, notes }: PromoOptionsConfirmPayload) => {
      if (!editingLine) return;

      setIsCheckingAvailability(true);
      updateLineSelection(editingLine.lineId, selectedRecipeItemIds);
      updateLineNotes(editingLine.lineId, notes);
      setEditingLine(null);
    },
    [editingLine, updateLineSelection, updateLineNotes]
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

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setError(null);

    try {
      const submitItems = groupCartItemsForSubmit(
        lines.map((line) => ({
          productId: line.product.id,
          quantity: line.quantity,
          selectedRecipeItemIds: line.selectedRecipeItemIds,
          notes: line.notes,
        }))
      );
      const submitPayments = paymentParts.filter((part) => part.amount > 0);
      const response = await authenticatedFetch(VENTAS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: submitItems,
          payments: submitPayments,
          idempotencyKey: saleKey.resolve(
            saleSignature(submitItems, submitPayments)
          ),
        }),
      });

      if (!response.ok) {
        await throwApiError(response, 'Error al confirmar la venta');
      }

      saleKey.reset();
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
      isSubmittingRef.current = false;
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
          dataTheme="light"
        />
      </div>

      <div className="grid gap-5 md:grid-cols-5 lg:grid-cols-3">
        <div className="space-y-4 md:col-span-3 lg:col-span-2">
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

          <div data-tour="sales-products" className="space-y-6">
            {displayProducts.length === 0 && (
              <p
                data-testid="sales-catalog-empty"
                className="rounded-lg border border-border p-4 text-sm text-muted-foreground"
              >
                {products.length === 0
                  ? 'No hay productos vendibles en el catálogo.'
                  : 'Todos los productos están agotados. Activá "Mostrar agotados" para ver el catálogo.'}
              </p>
            )}
            {groupedDisplayProducts.map((group) => (
              <section key={group.type} className="space-y-3">
                <h3
                  className={`inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium ${publicProductTypeGroupClasses[group.type]}`}
                >
                  {salesProductTypeLabels[group.type]}
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {group.items.map((product) => {
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
                        onCustomize={openCustomize}
                      />
                    );
                  })}
                </div>
              </section>
            ))}
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
          imageUrl={promoDialogProduct.imageUrl}
          description={promoDialogProduct.description}
          recipe={promoDialogProduct.recipe ?? []}
          maxOptionalSelections={promoDialogProduct.maxOptionalSelections}
          maxQuantity={getProductAdditional(
            promoDialogProduct,
            cartAvailability,
            lines.reduce(
              (sum, line) =>
                line.product.id === promoDialogProduct.id
                  ? sum + line.quantity
                  : sum,
              0
            )
          )}
          onConfirm={(payload) => {
            addToCart(promoDialogProduct, payload);
            setPromoDialogProduct(null);
          }}
          confirmLabel="Agregar a la venta"
          variant="public"
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
          imageUrl={editingLine.product.imageUrl}
          description={editingLine.product.description}
          recipe={editingLine.product.recipe ?? []}
          maxOptionalSelections={editingLine.product.maxOptionalSelections}
          initialSelectedIds={editingLine.initialSelectedIds}
          initialNotes={editingLine.initialNotes}
          onConfirm={confirmEditLine}
          mode="edit"
          confirmLabel="Guardar cambios"
          variant="public"
        />
      )}
    </div>
  );
}
