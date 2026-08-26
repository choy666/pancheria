'use client';

import { Fragment, useEffect, useState } from 'react';
import { authenticatedFetch } from '@/lib/fetch';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { STOCK_API, STOCK_AJUSTAR_API } from '@/config/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StockHistory } from './stock-history';
import type { CriticalSupplyType, ProductType } from '@/domain/types';

interface StockProduct {
  id: number;
  name: string;
  type: ProductType;
  criticalSupplyType: CriticalSupplyType | null;
  stock: number;
  minStock: number;
  unit: string;
  isLow: boolean;
}

export function StockList() {
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<StockProduct | null>(
    null
  );
  const [dialogMode, setDialogMode] = useState<'adjust' | 'history' | null>(
    null
  );
  const [quantity, setQuantity] = useState(0);
  const [reason, setReason] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<
    'manual_adjustment' | 'restock'
  >('manual_adjustment');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const groupedProducts = groupProductsByType(
    products,
    typePriority,
    criticalSupplyTypePriority
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await authenticatedFetch(STOCK_API, {});
        if (!response.ok) throw new Error('Error al cargar stock');
        const data = (await response.json()) as StockProduct[];
        if (!cancelled) setProducts(data);
      } catch (error) {
        if (!cancelled) {
          setError(error instanceof Error ? error.message : 'Error desconocido');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit() {
    if (!selectedProduct) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await authenticatedFetch(STOCK_AJUSTAR_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct.id,
          quantity,
          reason,
          type: adjustmentType,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al ajustar stock');
      }

      setSelectedProduct(null);
      setDialogMode(null);
      setQuantity(0);
      setReason('');
      setAdjustmentType('manual_adjustment');

      const reload = await authenticatedFetch(STOCK_API, {});
      if (reload.ok) setProducts((await reload.json()) as StockProduct[]);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-10 w-full max-w-sm" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg bg-destructive/15 p-4 text-base text-destructive">
          {error}
        </div>
      )}

      <div data-tour="stock-table" className="rounded-2xl border border-white/8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead className="hidden sm:table-cell">Tipo</TableHead>
              <TableHead className="hidden md:table-cell">Stock</TableHead>
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
                    colSpan={4}
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
                    data-testid="stock-row"
                    data-product-id={product.id}
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
                      <span
                        className={`text-sm sm:hidden ${productTypeTextClasses[product.type]}`}
                      >
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
                    <TableCell
                      data-testid="stock-quantity"
                      className="hidden md:table-cell font-mono"
                    >
                      {product.stock} {product.unit}
                      {product.isLow && (
                        <Badge variant="destructive" className="ml-2">
                          Bajo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          data-tour="stock-adjust"
                          data-testid={`adjust-stock-${product.id}`}
                          variant="ghost"
                          size="sm"
                          className="w-full sm:w-auto"
                          onClick={() => {
                            setSelectedProduct(product);
                            setDialogMode('adjust');
                            setQuantity(0);
                            setReason('');
                            setAdjustmentType('manual_adjustment');
                            setError(null);
                          }}
                        >
                          Ajustar
                        </Button>
                        <Button
                          data-testid={`stock-history-${product.id}`}
                          variant="ghost"
                          size="sm"
                          className="w-full sm:w-auto"
                          onClick={() => {
                            setSelectedProduct(product);
                            setDialogMode('history');
                          }}
                        >
                          Historial
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={dialogMode === 'adjust' && selectedProduct !== null}
        onOpenChange={(open) => {
          if (!open) setDialogMode(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar stock: {selectedProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="adjust-quantity">
                Cantidad (positiva para sumar, negativa para restar)
              </Label>
              <Input
                id="adjust-quantity"
                type="number"
                value={quantity}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setQuantity(next);

                  if (!selectedProduct) return;

                  if (selectedProduct.stock === 0 && next > 0 && !reason) {
                    setReason('Stock inicial');
                    setAdjustmentType('restock');
                  } else if (selectedProduct.stock === 0 && next <= 0) {
                    setAdjustmentType('manual_adjustment');
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adjust-reason">Motivo</Label>
              <Textarea
                id="adjust-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <Button
              onClick={handleSubmit}
              disabled={
                isSubmitting ||
                quantity === 0 ||
                reason.trim().length < 3
              }
              className="w-full"
            >
              {isSubmitting ? 'Guardando...' : 'Guardar ajuste'}
            </Button>
            {(quantity === 0 || reason.trim().length < 3) && (
              <p className="text-sm text-muted-foreground">
                Indicá una cantidad distinta de cero y un motivo de al menos 3
                caracteres.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialogMode === 'history' && selectedProduct !== null}
        onOpenChange={(open) => {
          if (!open) setDialogMode(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md md:max-w-xl lg:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Historial de stock</DialogTitle>
          </DialogHeader>
          <div className="pt-4">
            {selectedProduct && (
              <StockHistory
                productId={selectedProduct.id}
                productName={selectedProduct.name}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
