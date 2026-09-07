'use client';

import { useCallback, useState, type KeyboardEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PromoOptionsDialog } from '@/components/promo/promo-options-dialog';
import { ProductCardImage } from '@/components/productos/product-card-image';
import { ProductCardPrice } from '@/components/productos/product-card-price';
import { ProductCardAvailability } from '@/components/productos/product-card-availability';
import { ProductCardRecipeIncluded } from '@/components/productos/product-card-recipe-included';
import { ProductCardSalesExtra } from '@/components/productos/product-card-sales-extra';
import {
  productTypeLabels,
  criticalTypeLabels,
  productTypeBadgeClasses,
} from '@/lib/product-style';
import type { CriticalSupplyType, ProductType, RecipeItemConfig } from '@/domain/types';
import type { RecipeBreakdownItem } from '@/application/services/saleService';

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
  breakdown?: RecipeBreakdownItem[];
  showBreakdown?: boolean;
  maxAdditional?: number;
  onAdd: (selectedRecipeItemIds?: number[]) => void;
}

/**
 * Componente base unificado de la tarjeta de producto.
 *
 * - `variant="catalog"`: catálogo público de `/pedido`. Muestra imagen,
 *   descripción, badge de tipo, desglose opcional de insumos y un botón de
 *   acción que abre el diálogo de personalización cuando la promo tiene
 *   ítems opcionales.
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
  breakdown = [],
  showBreakdown = false,
  maxAdditional,
  onAdd,
}: ProductCardBaseProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);

  const isCatalog = variant === 'catalog';
  const isDisabled = isOutOfStock || disabled;

  const recipe = product.recipe ?? [];
  const optionalItems = recipe.filter((item) => item.isOptional);
  const hasOptions = product.type === 'compound' && optionalItems.length > 0;

  const typeLabel = product.criticalSupplyType
    ? `${productTypeLabels[product.type]} — ${criticalTypeLabels[product.criticalSupplyType]}`
    : productTypeLabels[product.type];

  const buttonLabel = isOutOfStock
    ? 'Agotado'
    : hasOptions
      ? inCartQuantity > 0 || inCart
        ? 'Personalizar otra'
        : 'Personalizar'
      : inCartQuantity > 0 || inCart
        ? 'Agregar otro'
        : 'Agregar';

  const defaultSelectedIds = recipe
    .filter((item) => item.isOptional && item.selectedByDefault)
    .map((item) => item.supplyId);

  const handleCatalogAdd = useCallback(() => {
    if (hasOptions) {
      setDialogKey((prev) => prev + 1);
      setDialogOpen(true);
      return;
    }
    onAdd();
  }, [hasOptions, onAdd]);

  const handleCardActivate = useCallback(() => {
    if (isDisabled) return;
    onAdd();
  }, [isDisabled, onAdd]);

  const handleCardKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      handleCardActivate();
    },
    [handleCardActivate]
  );

  const interactiveClass = isDisabled
    ? isCatalog
      ? 'opacity-60'
      : 'opacity-50'
    : 'cursor-pointer touch-manipulation hover:border-primary/30 hover:bg-muted/40 active:scale-[0.98]' +
      (isCatalog
        ? ''
        : ' focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary');

  return (
    <Card
      data-testid={isCatalog ? `product-card-${product.id}` : 'product-card'}
      data-product-name={isCatalog ? undefined : product.name}
      data-out-of-stock={isCatalog ? undefined : isOutOfStock}
      role={isCatalog ? undefined : 'button'}
      tabIndex={isCatalog ? undefined : isDisabled ? -1 : 0}
      aria-disabled={isCatalog ? undefined : isDisabled}
      aria-label={isCatalog ? undefined : `Agregar ${product.name} a la venta`}
      onClick={isCatalog ? undefined : handleCardActivate}
      onKeyDown={isCatalog ? undefined : handleCardKeyDown}
      className={`transition-all ${interactiveClass}`}
    >
      <CardHeader className="p-5">
        <div
          className={`flex items-start justify-between ${isCatalog ? 'gap-3' : 'gap-2'}`}
        >
          <CardTitle className="text-lg font-semibold leading-tight">
            {product.name}
          </CardTitle>
          <div className="flex shrink-0 flex-wrap items-start justify-end gap-1.5">
            {isCatalog && (
              <Badge
                className={productTypeBadgeClasses[product.type]}
                variant="outline"
              >
                {typeLabel}
              </Badge>
            )}
            {inCartQuantity > 0 && (
              <Badge
                variant="default"
                className="shrink-0"
                data-testid={`product-card-cart-quantity-${product.id}`}
              >
                {inCartQuantity} {isCatalog ? 'en tu pedido' : 'en venta'}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className={isCatalog ? 'space-y-4 p-5 pt-0' : 'p-5 pt-0'}>
        {isCatalog && (
          <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-muted">
            <ProductCardImage
              imageUrl={product.imageUrl}
              productName={product.name}
            />
          </div>
        )}

        {isCatalog && product.description && (
          <p className="text-sm text-muted-foreground">{product.description}</p>
        )}

        <ProductCardPrice price={product.price} />

        <ProductCardAvailability
          type={product.type}
          availability={product.availability}
          unit={isCatalog ? undefined : product.unit}
        />

        {product.type === 'compound' && recipe.length > 0 && (
          <ProductCardRecipeIncluded
            recipe={recipe}
            showOptionalHint={isCatalog && optionalItems.length > 0}
          />
        )}

        {isCatalog &&
          showBreakdown &&
          product.type === 'compound' &&
          breakdown.length > 0 && (
            <details className="text-sm text-muted-foreground">
              <summary className="cursor-pointer text-foreground hover:text-primary">
                Ver insumos
              </summary>
              <ul className="mt-2 space-y-1 pl-4">
                {breakdown.map((item) => (
                  <li
                    key={item.supplyName}
                    className={item.isLimiting ? 'font-medium text-foreground' : ''}
                  >
                    {item.supplyName}: {item.available} disp., {item.required} req.
                    {item.isLimiting && ' (limitante)'}
                  </li>
                ))}
              </ul>
            </details>
          )}

        {!isCatalog && product.type !== 'service' && maxAdditional !== undefined && (
          <ProductCardSalesExtra
            isOutOfStock={isOutOfStock}
            maxAdditional={maxAdditional}
          />
        )}

        {isCatalog && (
          <Button
            type="button"
            data-testid={`add-product-${product.id}`}
            className="w-full"
            disabled={isDisabled}
            onClick={handleCatalogAdd}
          >
            {buttonLabel}
          </Button>
        )}
      </CardContent>

      {isCatalog && hasOptions && (
        <PromoOptionsDialog
          key={dialogKey}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          productName={product.name}
          productPrice={product.price}
          recipe={recipe}
          initialSelectedIds={defaultSelectedIds}
          onConfirm={({ selectedRecipeItemIds }) =>
            onAdd(selectedRecipeItemIds)
          }
        />
      )}
    </Card>
  );
}
