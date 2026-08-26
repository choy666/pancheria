import { Fragment } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ProductActions } from '@/components/productos/product-actions';
import { cn } from '@/lib/utils';
import { groupProductsByType } from '@/lib/product-grouping';
import {
  productTypeLabels,
  criticalTypeLabels,
  typePriority,
  criticalSupplyTypePriority,
  productTypeBadgeClasses,
  productTypeTextClasses,
  productTypeDotClasses,
  productTypeGroupClasses,
} from '@/lib/product-style';
import * as productService from '@/application/services/productService';
import * as saleService from '@/application/services/saleService';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getCurrentBranchIdOrRedirect } from '@/lib/auth';
import { routes } from '@/config/routes';

export default async function ProductsPage() {
  const session = await auth();

  if (session?.user?.role !== 'admin') {
    redirect(routes.home);
  }

  const branchId = await getCurrentBranchIdOrRedirect(session);

  const products = await productService.listProducts(branchId);
  const groupedProducts = groupProductsByType(
    products,
    typePriority,
    criticalSupplyTypePriority
  );
  const sellableById = await saleService.calculateAvailabilityForProductIds(
    branchId,
    products.map((product) => product.id)
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 data-tour="products-header" className="text-2xl font-semibold tracking-tight">Productos y promos</h1>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link data-tour="products-new-product" href={`${routes.productosNuevo}?tab=product`} className="w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto">
              Nuevo producto
            </Button>
          </Link>
          <Link data-tour="products-new-promo" href={`${routes.productosNuevo}?tab=promo`} className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto">Nueva promo</Button>
          </Link>
        </div>
      </div>

      <div data-tour="products-table" className="rounded-2xl border border-white/8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead className="hidden sm:table-cell">Tipo</TableHead>
              <TableHead className="hidden md:table-cell">Stock</TableHead>
              <TableHead className="hidden lg:table-cell">Precio</TableHead>
              <TableHead>Vendible</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupedProducts.map((group) => (
              <Fragment key={`group-${group.type}`}>
                <TableRow className="border-t border-white/8 hover:bg-transparent">
                  <TableHead
                    scope="rowgroup"
                    role="rowheader"
                    colSpan={6}
                    className={cn(
                      'h-10 px-3 text-left text-xs font-semibold uppercase tracking-wider',
                      productTypeGroupClasses[group.type]
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${productTypeDotClasses[group.type]}`}
                        aria-hidden="true"
                      />
                      <span>{productTypeLabels[group.type]}</span>
                    </div>
                  </TableHead>
                </TableRow>
                {group.items.map((product) => (
                  <TableRow
                    key={product.id}
                    data-testid="product-row"
                    data-product-name={product.name}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${productTypeDotClasses[product.type]}`}
                          aria-hidden="true"
                        />
                        <span className="block">{product.name}</span>
                      </div>
                      <span className={`text-sm sm:hidden ${productTypeTextClasses[product.type]}`}>
                        {productTypeLabels[product.type]}
                        {product.criticalSupplyType
                          ? ` · ${criticalTypeLabels[product.criticalSupplyType]}`
                          : ''}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge
                        data-testid="product-type-badge"
                        variant="outline"
                        className={productTypeBadgeClasses[product.type]}
                      >
                        {productTypeLabels[product.type]}
                        {product.criticalSupplyType
                          ? ` - ${criticalTypeLabels[product.criticalSupplyType]}`
                          : ''}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell font-mono">
                      {product.type === 'compound' ? (
                        <span
                          className="text-muted-foreground"
                          title="El stock de una promo se calcula a partir de sus insumos críticos"
                        >
                          {sellableById[product.id]?.availability ?? 0} {product.unit}
                        </span>
                      ) : (
                        <>
                          {product.stock} {product.unit}
                          {product.stock <= product.minStock && product.minStock > 0 && (
                            <Badge variant="destructive" className="ml-2">
                              Bajo
                            </Badge>
                          )}
                        </>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell font-mono">
                      {product.type === 'manual_supply'
                        ? '-'
                        : `$${product.price.toFixed(2)}`}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const isSellable =
                          product.isActive &&
                          (sellableById[product.id]?.availability ?? 0) > 0;
                        return isSellable ? (
                          <Badge
                            data-testid="sellable-badge"
                            data-sellable="true"
                            variant="outline"
                            className="h-8 w-8 justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 p-0 font-mono text-sm font-bold text-emerald-400"
                          >
                            V
                          </Badge>
                        ) : (
                          <Badge
                            data-testid="sellable-badge"
                            data-sellable="false"
                            variant="outline"
                            className="h-8 w-8 justify-center rounded-full border border-red-500/30 bg-red-500/10 p-0 font-mono text-sm font-bold text-red-400"
                          >
                            X
                          </Badge>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-right">
                      <ProductActions
                        productId={product.id}
                        productName={product.name}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
