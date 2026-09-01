import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { routes } from '@/config/routes';
import * as productService from '@/application/services/productService';
import { getCurrentBranchIdOrRedirect } from '@/lib/auth';
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
import { ProductTrashActions } from '@/components/productos/product-trash-actions';
import { productTypeLabels } from '@/lib/product-style';
import { formatMoney } from '@/lib/money';
import {
  restoreProductAction,
  permanentlyDeleteProductAction,
} from '@/app/(panel)/productos/actions';

export const dynamic = 'force-dynamic';

export default async function ProductsTrashPage() {
  const session = await auth();

  if (session?.user?.role !== 'admin') {
    redirect(routes.home);
  }

  const branchId = await getCurrentBranchIdOrRedirect(session);
  const products = await productService.listProducts(branchId, true);
  const deletedProducts = products.filter((product) => product.deletedAt !== null);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Papelera de productos</h1>
        <Link href={routes.productos}>
          <Button variant="outline">Volver a productos</Button>
        </Link>
      </div>

      <div className="rounded-2xl border border-white/8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead className="hidden sm:table-cell">Tipo</TableHead>
              <TableHead className="hidden md:table-cell">Precio</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deletedProducts.map((product) => (
              <TableRow key={product.id} data-testid="product-trash-row">
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Badge variant="outline">{productTypeLabels[product.type]}</Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell font-mono">
                  {product.type === 'manual_supply' ? '-' : formatMoney(product.price)}
                </TableCell>
                <TableCell className="text-right">
                  <ProductTrashActions
                    productId={product.id}
                    productName={product.name}
                    restoreProductAction={restoreProductAction}
                    permanentlyDeleteProductAction={permanentlyDeleteProductAction}
                  />
                </TableCell>
              </TableRow>
            ))}
            {deletedProducts.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground"
                >
                  No hay productos en la papelera.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
