'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authenticatedFetch } from '@/lib/fetch';
import { formatTime } from '@/lib/date';
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
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { VENTAS_API } from '@/config/api';
import { usePaginatedData } from '@/hooks/use-paginated-data';
import type { PaginatedResult, PaymentMethod, SaleStatus } from '@/domain/types';

interface Sale {
  id: number;
  total: number;
  paymentMethod: PaymentMethod;
  status: SaleStatus;
  createdAt: string;
  items: {
    quantity: number;
    product: {
      name: string;
    };
  }[];
}

interface SalesHistoryProps {
  cashRegisterId?: number;
  allowCancel?: boolean;
}

const paymentLabels: Record<string, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
};

export function SalesHistory({
  cashRegisterId,
  allowCancel = true,
}: SalesHistoryProps) {
  const router = useRouter();
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(
    async (page: number, limit: number, signal: AbortSignal) => {
      if (!cashRegisterId) {
        return { items: [], total: 0, page, limit } as PaginatedResult<Sale>;
      }

      const params = new URLSearchParams({
        cashRegisterId: String(cashRegisterId),
        page: String(page),
        limit: String(limit),
      });

      const response = await authenticatedFetch(`${VENTAS_API}?${params}`, {
        signal,
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Error al cargar ventas');
      }

      return (await response.json()) as PaginatedResult<Sale>;
    },
    [cashRegisterId]
  );

  const {
    items: sales,
    total,
    page,
    limit,
    isLoading,
    error: loadError,
    setPage,
    setLimit,
    refresh,
  } = usePaginatedData(load);

  async function handleCancel() {
    if (!selectedSale) return;

    if (!reason || reason.length < 3) {
      setError('El motivo debe tener al menos 3 caracteres.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await authenticatedFetch(
        `${VENTAS_API}/${selectedSale.id}/anular`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al anular la venta');
      }

      setSelectedSale(null);
      setReason('');
      setIsDialogOpen(false);
      refresh();
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error desconocido');
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

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const displayError = error || loadError;

  return (
    <div className="space-y-5">
      {displayError && (
        <div className="rounded-lg bg-destructive/15 p-4 text-base text-destructive">
          {displayError}
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
                <TableCell>{formatTime(sale.createdAt)}</TableCell>
                <TableCell className="hidden sm:table-cell max-w-[260px] truncate">
                  {sale.items
                    .map((item) => `${item.product.name} x${item.quantity}`)
                    .join(', ')}
                </TableCell>
                <TableCell className="font-mono">${sale.total.toFixed(2)}</TableCell>
                <TableCell className="hidden md:table-cell">
                  {paymentLabels[sale.paymentMethod]}
                </TableCell>
                <TableCell>
                  {sale.status === 'active' ? (
                    <Badge variant="default">Activa</Badge>
                  ) : (
                    <Badge variant="secondary">Anulada</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {sale.status === 'active' && allowCancel && (
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

      <Pagination
        page={page}
        limit={limit}
        total={total}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

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
                  .map((item) => `${item.product.name} x${item.quantity}`)
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
