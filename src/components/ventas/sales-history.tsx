'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

function formatTime(date: Date | string) {
  const d = new Date(date);
  const hours = d.getUTCHours().toString().padStart(2, '0');
  const minutes = d.getUTCMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
} from '@/components/ui/dialog';
import { VENTAS_API } from '@/config/api';

interface Sale {
  id: number;
  total: number;
  paymentMethod: 'cash' | 'transfer';
  status: 'active' | 'cancelled';
  createdAt: Date;
  items: {
    quantity: number;
    product: {
      name: string;
    };
  }[];
}

interface SalesHistoryProps {
  sales: Sale[];
}

export function SalesHistory({ sales }: SalesHistoryProps) {
  const router = useRouter();
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleCancel() {
    if (!selectedSale) return;

    if (!reason || reason.length < 3) {
      setError('El motivo debe tener al menos 3 caracteres.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${VENTAS_API}/${selectedSale.id}/anular`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al anular la venta');
      }

      setSelectedSale(null);
      setReason('');
      setIsDialogOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  }

  function openCancelDialog(sale: Sale) {
    setSelectedSale(sale);
    setReason('');
    setError(null);
    setIsDialogOpen(true);
  }

  const paymentLabels: Record<string, string> = {
    cash: 'Efectivo',
    transfer: 'Transferencia',
  };

  return (
    <div className="space-y-5">
      {error && isDialogOpen && (
        <div className="rounded-lg bg-destructive/15 p-4 text-base text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-white/8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hora</TableHead>
              <TableHead className="hidden sm:table-cell">Productos</TableHead>
              <TableHead>Total</TableHead>
              <TableHead className="hidden md:table-cell">Pago</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.map((sale) => (
              <TableRow key={sale.id} data-testid={`row-sale-${sale.id}`}>
                <TableCell>
                  {formatTime(sale.createdAt)}
                </TableCell>
                <TableCell className="hidden sm:table-cell max-w-[260px] truncate">
                  {sale.items
                    .map((item) => `${item.product.name} x${item.quantity}`)
                    .join(', ')}
                </TableCell>
                <TableCell className="font-mono">${sale.total.toFixed(2)}</TableCell>
                <TableCell className="hidden md:table-cell">{paymentLabels[sale.paymentMethod]}</TableCell>
                <TableCell>
                  {sale.status === 'active' ? (
                    <Badge variant="default">Activa</Badge>
                  ) : (
                    <Badge variant="secondary">Anulada</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {sale.status === 'active' && (
                    <Button
                      variant="destructive"
                      size="sm"
                      data-testid={`anular-sale-${sale.id}`}
                      onClick={() => openCancelDialog(sale)}
                    >
                      Anular
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular venta #{selectedSale?.id}</DialogTitle>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-5 pt-4">
              <p className="text-base leading-relaxed text-muted-foreground">
                Productos:{' '}
                {selectedSale.items
                  .map(
                    (item) => `${item.product.name} x${item.quantity}`
                  )
                  .join(', ')}
              </p>
              <p className="font-mono text-lg font-semibold text-foreground">
                Total: ${selectedSale.total.toFixed(2)}
              </p>
              <div className="space-y-2">
                <Label htmlFor="cancel-reason">Motivo</Label>
                <Input
                  id="cancel-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Motivo de la anulación"
                />
              </div>
              {error && (
                <div className="rounded-lg bg-destructive/15 p-4 text-base text-destructive">
                  {error}
                </div>
              )}
              <Button
                onClick={handleCancel}
                disabled={isSubmitting}
                variant="destructive"
                className="w-full"
              >
                {isSubmitting ? 'Anulando...' : 'Confirmar anulación'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
