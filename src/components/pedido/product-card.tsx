import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  productTypeLabels,
  criticalTypeLabels,
  productTypeBadgeClasses,
} from '@/lib/product-style';
import type { PublicCatalogProduct } from '@/application/services/catalogService';
import type { RecipeBreakdownItem } from '@/application/services/saleService';

interface ProductCardProps {
  product: PublicCatalogProduct;
  inCart: boolean;
  breakdown: RecipeBreakdownItem[];
  onAdd: () => void;
  disabled?: boolean;
}

export function ProductCard({
  product,
  inCart,
  breakdown,
  onAdd,
  disabled = false,
}: ProductCardProps) {
  const isOutOfStock = product.type !== 'service' && product.availability <= 0;
  const typeLabel = product.criticalSupplyType
    ? `${productTypeLabels[product.type]} — ${criticalTypeLabels[product.criticalSupplyType]}`
    : productTypeLabels[product.type];

  const buttonLabel = isOutOfStock
    ? 'Agotado'
    : inCart
      ? 'Agregar otro'
      : 'Agregar';

  const availabilityLabel =
    product.type === 'service'
      ? 'Disponible: sin límite'
      : `Disponible: ${product.availability} unidades`;

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
        {product.description && (
          <p className="text-sm text-muted-foreground">{product.description}</p>
        )}

        <p className="font-mono text-2xl font-bold text-primary">
          ${product.price.toFixed(2)}
        </p>

        <p className="text-sm text-muted-foreground">{availabilityLabel}</p>

        {product.type === 'compound' && breakdown.length > 0 && (
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
          onClick={onAdd}
        >
          {buttonLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
