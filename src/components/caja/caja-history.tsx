'use client';

import { authenticatedFetch } from '@/lib/fetch';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { CAJA_API, CAJA_ELIMINADAS_API } from '@/config/api';
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
import { formatDateTime } from '@/lib/date';
import { Pagination } from '@/components/ui/pagination';
import { CashRegisterActions } from '@/components/caja/cash-register-actions';
import { useCashRegisterHistory } from '@/components/caja/use-cash-register-history';
import type { CashRegister } from '@/config/caja';

interface Branch {
  id: number;
  name: string;
}

interface CajaHistoryProps {
  detailRoute?: string;
  statusFilter?: 'all' | 'closed';
  showAutoColumn?: boolean;
  deletedOnly?: boolean;
  isAdmin?: boolean;
  branches?: Branch[];
  onDelete?: (id: number) => Promise<void>;
  onRestore?: (id: number) => Promise<void>;
  onPermanentDelete?: (id: number) => Promise<void>;
  onEmptyTrash?: (start: string, end: string) => Promise<void>;
}

export function CajaHistory({
  detailRoute = '/cierre',
  statusFilter = 'closed',
  showAutoColumn = true,
  deletedOnly = false,
  isAdmin = false,
  branches,
  onDelete,
  onRestore,
  onPermanentDelete,
  onEmptyTrash,
}: CajaHistoryProps) {
  const router = useRouter();
  const [actionError, setActionError] = useState<string | null>(null);
  const {
    data: cashRegisters,
    total,
    page,
    limit,
    startDate,
    endDate,
    error,
    isLoading,
    setPage,
    setLimit,
    refresh,
  } = useCashRegisterHistory({ statusFilter, deletedOnly });

  async function handleDelete(id: number) {
    try {
      if (onDelete) {
        await onDelete(id);
      } else {
        const response = await authenticatedFetch(`${CAJA_API}/${id}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          throw new Error(data.error || 'Error al eliminar la caja');
        }
      }

      refresh();
      setActionError(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Error desconocido');
    }
  }

  async function handleRestore(id: number) {
    try {
      if (onRestore) {
        await onRestore(id);
      } else {
        const response = await authenticatedFetch(`${CAJA_API}/${id}/restaurar`, {
          method: 'POST',
        });

        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          throw new Error(data.error || 'Error al restaurar la caja');
        }
      }

      refresh();
      setActionError(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Error desconocido');
    }
  }

  async function handlePermanentDelete(id: number) {
    try {
      if (onPermanentDelete) {
        await onPermanentDelete(id);
      } else {
        const response = await authenticatedFetch(`${CAJA_API}/${id}/permanente`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          throw new Error(
            data.error || 'Error al eliminar la caja permanentemente'
          );
        }
      }

      refresh();
      setActionError(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Error desconocido');
    }
  }

  async function handleEmptyTrash(startDate: string, endDate: string) {
    try {
      if (onEmptyTrash) {
        await onEmptyTrash(startDate, endDate);
      } else {
        const response = await authenticatedFetch(
          `${CAJA_ELIMINADAS_API}?start=${startDate}&end=${endDate}`,
          {
            method: 'DELETE',
          }
        );

        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          throw new Error(data.error || 'Error al vaciar la papelera');
        }
      }

      refresh();
      setActionError(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Error desconocido');
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-3 py-12 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
        <span>Cargando historial...</span>
      </div>
    );
  }

  if (error) {
    return <p className="text-destructive">{error}</p>;
  }

  const branchNameById = new Map(branches?.map((b) => [b.id, b.name]));

  return (
    <div className="space-y-5">
      {actionError && <p className="text-destructive">{actionError}</p>}

      {deletedOnly && isAdmin && (
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
              <TableHead className="hidden sm:table-cell">Ventas</TableHead>
              <TableHead>Total</TableHead>
              <TableHead className="hidden md:table-cell">Efectivo</TableHead>
              <TableHead className="hidden lg:table-cell">Transferencia</TableHead>
              {showAutoColumn && (
                <TableHead className="hidden sm:table-cell">Auto</TableHead>
              )}
              <TableHead className="hidden sm:table-cell">Abierta por</TableHead>
              <TableHead className="hidden sm:table-cell">Cerrada por</TableHead>
              {isAdmin && (
                <TableHead className="hidden md:table-cell">Sucursal</TableHead>
              )}
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cashRegisters.map((cashRegister: CashRegister) => {
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
                    <TableCell>
                      {formatDateTime(cashRegister.deletedAt ?? null)}
                    </TableCell>
                  )}
                  <TableCell>
                    {cashRegister.status === 'open' ? (
                      <Badge variant="default">Abierta</Badge>
                    ) : (
                      <Badge variant="secondary">Cerrada</Badge>
                    )}
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
                  <TableCell className="hidden sm:table-cell">
                    {cashRegister.openedBy}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {cashRegister.closedBy ?? '-'}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="hidden md:table-cell">
                      {branchNameById.get(cashRegister.branchId) ??
                        `Sucursal ${cashRegister.branchId}`}
                    </TableCell>
                  )}
                  <TableCell
                    className="text-right"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <CashRegisterActions
                      cashRegister={cashRegister}
                      mode={deletedOnly ? 'trash' : 'history'}
                      isAdmin={isAdmin}
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
