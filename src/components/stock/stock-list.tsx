'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

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
  const router = useRouter();
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<StockProduct | null>(
    null
  );
  const [quantity, setQuantity] = useState(0);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch('/api/stock');
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
      const response = await fetch('/api/stock/ajustar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      setQuantity(0);
      setReason('');
      router.refresh();

      const reload = await fetch('/api/stock');
      if (reload.ok) setProducts((await reload.json()) as StockProduct[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) return <p>Cargando...</p>;

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Mínimo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell>
                  {product.stock} {product.unit}
                </TableCell>
                <TableCell>
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
                  <Dialog>
                    <DialogTrigger>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedProduct(product)}
                      >
                        Ajustar
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Ajustar stock: {product.name}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <Label htmlFor={`quantity-${product.id}`}>
                            Cantidad (positiva para sumar, negativa para restar)
                          </Label>
                          <Input
                            id={`quantity-${product.id}`}
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(Number(e.target.value))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`reason-${product.id}`}>Motivo</Label>
                          <Textarea
                            id={`reason-${product.id}`}
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
