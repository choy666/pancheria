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
import { deleteProduct } from './actions';
import * as productService from '@/application/services/productService';

const productTypeLabels: Record<string, string> = {
  critical_supply: 'Insumo crítico',
  compound: 'Compuesto',
  manual_supply: 'Insumo manual',
};

const criticalTypeLabels: Record<string, string> = {
  bread: 'Pan',
  sausage: 'Salchicha',
  beverage: 'Bebida',
};

export default async function ProductsPage() {
  const products = await productService.listProducts();

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Productos e insumos</h1>
        <Link href="/productos/nuevo" className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto">Nuevo producto</Button>
        </Link>
      </div>

      <div className="rounded-2xl border border-white/8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead className="hidden sm:table-cell">Tipo</TableHead>
              <TableHead className="hidden md:table-cell">Stock</TableHead>
              <TableHead className="hidden lg:table-cell">Mínimo</TableHead>
              <TableHead className="hidden lg:table-cell">Precio</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium">
                  <span className="block">{product.name}</span>
                  <span className="text-sm text-muted-foreground sm:hidden">
                    {productTypeLabels[product.type]}
                    {product.criticalSupplyType
                      ? ` · ${criticalTypeLabels[product.criticalSupplyType]}`
                      : ''}
                  </span>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Badge variant="outline">
                    {productTypeLabels[product.type]}
                    {product.criticalSupplyType
                      ? ` - ${criticalTypeLabels[product.criticalSupplyType]}`
                      : ''}
                  </Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell font-mono">
                  {product.stock} {product.unit}
                  {product.stock <= product.minStock && (
                    <Badge variant="destructive" className="ml-2">
                      Bajo
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="hidden lg:table-cell font-mono">
                  {product.minStock} {product.unit}
                </TableCell>
                <TableCell className="hidden lg:table-cell font-mono">
                  ${product.price.toFixed(2)}
                </TableCell>
                <TableCell>
                  {product.isActive ? (
                    <Badge variant="default">Activo</Badge>
                  ) : (
                    <Badge variant="secondary">Inactivo</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <ProductActions
                    productId={product.id}
                    productName={product.name}
                    isCompound={product.type === 'compound'}
                    deleteProduct={deleteProduct}
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
