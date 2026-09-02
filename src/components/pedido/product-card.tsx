'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ImageOff } from 'lucide-react';
import {
  productTypeLabels,
  criticalTypeLabels,
  productTypeBadgeClasses,
} from '@/lib/product-style';
import { PromoOptionsDialog } from '@/components/promo/promo-options-dialog';
import { formatMoney } from '@/lib/money';
import { formatRecipeItemName } from '@/lib/recipe-helpers';
import type { PublicCatalogProduct } from '@/application/services/catalogService';
import type { RecipeBreakdownItem } from '@/application/services/saleService';

interface ProductCardProps {
  product: PublicCatalogProduct;
  inCart: boolean;
  breakdown: RecipeBreakdownItem[];
  onAdd: (selectedRecipeItemIds?: number[]) => void;
  disabled?: boolean;
  showBreakdown?: boolean;
}

export function ProductCard({
  product,
  inCart,
  breakdown,
  onAdd,
  disabled = false,
  showBreakdown = true,
}: ProductCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
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
      : inCart
        ? 'Agregar otro'
        : 'Agregar';

  const availabilityLabel =
    product.type === 'service'
      ? 'Disponible: sin límite'
      : `Disponible: ${product.availability} unidades`;

  const includedItems = recipe
    .filter((item) => !item.isOptional || item.selectedByDefault)
    .map((item) =>
      item.isOptional ? item.supplyName : formatRecipeItemName(item)
    );

  const handleAdd = () => {
    if (hasOptions) {
      setDialogOpen(true);
      return;
    }
    onAdd();
  };

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
          {product.imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={product.imageUrl}
              alt={`Imagen de ${product.name}`}
              className="h-full w-full object-cover"
              loading="lazy"
              onError={(event) => {
                (event.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <ImageOff className="h-10 w-10" />
            </div>
          )}
        </div>

        {product.description && (
          <p className="text-sm text-muted-foreground">{product.description}</p>
        )}

        <p className="font-mono text-2xl font-bold text-primary">
          {formatMoney(product.price)}
        </p>

        <p className="text-sm text-muted-foreground">{availabilityLabel}</p>

        {product.type === 'compound' && includedItems.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Incluye: {includedItems.join(', ')}
            {optionalItems.length > 0 && ' (se puede quitar)'}
          </p>
        )}

        {showBreakdown && product.type === 'compound' && breakdown.length > 0 && (
          <details className="text-sm text-muted-foreground">
            <summary className="cursor-pointer text-foreground hover:text-primary">
              Ver insumos
            </summary>
            <ul className="mt-2 space-y-1 pl-4">
              {breakdown.map((item, index) => (
                <li
                  key={index}
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
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          productName={product.name}
          productPrice={product.price}
          recipe={recipe}
          onConfirm={onAdd}
        />
      )}
    </Card>
  );
}
