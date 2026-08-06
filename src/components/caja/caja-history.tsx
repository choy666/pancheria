'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { addDays, intervalToDuration } from 'date-fns';
import { CAJA_HISTORIAL_API } from '@/config/api';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatDateTime, safeFormatDuration } from '@/lib/date';

interface CashRegister {
  id: number;
  openedAt: string;
  closedAt: string | null;
  openedBy: string;
  closedBy: string | null;
  status: 'open' | 'closed';
  autoClosed: boolean;
  total: number;
  cashTotal: number;
  transferTotal: number;
  totalSales: number;
}

interface CajaHistoryProps {
  detailRoute?: string;
  statusFilter?: 'all' | 'closed';
}

export function CajaHistory({
  detailRoute = '/cierre',
  statusFilter = 'closed',
}: CajaHistoryProps) {
  const router = useRouter();
  const [cashRegisters, setCashRegisters] = useState<CashRegister[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const end = new Date();
        const start = addDays(end, -30);

        const params = new URLSearchParams({
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0],
        });

        if (statusFilter !== 'all') {
          params.set('status', statusFilter);
        }

        const response = await fetch(`${CAJA_HISTORIAL_API}?${params}`, {
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Error al cargar historial de cajas');
        setCashRegisters((await response.json()) as CashRegister[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [statusFilter]);

  if (loading) return <p>Cargando...</p>;
  if (error) return <p className="text-destructive">{error}</p>;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="hidden sm:table-cell">ID</TableHead>
              <TableHead>Apertura</TableHead>
              <TableHead>Cierre</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="hidden sm:table-cell">Duración</TableHead>
              <TableHead className="hidden sm:table-cell">Ventas</TableHead>
              <TableHead>Total</TableHead>
              <TableHead className="hidden md:table-cell">Efectivo</TableHead>
              <TableHead className="hidden lg:table-cell">Transferencia</TableHead>
              <TableHead className="hidden sm:table-cell">Auto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cashRegisters.map((cashRegister) => {
              const openedAt = new Date(cashRegister.openedAt);
              const closedAt = cashRegister.closedAt
                ? new Date(cashRegister.closedAt)
                : null;
              const duration = intervalToDuration({
                start: openedAt,
                end: closedAt ?? new Date(),
              });

              return (
                <TableRow
                  key={cashRegister.id}
                  className="cursor-pointer"
                  onClick={() =>
                    router.push(`${detailRoute}/${cashRegister.id}`)
                  }
                >
                  <TableCell className="hidden sm:table-cell font-mono">
                    #{cashRegister.id}
                  </TableCell>
                  <TableCell>{formatDateTime(cashRegister.openedAt)}</TableCell>
                  <TableCell>{formatDateTime(cashRegister.closedAt)}</TableCell>
                  <TableCell>
                    {cashRegister.status === 'open' ? (
                      <Badge variant="default">Abierta</Badge>
                    ) : (
                      <Badge variant="secondary">Cerrada</Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {cashRegister.status === 'open'
                      ? 'En curso'
                      : safeFormatDuration(duration, 'En curso')}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell font-mono">
                    {cashRegister.totalSales}
                  </TableCell>
                  <TableCell className="font-mono font-medium text-primary">
                    ${cashRegister.total.toFixed(2)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell font-mono">
                    ${cashRegister.cashTotal.toFixed(2)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell font-mono">
                    ${cashRegister.transferTotal.toFixed(2)}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {cashRegister.autoClosed ? 'Sí' : 'No'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
