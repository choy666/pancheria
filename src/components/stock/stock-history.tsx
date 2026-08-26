'use client';

import { useCallback } from 'react';
import { authenticatedFetch } from '@/lib/fetch';
import { formatDateTime } from '@/lib/date';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/pagination';
import { STOCK_MOVIMIENTOS_API } from '@/config/api';
import { usePaginatedData } from '@/hooks/use-paginated-data';
import type { PaginatedResult } from '@/domain/types';

interface StockMovement {
  id: number;
  type: 'sale' | 'cancellation' | 'manual_adjustment' | 'restock';
  quantity: number;
  reason: string | null;
  createdAt: string;
}

interface StockHistoryProps {
  productId: number;
  productName: string;
}

const typeLabels: Record<string, string> = {
  sale: 'Venta',
  cancellation: 'Anulación',
  manual_adjustment: 'Ajuste manual',
  restock: 'Reposición',
};

export function StockHistory({ productId, productName }: StockHistoryProps) {
  const load = useCallback(
    async (page: number, limit: number, signal: AbortSignal) => {
      const params = new URLSearchParams({
        productId: String(productId),
        page: String(page),
        limit: String(limit),
      });
      const response = await authenticatedFetch(
        `${STOCK_MOVIMIENTOS_API}?${params}`,
        { signal }
      );
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Error al cargar historial');
      }
      return (await response.json()) as PaginatedResult<StockMovement>;
    },
    [productId]
  );

  const {
    items,
    total,
    page,
    limit,
    isLoading,
    error,
    setPage,
    setLimit,
  } = usePaginatedData(load);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (error) return <p className="text-destructive">{error}</p>;

  return (
    <div className="space-y-4">
      <p className="text-base leading-relaxed text-muted-foreground">
        Historial de movimientos para <strong>{productName}</strong>
      </p>
      <div className="overflow-x-auto rounded-2xl border border-white/8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead className="hidden sm:table-cell">Tipo</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead className="hidden md:table-cell">Motivo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((movement) => (
              <TableRow
                key={movement.id}
                data-testid="stock-movement-row"
                data-movement-type={movement.type}
              >
                <TableCell>{formatDateTime(movement.createdAt)}</TableCell>
                <TableCell className="hidden sm:table-cell">
                  {typeLabels[movement.type]}
                </TableCell>
                <TableCell
                  className={`font-mono font-medium ${
                    movement.quantity > 0 ? 'text-emerald-400' : 'text-destructive'
                  }`}
                >
                  {movement.quantity > 0 ? '+' : ''}
                  {movement.quantity}
                </TableCell>
                <TableCell
                  data-testid="stock-movement-reason"
                  className="hidden md:table-cell max-w-[200px] truncate"
                >
                  {movement.reason || '-'}
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
    </div>
  );
}
