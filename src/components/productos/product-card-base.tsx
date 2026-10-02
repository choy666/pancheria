'use client';

import { useCallback, useState, type KeyboardEvent } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  PromoOptionsDialog,
  type PromoOptionsConfirmPayload,
} from '@/components/promo/promo-options-dialog';
import { hasOptionalRecipeItems } from '@/lib/cart-helpers';
import { formatMoney } from '@/lib/money';
import { ProductCardImage } from '@/components/productos/product-card-image';
import { ProductCardPrice } from '@/components/productos/product-card-price';
import { ProductCardAvailability } from '@/components/productos/product-card-availability';
import { ProductCardRecipeIncluded } from '@/components/productos/product-card-recipe-included';
import { ProductCardSalesExtra } from '@/components/productos/product-card-sales-extra';
import { productTypeLabels, criticalTypeLabels } from '@/lib/product-style';
import type { CriticalSupplyType, ProductType, RecipeItemConfig } from '@/domain/types';

/**
 * Campos mínimos que necesita la tarjeta de producto en ambos contextos.
 * `PublicCatalogProduct` (catálogo) y `SellableProduct` (terminal de ventas)
 * son asignables a esta interfaz.
 */
export interface ProductCardProduct {
  id: number;
  name: string;
  description?: string | null;
  type: ProductType;
  criticalSupplyType?: CriticalSupplyType | null;
  price: number;
  unit?: string;
  imageUrl?: string | null;
  availability: number;
  recipe?: RecipeItemConfig[];
}

type ProductCardVariant = 'catalog' | 'sales';

interface ProductCardBaseProps {
  variant: ProductCardVariant;
  product: ProductCardProduct;
  isOutOfStock: boolean;
  inCart?: boolean;
  inCartQuantity?: number;
  disabled?: boolean;
  maxAdditional?: number;
  /**
   * `priority` para `next/image` en la primera fila del catálogo (LCP). Lo
   * pasa el grid; la card no conoce su posición.
   */
  imagePriority?: boolean;
  /**
   * El payload llega solo desde el diálogo de personalización (selección de
   * receta, cantidad del stepper y aclaración). El quick-add no lo pasa y el
   * carrito agrega una sola unidad con la selección por defecto.
   */
  onAdd: (payload?: PromoOptionsConfirmPayload) => void;
}

/**
 * Componente base unificado de la tarjeta de producto.
 *
 * - `variant="catalog"`: catálogo público de `/pedido` (tema claro, estilo
 *   food-delivery). Hero con imagen o fallback de marca, pill "Promo",
 *   badge "N en tu pedido" reubicado sobre el hero, precio en rojo de marca
 *   y CTA "Agregar" (quick-add con la selección por defecto). En productos
 *   con opcionales, el botón circular `customize-product-${id}` abre el
 *   diálogo de personalización.
 * - `variant="sales"`: terminal de `/ventas`. Toda la tarjeta actúa como
 *   botón, muestra el badge de cantidad en el pedido y el stock restante
 *   calculado por el padre (`isOutOfStock`/`maxAdditional`).
 *
 * Los `data-testid` se mantienen por variante para no romper los selectores
 * E2E existentes (`product-card-${id}`/`add-product-${id}` en catálogo y
 * `product-card`/`data-product-name` en ventas).
 */
export function ProductCardBase({
  variant,
  product,
  isOutOfStock,
  inCart = false,
  inCartQuantity = 0,
  disabled = false,
  maxAdditional,
  imagePriority = false,
  onAdd,
}: ProductCardBaseProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);

  const isCatalog = variant === 'catalog';
  const isDisabled = isOutOfStock || disabled;

  const recipe = product.recipe ?? [];
  const hasOptions =
    product.type === 'compound' && hasOptionalRecipeItems(product);

  const buttonLabel = isOutOfStock
    ? 'Agotado'
    : inCartQuantity > 0 || inCart
      ? 'Agregar otro'
      : 'Agregar';

  const defaultSelectedIds = recipe
    .filter((item) => item.isOptional && item.selectedByDefault)
    .map((item) => item.supplyId);

  const openOptionsDialog = useCallback(() => {
    setDialogKey((prev) => prev + 1);
    setDialogOpen(true);
  }, []);

  // Catálogo: la card es presentacional (sin rol interactivo) para no anidar
  // botones dentro de un `role="button"`. "Agregar" siempre hace quick-add
  // (los opcionales van con su `selectedByDefault`) y el botón circular
  // `customize-product-${id}` abre el diálogo de personalización.
  const handleCardActivate = useCallback(() => {
    if (isDisabled) return;
    onAdd();
  }, [isDisabled, onAdd]);

  const handleCardKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) return;
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      handleCardActivate();
    },
    [handleCardActivate]
  );

  if (isCatalog) {
    return (
      <Card
        data-testid={`product-card-${product.id}`}
        className={`group/card gap-0 rounded-3xl py-0 shadow-sm transition-shadow ${
          isDisabled ? 'opacity-60' : 'hover:shadow-lg'
        }`}
      >
        {/* Hero: imagen a todo ancho sobre el diagonal de marca; el fallback
            sin imagen lo pinta `ProductImageFallback` sobre este fondo. */}
        <div className="relative aspect-video w-full overflow-hidden rounded-t-3xl bg-linear-to-br from-brand-red to-brand-mustard">
          <ProductCardImage
            imageUrl={product.imageUrl}
            productName={product.name}
            priority={imagePriority}
          />
          {product.type === 'compound' && (
            <span className="absolute left-3 top-3 rounded-full bg-brand-mustard px-3 py-1 font-heading text-xs uppercase tracking-wide text-brand-ink shadow-sm">
              Promo
            </span>
          )}
          {inCartQuantity > 0 && (
            <Badge
              key={inCartQuantity}
              data-testid={`product-card-cart-quantity-${product.id}`}
              className="absolute right-3 top-3 animate-in zoom-in-50 bg-white/95 text-brand-ink duration-200"
            >
              {inCartQuantity} en tu pedido
            </Badge>
          )}
        </div>

        <CardContent className="flex flex-1 flex-col gap-2 p-4">
          <p className="font-heading text-xl leading-tight">{product.name}</p>
          {product.description && (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {product.description}
            </p>
          )}
          {/* La disponibilidad cualitativa queda fuera del diseño visual pero
              sigue disponible para lectores de pantalla y selectores E2E. */}
          <div className="sr-only">
            <ProductCardAvailability
              type={product.type}
              availability={product.availability}
              qualitative
            />
          </div>
          <div className="mt-auto flex items-center justify-between gap-2 pt-2">
            <p className="font-heading text-2xl text-brand-red">
              {formatMoney(product.price)}
            </p>
            <div className="flex items-center gap-2">
              {hasOptions && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  data-testid={`customize-product-${product.id}`}
                  aria-label={`Personalizar ${product.name}`}
                  disabled={isDisabled}
                  onClick={openOptionsDialog}
                  className="rounded-full border border-border text-foreground hover:bg-muted"
                >
                  <SlidersHorizontal />
                </Button>
              )}
              <Button
                type="button"
                data-testid={`add-product-${product.id}`}
                disabled={isDisabled}
                onClick={() => onAdd()}
                className="rounded-full bg-brand-red px-5 font-semibold text-white hover:bg-brand-red/90"
              >
                {buttonLabel}
              </Button>
            </div>
          </div>
        </CardContent>

        {hasOptions && (
          <PromoOptionsDialog
            key={dialogKey}
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            productName={product.name}
            productPrice={product.price}
            imageUrl={product.imageUrl}
            description={product.description}
            recipe={recipe}
            initialSelectedIds={defaultSelectedIds}
            maxQuantity={Math.max(
              1,
              product.availability - inCartQuantity
            )}
            onConfirm={(payload) => onAdd(payload)}
            variant="public"
          />
        )}
      </Card>
    );
  }

  const typeLabel = product.criticalSupplyType
    ? `${productTypeLabels[product.type]} — ${criticalTypeLabels[product.criticalSupplyType]}`
    : productTypeLabels[product.type];

  const optionalItems = recipe.filter((item) => item.isOptional);

  return (
    <Card
      data-testid="product-card"
      data-product-name={product.name}
      data-out-of-stock={isOutOfStock}
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      aria-disabled={isDisabled}
      aria-label={`Agregar ${product.name} a la venta`}
      onClick={handleCardActivate}
      onKeyDown={handleCardKeyDown}
      className={`transition-all ${
        isDisabled
          ? 'opacity-50'
          : 'cursor-pointer touch-manipulation hover:border-primary/30 hover:bg-muted/40 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
      }`}
    >
      <CardHeader className="p-5">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg font-semibold leading-tight">
            {product.name}
          </CardTitle>
          <div className="flex shrink-0 flex-wrap items-start justify-end gap-1.5">
            {typeLabel && (
              <Badge variant="secondary" className="shrink-0">
                {typeLabel}
              </Badge>
            )}
            {optionalItems.length > 0 && (
              <Badge variant="outline" className="shrink-0">
                +{optionalItems.length} opcionales
              </Badge>
            )}
            {inCartQuantity > 0 && (
              <Badge
                key={inCartQuantity}
                variant="default"
                className="shrink-0"
                data-testid={`product-card-cart-quantity-${product.id}`}
              >
                {inCartQuantity} en venta
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 pt-0">
        <ProductCardPrice price={product.price} />

        <ProductCardAvailability
          type={product.type}
          availability={product.availability}
          unit={product.unit}
        />

        {product.type === 'compound' && recipe.length > 0 && (
          <ProductCardRecipeIncluded
            recipe={recipe}
            showOptionalHint={optionalItems.length > 0}
          />
        )}

        {product.type !== 'service' && maxAdditional !== undefined && (
          <ProductCardSalesExtra
            isOutOfStock={isOutOfStock}
            maxAdditional={maxAdditional}
          />
        )}
      </CardContent>
    </Card>
  );
}
