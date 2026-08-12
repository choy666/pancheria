'use client';

import { useCallback } from 'react';
import { authenticatedFetch } from '@/lib/fetch';
import { subDays } from 'date-fns';
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
import { CIERRE_HISTORIAL_API } from '@/config/api';
import { nowUTC, startOfDayUTC, endOfDayUTC } from '@/lib/date';
import { usePaginatedData } from '@/hooks/use-paginated-data';
import type { PaginatedResult } from '@/domain/types';

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
  const load = useCallback(async (page: number, limit: number, signal: AbortSignal) => {
    const now = nowUTC();
    const end = endOfDayUTC(now);
    const start = startOfDayUTC(subDays(now, 30));

    const params = new URLSearchParams({
      start: start.toISOString(),
      end: end.toISOString(),
      page: String(page),
      limit: String(limit),
    });

    const response = await authenticatedFetch(`${CIERRE_HISTORIAL_API}?${params}`, {
      signal,
    });

    if (!response.ok) throw new Error('Error al cargar cierres');
    return (await response.json()) as PaginatedResult<Closure>;
  }, []);

  const {
    items: closures,
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
      <div className="space-y-5">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (error) return <p className="text-destructive">{error}</p>;

  return (
    <div className="space-y-5">
      <div data-tour="closure-history-table" className="rounded-2xl border border-white/8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead className="hidden sm:table-cell">Ventas</TableHead>
              <TableHead>Total</TableHead>
              <TableHead className="hidden md:table-cell">Efectivo</TableHead>
              <TableHead className="hidden lg:table-cell">Transferencia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {closures.map((closure) => (
              <TableRow key={closure.id}>
                <TableCell>
                  {new Date(closure.date).toLocaleDateString('es-AR', { timeZone: 'UTC' })}
                </TableCell>
                <TableCell className="hidden sm:table-cell font-mono">{closure.totalSales}</TableCell>
                <TableCell className="font-mono font-medium text-primary">${closure.total.toFixed(2)}</TableCell>
                <TableCell className="hidden md:table-cell font-mono">${closure.cashTotal.toFixed(2)}</TableCell>
                <TableCell className="hidden lg:table-cell font-mono">${closure.transferTotal.toFixed(2)}</TableCell>
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
