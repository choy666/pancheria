'use client';

import { authenticatedFetch } from '@/lib/fetch';
import { useEffect, useState } from 'react';

function formatDateTime(date: Date | string) {
  const d = new Date(date);
  const day = d.getUTCDate().toString().padStart(2, '0');
  const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const year = d.getUTCFullYear();
  const hours = d.getUTCHours().toString().padStart(2, '0');
  const minutes = d.getUTCMinutes().toString().padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { STOCK_MOVIMIENTOS_API } from '@/config/api';

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
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await authenticatedFetch(
          `${STOCK_MOVIMIENTOS_API}?productId=${productId}`,
          {}
        );
        if (!response.ok) throw new Error('Error al cargar historial');
        const data = (await response.json()) as StockMovement[];
        if (!cancelled) setMovements(data);
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
  }, [productId]);

  if (loading) {
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
      <div className="rounded-2xl border border-white/8">
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
            {movements.map((movement) => (
              <TableRow key={movement.id}>
                <TableCell>
                  {formatDateTime(movement.createdAt)}
                </TableCell>
                <TableCell className="hidden sm:table-cell">{typeLabels[movement.type]}</TableCell>
                <TableCell
                  className={`font-mono font-medium ${
                    movement.quantity > 0 ? 'text-emerald-400' : 'text-destructive'
                  }`}
                >
                  {movement.quantity > 0 ? '+' : ''}
                  {movement.quantity}
                </TableCell>
                <TableCell className="hidden md:table-cell max-w-[200px] truncate">{movement.reason || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
