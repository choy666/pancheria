'use client';

import { use, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { subDays, intervalToDuration } from 'date-fns';
import {
  CAJA_API,
  CAJA_HISTORIAL_API,
  CAJA_ELIMINADAS_API,
} from '@/config/api';
import { DEFAULT_CAJA_HISTORY_DAYS } from '@/config/caja';
import { Button } from '@/components/ui/button';
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
import { CashRegisterActions } from '@/components/caja/cash-register-actions';

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
  deletedAt: string | null;
  createdAt: string;
}

interface CajaHistoryProps {
  detailRoute?: string;
  statusFilter?: 'all' | 'closed';
  showAutoColumn?: boolean;
  deletedOnly?: boolean;
  onDelete?: (id: number) => Promise<void>;
  onRestore?: (id: number) => Promise<void>;
  onPermanentDelete?: (id: number) => Promise<void>;
  onEmptyTrash?: (start: string, end: string) => Promise<void>;
}

type LoadResult =
  | {
      data: CashRegister[];
      startDate: string;
      endDate: string;
    }
  | { error: string };

function buildCashRegisterPromise(
  statusFilter: 'all' | 'closed',
  deletedOnly: boolean,
  _refreshKey: number
): Promise<LoadResult> {
  void _refreshKey;
  const end = new Date();
  const start = subDays(end, DEFAULT_CAJA_HISTORY_DAYS);
  const endStr = end.toISOString().split('T')[0];
  const startStr = start.toISOString().split('T')[0];

  const params = new URLSearchParams({
    start: startStr,
    end: endStr,
  });

  const endpoint = deletedOnly ? CAJA_ELIMINADAS_API : CAJA_HISTORIAL_API;

  if (!deletedOnly && statusFilter !== 'all') {
    params.set('status', statusFilter);
  }

  return fetch(`${endpoint}?${params}`, {
    credentials: 'include',
  })
    .then(async (response) => {
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Error al cargar historial de cajas');
      }

      const data = (await response.json()) as CashRegister[];
      return {
        data,
        startDate: startStr,
        endDate: endStr,
      };
    })
    .catch((err) => ({
      error: err instanceof Error ? err.message : 'Error desconocido',
    }));
}

export function CajaHistory({
  detailRoute = '/cierre',
  statusFilter = 'closed',
  showAutoColumn = true,
  deletedOnly = false,
  onDelete,
  onRestore,
  onPermanentDelete,
  onEmptyTrash,
}: CajaHistoryProps) {
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);

  const promise = useMemo(
    () => buildCashRegisterPromise(statusFilter, deletedOnly, refreshKey),
    [statusFilter, deletedOnly, refreshKey]
  );
  const result = use(promise);

  async function handleDelete(id: number) {
    try {
      if (onDelete) {
        await onDelete(id);
      } else {
        const response = await fetch(`${CAJA_API}/${id}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          throw new Error(data.error || 'Error al eliminar la caja');
        }
      }

      setRefreshKey((prev) => prev + 1);
      setActionError(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error desconocido');
    }
  }

  async function handleRestore(id: number) {
    try {
      if (onRestore) {
        await onRestore(id);
      } else {
        const response = await fetch(`${CAJA_API}/${id}/restaurar`, {
          method: 'POST',
          credentials: 'include',
        });

        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          throw new Error(data.error || 'Error al restaurar la caja');
        }
      }

      setRefreshKey((prev) => prev + 1);
      setActionError(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error desconocido');
    }
  }

  async function handlePermanentDelete(id: number) {
    try {
      if (onPermanentDelete) {
        await onPermanentDelete(id);
      } else {
        const response = await fetch(`${CAJA_API}/${id}/permanente`, {
          method: 'DELETE',
          credentials: 'include',
        });

        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          throw new Error(
            data.error || 'Error al eliminar la caja permanentemente'
          );
        }
      }

      setRefreshKey((prev) => prev + 1);
      setActionError(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error desconocido');
    }
  }

  async function handleEmptyTrash(startDate: string, endDate: string) {
    try {
      if (onEmptyTrash) {
        await onEmptyTrash(startDate, endDate);
      } else {
        const response = await fetch(
          `${CAJA_ELIMINADAS_API}?start=${startDate}&end=${endDate}`,
          {
            method: 'DELETE',
            credentials: 'include',
          }
        );

        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          throw new Error(data.error || 'Error al vaciar la papelera');
        }
      }

      setRefreshKey((prev) => prev + 1);
      setActionError(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error desconocido');
    }
  }

  if ('error' in result) {
    return <p className="text-destructive">{result.error}</p>;
  }

  const { data: cashRegisters, startDate, endDate } = result;

  return (
    <div className="space-y-5">
      {actionError && (
        <p className="text-destructive">{actionError}</p>
      )}

      {deletedOnly && (
        <div className="flex justify-end">
          <Button
            variant="destructive"
            size="sm"
            data-testid="empty-trash"
            onClick={() => {
              if (
                confirm(
                  '¿Vaciar la papelera? Se eliminarán definitivamente todas las cajas mostradas en el rango actual.'
                )
              ) {
                void handleEmptyTrash(startDate, endDate);
              }
            }}
          >
            Vaciar papelera
          </Button>
        </div>
      )}

      <div className="rounded-2xl border border-white/8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="hidden sm:table-cell">ID</TableHead>
              <TableHead>Apertura</TableHead>
              <TableHead>Cierre</TableHead>
              {deletedOnly && <TableHead>Eliminada</TableHead>}
              <TableHead>Estado</TableHead>
              <TableHead className="hidden sm:table-cell">Duración</TableHead>
              <TableHead className="hidden sm:table-cell">Ventas</TableHead>
              <TableHead>Total</TableHead>
              <TableHead className="hidden md:table-cell">Efectivo</TableHead>
              <TableHead className="hidden lg:table-cell">Transferencia</TableHead>
              {showAutoColumn && (
                <TableHead className="hidden sm:table-cell">Auto</TableHead>
              )}
              <TableHead className="text-right">Acciones</TableHead>
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
                    router.push(
                      `${detailRoute}/${cashRegister.id}${
                        deletedOnly ? '?from=trash' : ''
                      }`
                    )
                  }
                >
                  <TableCell className="hidden sm:table-cell font-mono">
                    #{cashRegister.id}
                  </TableCell>
                  <TableCell>{formatDateTime(cashRegister.openedAt)}</TableCell>
                  <TableCell>{formatDateTime(cashRegister.closedAt)}</TableCell>
                  {deletedOnly && (
                    <TableCell>{formatDateTime(cashRegister.deletedAt)}</TableCell>
                  )}
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
                  {showAutoColumn && (
                    <TableCell className="hidden sm:table-cell">
                      {cashRegister.autoClosed ? 'Sí' : 'No'}
                    </TableCell>
                  )}
                  <TableCell
                    className="text-right"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <CashRegisterActions
                      cashRegister={cashRegister}
                      mode={deletedOnly ? 'trash' : 'history'}
                      onDelete={handleDelete}
                      onRestore={handleRestore}
                      onPermanentDelete={handlePermanentDelete}
                    />
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
