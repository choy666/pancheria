'use client';

import { useCallback, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  productTypeLabels,
  criticalTypeLabels,
  productTypeBadgeClasses,
} from '@/lib/product-style';
import { PromoOptionsDialog } from '@/components/promo/promo-options-dialog';
import { ProductCardImage } from '@/components/productos/product-card-image';
import { ProductCardPrice } from '@/components/productos/product-card-price';
import { ProductCardAvailability } from '@/components/productos/product-card-availability';
import { ProductCardRecipeIncluded } from '@/components/productos/product-card-recipe-included';
import type { PublicCatalogProduct } from '@/application/services/catalogService';
import type { RecipeBreakdownItem } from '@/application/services/saleService';

interface ProductCardProps {
  product: PublicCatalogProduct;
  inCart: boolean;
  inCartQuantity?: number;
  breakdown: RecipeBreakdownItem[];
  onAdd: (selectedRecipeItemIds?: number[]) => void;
  disabled?: boolean;
  showBreakdown?: boolean;
}

export function ProductCard({
  product,
  inCart,
  inCartQuantity = 0,
  breakdown,
  onAdd,
  disabled = false,
  showBreakdown = true,
}: ProductCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const isOutOfStock = product.type !== 'service' && product.availability <= 0;
  const typeLabel = product.criticalSupplyType
    ? `${productTypeLabels[product.type]} — ${criticalTypeLabels[product.criticalSupplyType]}`
    : productTypeLabels[product.type];

  const recipe = product.recipe ?? [];
  const optionalItems = recipe.filter((item) => item.isOptional);
  const hasOptions = product.type === 'compound' && optionalItems.length > 0;

  const buttonLabel = isOutOfStock
    ? 'Agotado'
    : hasOptions
      ? 'Personalizar'
      : inCartQuantity > 0 || inCart
        ? 'Agregar otro'
        : 'Agregar';

  const defaultSelectedIds = recipe
    .filter((item) => item.isOptional && item.selectedByDefault)
    .map((item) => item.supplyId);

  const handleAdd = useCallback(() => {
    if (hasOptions) {
      setDialogKey((prev) => prev + 1);
      setDialogOpen(true);
      return;
    }
    onAdd();
  }, [hasOptions, onAdd]);

  return (
    <Card
      data-testid={`product-card-${product.id}`}
      className={`transition-all ${
        isOutOfStock || disabled
          ? 'opacity-60'
          : 'cursor-pointer touch-manipulation hover:border-primary/30 hover:bg-muted/40 active:scale-[0.98]'
      }`}
    >
      <CardHeader className="p-5">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-lg font-semibold leading-tight">
            {product.name}
          </CardTitle>
          <Badge
            className={productTypeBadgeClasses[product.type]}
            variant="outline"
          >
            {typeLabel}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-5 pt-0">
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-muted">
          <ProductCardImage
            imageUrl={product.imageUrl}
            productName={product.name}
          />
        </div>

        {product.description && (
          <p className="text-sm text-muted-foreground">{product.description}</p>
        )}

        <ProductCardPrice price={product.price} />

        <ProductCardAvailability
          type={product.type}
          availability={product.availability}
        />

        {product.type === 'compound' && recipe.length > 0 && (
          <ProductCardRecipeIncluded
            recipe={recipe}
            showOptionalHint={optionalItems.length > 0}
          />
        )}

        {showBreakdown && product.type === 'compound' && breakdown.length > 0 && (
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

        <Button
          type="button"
          data-testid={`add-product-${product.id}`}
          className="w-full"
          disabled={isOutOfStock || disabled}
          onClick={handleAdd}
        >
          {buttonLabel}
        </Button>
      </CardContent>

      {hasOptions && (
        <PromoOptionsDialog
          key={dialogKey}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          productName={product.name}
          productPrice={product.price}
          recipe={recipe}
          initialSelectedIds={defaultSelectedIds}
          onConfirm={onAdd}
        />
      )}
    </Card>
  );
}
