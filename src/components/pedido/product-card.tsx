import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  productTypeLabels,
  criticalTypeLabels,
  productTypeBadgeClasses,
} from '@/lib/product-style';
import type { PublicCatalogProduct } from '@/application/services/catalogService';

interface ProductCardProps {
  product: PublicCatalogProduct;
  inCart: boolean;
  onAdd: () => void;
  disabled?: boolean;
}

export function ProductCard({
  product,
  inCart,
  onAdd,
  disabled = false,
}: ProductCardProps) {
  const isOutOfStock = product.type !== 'service' && product.availability <= 0;
  const typeLabel = product.criticalSupplyType
    ? `${productTypeLabels[product.type]} — ${criticalTypeLabels[product.criticalSupplyType]}`
    : productTypeLabels[product.type];

  return (
    <Card
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

        <p className="text-sm text-muted-foreground">
          {product.type === 'service'
            ? 'Disponible: sin límite'
            : `Disponible: ${product.availability} ${product.unit}`}
        </p>

        <Button
          type="button"
          className="w-full"
          disabled={isOutOfStock || disabled}
          onClick={onAdd}
        >
          {isOutOfStock
            ? 'Agotado'
            : inCart
              ? 'Agregar otro'
              : 'Agregar'}
        </Button>
      </CardContent>
    </Card>
  );
}
