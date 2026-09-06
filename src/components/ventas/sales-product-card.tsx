'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getProductAdditional,
  isProductOutOfStock,
  type SellableProduct,
} from '@/lib/ventas-helpers';
import { ProductCardPrice } from '@/components/productos/product-card-price';
import { ProductCardAvailability } from '@/components/productos/product-card-availability';
import { ProductCardRecipeIncluded } from '@/components/productos/product-card-recipe-included';
import { ProductCardSalesExtra } from '@/components/productos/product-card-sales-extra';

interface SalesProductCardProps {
  product: SellableProduct;
  cartAvailability: Record<number, number>;
  inCartQuantity: number;
  cartDisabled: boolean;
  onAdd: (product: SellableProduct) => void;
}

export function SalesProductCard({
  product,
  cartAvailability,
  inCartQuantity,
  cartDisabled,
  onAdd,
}: SalesProductCardProps) {
  const additional = getProductAdditional(
    product,
    cartAvailability,
    inCartQuantity
  );
  const isOutOfStock = isProductOutOfStock(
    product,
    cartAvailability,
    inCartQuantity
  );

  const maxAdditional =
    product.type === 'service' ? Number.MAX_SAFE_INTEGER : additional;

  return (
    <Card
      data-testid="product-card"
      data-product-name={product.name}
      data-out-of-stock={isOutOfStock}
      className={`transition-all ${
        isOutOfStock || cartDisabled
          ? 'opacity-50'
          : 'cursor-pointer touch-manipulation hover:border-primary/30 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.98]'
      }`}
      onClick={() => {
        if (isOutOfStock || cartDisabled) return;
        onAdd(product);
      }}
      role="button"
      tabIndex={isOutOfStock || cartDisabled ? -1 : 0}
      aria-disabled={isOutOfStock || cartDisabled}
      aria-label={`Agregar ${product.name} al pedido`}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          if (isOutOfStock || cartDisabled) return;
          onAdd(product);
        }
      }}
    >
      <CardHeader className="p-5">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg font-semibold leading-tight">
            {product.name}
          </CardTitle>
          {inCartQuantity > 0 && (
            <Badge
              variant="default"
              className="shrink-0"
              data-testid={`product-card-cart-quantity-${product.id}`}
            >
              {inCartQuantity} en pedido
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        <ProductCardPrice price={product.price} />
        <ProductCardAvailability
          type={product.type}
          availability={product.availability}
          unit={product.unit}
        />
        {product.type === 'compound' &&
          product.recipe &&
          product.recipe.length > 0 && (
            <ProductCardRecipeIncluded recipe={product.recipe} />
          )}
        {product.type !== 'service' && (
          <ProductCardSalesExtra
            isOutOfStock={isOutOfStock}
            maxAdditional={maxAdditional}
          />
        )}
      </CardContent>
    </Card>
  );
}
