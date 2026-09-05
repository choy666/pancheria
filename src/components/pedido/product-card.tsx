'use client';

import { useCallback, useState } from 'react';
import Image from 'next/image';
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
  inCartQuantity?: number;
  breakdown: RecipeBreakdownItem[];
  onAdd: (selectedRecipeItemIds?: number[]) => void;
  disabled?: boolean;
  showBreakdown?: boolean;
}

interface ProductImageProps {
  imageUrl: string;
  productName: string;
}

function ProductImage({ imageUrl, productName }: ProductImageProps) {
  // Se guarda la URL que falló (en lugar de un booleano) para que el estado de
  // error se reinicie solo cuando cambia la imagen, sin forzar un remount.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (failedUrl === imageUrl) {
    return (
      <div
        className="flex h-full w-full items-center justify-center text-muted-foreground"
        role="img"
        aria-label={`Imagen no disponible para ${productName}`}
      >
        <ImageOff className="h-10 w-10" />
      </div>
    );
  }

  return (
    <Image
      src={imageUrl}
      alt={`Imagen de ${productName}`}
      fill
      className="object-cover"
      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
      loading="lazy"
      priority={false}
      onError={() => setFailedUrl(imageUrl)}
    />
  );
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

  const availabilityLabel =
    product.type === 'service'
      ? 'Disponible: sin límite'
      : `Disponible: ${product.availability} unidades`;

  const includedItems = recipe
    .filter((item) => !item.isOptional || item.selectedByDefault)
    .map((item) =>
      item.isOptional ? item.supplyName : formatRecipeItemName(item)
    );

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
          {product.imageUrl ? (
            <ProductImage
              imageUrl={product.imageUrl}
              productName={product.name}
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-muted-foreground"
              role="img"
              aria-label={`Imagen no disponible para ${product.name}`}
            >
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

        <p
          data-testid="product-availability"
          className="text-sm text-muted-foreground"
        >
          {availabilityLabel}
        </p>

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
