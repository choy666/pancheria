'use client';

import { useEffect, useState } from 'react';

function formatDateTime(date: Date | string) {
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
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
    async function load() {
      try {
        const response = await fetch(
          `/api/stock/movimientos?productId=${productId}`,
          { credentials: 'include' }
        );
        if (!response.ok) throw new Error('Error al cargar historial');
        setMovements((await response.json()) as StockMovement[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [productId]);

  if (loading) return <p>Cargando...</p>;
  if (error) return <p className="text-destructive">{error}</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Historial de movimientos para <strong>{productName}</strong>
      </p>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Motivo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.map((movement) => (
              <TableRow key={movement.id}>
                <TableCell>
                  {formatDateTime(movement.createdAt)}
                </TableCell>
                <TableCell>{typeLabels[movement.type]}</TableCell>
                <TableCell
                  className={
                    movement.quantity > 0 ? 'text-green-600' : 'text-red-600'
                  }
                >
                  {movement.quantity > 0 ? '+' : ''}
                  {movement.quantity}
                </TableCell>
                <TableCell>{movement.reason || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
