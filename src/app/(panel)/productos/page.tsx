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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Productos e insumos</h1>
        <Link href="/productos/nuevo">
          <Button>Nuevo producto</Button>
        </Link>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Mínimo</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {productTypeLabels[product.type]}
                    {product.criticalSupplyType
                      ? ` - ${criticalTypeLabels[product.criticalSupplyType]}`
                      : ''}
                  </Badge>
                </TableCell>
                <TableCell>
                  {product.stock} {product.unit}
                  {product.stock <= product.minStock && (
                    <Badge variant="destructive" className="ml-2">
                      Bajo
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {product.minStock} {product.unit}
                </TableCell>
                <TableCell>${product.price.toFixed(2)}</TableCell>
                <TableCell>
                  {product.isActive ? (
                    <Badge>Activo</Badge>
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
