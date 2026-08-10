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
import * as productService from '@/application/services/productService';
import * as saleService from '@/application/services/saleService';
import type { ProductType } from '@/domain/types';

const productTypeLabels: Record<string, string> = {
  critical_supply: 'Insumo crítico',
  compound: 'Promo',
  manual_supply: 'Insumo manual',
  service: 'Servicio / extra',
};

const criticalTypeLabels: Record<string, string> = {
  bread: 'Pan',
  sausage: 'Salchicha',
  beverage: 'Bebida',
};

const typePriority: Record<ProductType, number> = {
  compound: 1,
  critical_supply: 2,
  manual_supply: 3,
  service: 4,
};

const productTypeBadgeClasses: Record<ProductType, string> = {
  compound: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  critical_supply: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  manual_supply: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  service: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
};

const productTypeTextClasses: Record<ProductType, string> = {
  compound: 'text-amber-400',
  critical_supply: 'text-rose-400',
  manual_supply: 'text-sky-400',
  service: 'text-violet-400',
};

const productTypeDotClasses: Record<ProductType, string> = {
  compound: 'bg-amber-500',
  critical_supply: 'bg-rose-500',
  manual_supply: 'bg-sky-500',
  service: 'bg-violet-500',
};

export default async function ProductsPage() {
  const products = [...(await productService.listProducts())].sort((a, b) => {
    const priorityDiff = typePriority[a.type] - typePriority[b.type];
    if (priorityDiff !== 0) return priorityDiff;
    return a.name.localeCompare(b.name);
  });
  const sellableById = await saleService.calculateAvailabilityForProductIds(
    products.map((product) => product.id)
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Productos y promos</h1>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link href="/productos/nuevo?tab=product" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto">
              Nuevo producto
            </Button>
          </Link>
          <Link href="/productos/nuevo?tab=promo" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto">Nueva promo</Button>
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-white/8">
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
            {products.map((product) => (
              <TableRow key={product.id}>
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
                      {sellableById[product.id] ?? 0} {product.unit}
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
                      (sellableById[product.id] ?? 0) > 0;
                    return isSellable ? (
                      <Badge
                        variant="outline"
                        className="h-8 w-8 justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 p-0 font-mono text-sm font-bold text-emerald-400"
                      >
                        V
                      </Badge>
                    ) : (
                      <Badge
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
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
