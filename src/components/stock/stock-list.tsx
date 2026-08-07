'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { STOCK_API, STOCK_AJUSTAR_API } from '@/config/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StockHistory } from './stock-history';

interface StockProduct {
  id: number;
  name: string;
  type: string;
  criticalSupplyType: string | null;
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
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(STOCK_API, { credentials: 'include' });
        if (!response.ok) throw new Error('Error al cargar stock');
        setProducts((await response.json()) as StockProduct[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  async function handleSubmit() {
    if (!selectedProduct) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(STOCK_AJUSTAR_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          productId: selectedProduct.id,
          quantity,
          reason,
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

      const reload = await fetch(STOCK_API, { credentials: 'include' });
      if (reload.ok) setProducts((await reload.json()) as StockProduct[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
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

      <div className="rounded-2xl border border-white/8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead className="hidden sm:table-cell">Stock</TableHead>
              <TableHead className="hidden md:table-cell">Mínimo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium">
                  <span className="block">{product.name}</span>
                  <span className="font-mono text-sm text-muted-foreground sm:hidden">
                    {product.stock} / {product.minStock} {product.unit}
                  </span>
                </TableCell>
                <TableCell className="hidden sm:table-cell font-mono">
                  {product.stock} {product.unit}
                </TableCell>
                <TableCell className="hidden md:table-cell font-mono">
                  {product.minStock} {product.unit}
                </TableCell>
                <TableCell>
                  {product.isLow ? (
                    <Badge variant="destructive">Stock bajo</Badge>
                  ) : (
                    <Badge variant="default">OK</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedProduct(product);
                        setDialogMode('adjust');
                        setQuantity(0);
                        setReason('');
                        setError(null);
                      }}
                    >
                      Ajustar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
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
                onChange={(e) => setQuantity(Number(e.target.value))}
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
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? 'Guardando...' : 'Guardar ajuste'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialogMode === 'history' && selectedProduct !== null}
        onOpenChange={(open) => {
          if (!open) setDialogMode(null);
        }}
      >
        <DialogContent>
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
