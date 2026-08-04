'use client';

import { useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Closure {
  id: number;
  date: string;
  total: number;
  cashTotal: number;
  transferTotal: number;
  totalSales: number;
  productsSummary: string;
  criticalSuppliesSummary: string;
}

export function ClosureHistory() {
  const [closures, setClosures] = useState<Closure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 30);

        const params = new URLSearchParams({
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0],
        });

        const response = await fetch(`/api/cierre/historial?${params}`, {
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Error al cargar cierres');
        setClosures((await response.json()) as Closure[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) return <p>Cargando...</p>;
  if (error) return <p className="text-destructive">{error}</p>;

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Ventas</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Efectivo</TableHead>
              <TableHead>Transferencia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {closures.map((closure) => (
              <TableRow key={closure.id}>
                <TableCell>
                  {new Date(closure.date).toLocaleDateString('es-AR')}
                </TableCell>
                <TableCell>{closure.totalSales}</TableCell>
                <TableCell>${closure.total.toFixed(2)}</TableCell>
                <TableCell>${closure.cashTotal.toFixed(2)}</TableCell>
                <TableCell>${closure.transferTotal.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
