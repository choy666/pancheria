'use client';

import { authenticatedFetch, throwApiError } from '@/lib/fetch';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { CAJA_API, CAJA_ELIMINADAS_API, CAJA_HISTORIAL_API } from '@/config/api';
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
import { formatMoney } from '@/lib/money';
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
} from '@/lib/payment-helpers';
import type { PaymentMethod } from '@/domain/types';
import { Pagination } from '@/components/ui/pagination';
import { routes } from '@/config/routes';
import { CashRegisterActions } from '@/components/caja/cash-register-actions';
import { useCashRegisterHistory } from '@/components/caja/use-cash-register-history';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
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
  onEmptyTrash?: () => Promise<void>;
  onDeleteAllClosed?: () => Promise<void>;
}

export function CajaHistory({
  detailRoute = routes.cierre,
  statusFilter = 'closed',
  showAutoColumn = true,
  deletedOnly = false,
  isAdmin = false,
  branches,
  onDelete,
  onRestore,
  onPermanentDelete,
  onEmptyTrash,
  onDeleteAllClosed,
}: CajaHistoryProps) {
  const router = useRouter();
  const { dialog, confirm } = useConfirmDialog();
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const {
    data: cashRegisters,
    total,
    page,
    limit,
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
          await throwApiError(response, 'Error al eliminar la caja');
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
          await throwApiError(response, 'Error al restaurar la caja');
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
          await throwApiError(
            response,
            'Error al eliminar la caja permanentemente'
          );
        }
      }

      refresh();
      setActionError(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Error desconocido');
    }
  }

  async function handleEmptyTrash() {
    try {
      if (onEmptyTrash) {
        await onEmptyTrash();
      } else {
        const response = await authenticatedFetch(CAJA_ELIMINADAS_API, {
          method: 'DELETE',
        });

        if (!response.ok) {
          await throwApiError(response, 'Error al vaciar la papelera');
        }

        const data = (await response.json()) as { deleted: number };
        setActionMessage(
          data.deleted === 1
            ? 'Se eliminó definitivamente 1 caja.'
            : `Se eliminaron definitivamente ${data.deleted} cajas.`
        );
      }

      refresh();
      setActionError(null);
    } catch (error) {
      setActionMessage(null);
      setActionError(error instanceof Error ? error.message : 'Error desconocido');
    }
  }

  async function handleDeleteAllClosed() {
    try {
      if (onDeleteAllClosed) {
        await onDeleteAllClosed();
      } else {
        const response = await authenticatedFetch(CAJA_HISTORIAL_API, {
          method: 'DELETE',
        });

        if (!response.ok) {
          await throwApiError(response, 'Error al eliminar las cajas cerradas');
        }

        const data = (await response.json()) as { deleted: number };
        setActionMessage(
          data.deleted === 1
            ? 'Se movió 1 caja a la papelera.'
            : `Se movieron ${data.deleted} cajas a la papelera.`
        );
      }

      refresh();
      setActionError(null);
    } catch (error) {
      setActionMessage(null);
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

  // Columnas base: ID, Apertura, Cierre, Estado, Ventas, Total, Inicial,
  // Efectivo, Transferencia, Diferencia, Abierta por, Cerrada por y Acciones.
  const columnCount =
    14 +
    (deletedOnly ? 1 : 0) +
    (showAutoColumn ? 1 : 0) +
    (isAdmin ? 1 : 0);

  return (
    <div className="space-y-5">
      {actionError && <p className="text-destructive">{actionError}</p>}
      {actionMessage && (
        <p data-testid="bulk-action-result" className="text-sm text-muted-foreground">
          {actionMessage}
        </p>
      )}

      {isAdmin && (
        <div className="flex justify-end">
          {dialog}
          {deletedOnly ? (
            <Button
              variant="destructive"
              size="sm"
              data-testid="empty-trash"
              onClick={async () => {
                const shouldEmpty = await confirm({
                  title: 'Vaciar papelera',
                  description:
                    '¿Vaciar la papelera? Se eliminarán definitivamente todas las cajas eliminadas de la sucursal, sin límite de fecha, junto con sus ventas asociadas. El stock descontado por esas ventas se reintegrará al inventario. Esta acción no se puede deshacer.',
                  confirmLabel: 'Vaciar',
                });
                if (shouldEmpty) {
                  void handleEmptyTrash();
                }
              }}
            >
              Vaciar papelera
            </Button>
          ) : (
            <Button
              variant="destructive"
              size="sm"
              data-testid="delete-all-closed"
              onClick={async () => {
                const shouldDelete = await confirm({
                  title: 'Eliminar cajas cerradas',
                  description:
                    '¿Eliminar todas las cajas cerradas? Se moverán a la papelera todas las cajas cerradas de la sucursal, sin límite de fecha. Las cajas abiertas no se eliminan.',
                  confirmLabel: 'Eliminar',
                });
                if (shouldDelete) {
                  void handleDeleteAllClosed();
                }
              }}
            >
              Eliminar cajas cerradas
            </Button>
          )}
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
              <TableHead className="hidden md:table-cell">Inicial</TableHead>
              <TableHead className="hidden md:table-cell">Efectivo</TableHead>
              <TableHead className="hidden lg:table-cell">Transferencia</TableHead>
              <TableHead className="hidden lg:table-cell">Diferencia</TableHead>
              {showAutoColumn && (
                <TableHead className="hidden sm:table-cell">Auto</TableHead>
              )}
              <TableHead className="hidden sm:table-cell">Abierta por</TableHead>
              <TableHead className="hidden sm:table-cell">Cerrada por</TableHead>
              <TableHead className="hidden sm:table-cell">Forzado</TableHead>
              {isAdmin && (
                <TableHead data-testid="cash-register-branch-header" className="hidden md:table-cell">Sucursal</TableHead>
              )}
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cashRegisters.map((cashRegister: CashRegister) => {
              return (
                <TableRow
                  key={cashRegister.id}
                  data-testid={`cash-register-row-${cashRegister.id}`}
                  data-cash-register-id={cashRegister.id}
                  className="cursor-pointer"
                  onClick={() =>
                    router.push(
                      `${detailRoute}/${cashRegister.id}${
                        deletedOnly ? '?from=trash' : ''
                      }`
                    )
                  }
                >
                  <TableCell
                    data-testid={`cash-register-id-${cashRegister.id}`}
                    className="hidden sm:table-cell font-mono"
                  >
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
                  <TableCell
                    data-testid={`cash-register-total-${cashRegister.id}`}
                    className="font-mono font-medium text-primary"
                  >
                    {formatMoney(cashRegister.total)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell font-mono">
                    {formatMoney(cashRegister.initialAmount)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell font-mono">
                    {formatMoney(cashRegister.cashTotal)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell font-mono">
                    {formatMoney(cashRegister.transferTotal)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell font-mono">
                    {(() => {
                      const differenceByMethod: Record<
                        PaymentMethod,
                        number | null | undefined
                      > = {
                        cash: cashRegister.closingDifference,
                        transfer: cashRegister.closingTransferDifference,
                      };
                      const methods = PAYMENT_METHODS.filter(
                        (method) =>
                          differenceByMethod[method] !== undefined &&
                          differenceByMethod[method] !== null
                      );
                      if (methods.length === 0) return '-';
                      return methods.map((method) => {
                        const difference = differenceByMethod[method] as number;
                        return (
                          <div
                            key={method}
                            data-testid={`cash-register-${method}-difference-${cashRegister.id}`}
                            className={
                              difference > 0
                                ? 'text-green-600'
                                : difference < 0
                                  ? 'text-destructive'
                                  : ''
                            }
                          >
                            {PAYMENT_METHOD_LABELS[method]}:{' '}
                            {difference > 0 ? '+' : ''}
                            {formatMoney(difference)}
                          </div>
                        );
                      });
                    })()}
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
                  <TableCell
                    className="hidden sm:table-cell"
                    title={cashRegister.forcedCloseReason ?? undefined}
                  >
                    {cashRegister.forcedClosed ? 'Sí' : 'No'}
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
            {cashRegisters.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={columnCount}
                  className="text-center text-muted-foreground"
                >
                  {deletedOnly
                    ? 'No hay cajas eliminadas.'
                    : 'No hay cajas en el historial.'}
                </TableCell>
              </TableRow>
            )}
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
