'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { authenticatedFetch } from '@/lib/fetch';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/date';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { PEDIDOS_API } from '@/config/api';
import { getPedidosRefreshIntervalMs } from '@/config/orders';
import { routes } from '@/config/routes';
import { usePaginatedData } from '@/hooks/use-paginated-data';
import { cn } from '@/lib/utils';
import type { OrderStatus, DeliveryType } from '@/domain/types';

interface OrderListItem {
  id: number;
  orderNumber: string;
  customerName: string;
  deliveryType: DeliveryType;
  total: number;
  status: OrderStatus;
  createdAt: string;
  branch: { name: string } | null;
  unreadCount: number;
  items: {
    quantity: number;
    product?: {
      name: string;
    } | null;
  }[];
}

const statusLabels: Record<OrderStatus, string> = {
  pending: 'Pendiente',
  converted: 'Confirmado',
  cancelled: 'Cancelado',
};

const statusVariants: Record<OrderStatus, 'default' | 'secondary' | 'destructive'> = {
  pending: 'default',
  converted: 'secondary',
  cancelled: 'destructive',
};

const deliveryLabels: Record<DeliveryType, string> = {
  delivery: 'Envío',
  pickup: 'Retiro',
};

interface PedidosListProps {
  status?: OrderStatus;
  branchId: number;
}

export function PedidosList({ status = 'pending', branchId }: PedidosListProps) {
  const load = useCallback(
    async (page: number, limit: number, signal: AbortSignal) => {
      const params = new URLSearchParams({
        branchId: String(branchId),
        status,
        page: String(page),
        limit: String(limit),
      });

      const response = await authenticatedFetch(`${PEDIDOS_API}?${params}`, {
        signal,
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Error al cargar pedidos');
      }

      return (await response.json()) as {
        items: OrderListItem[];
        total: number;
        page: number;
        limit: number;
      };
    },
    [status, branchId]
  );

  const {
    items: orders,
    total,
    page,
    limit,
    isLoading,
    error,
    setPage,
    setLimit,
    refresh,
  } = usePaginatedData(load, {
    refreshIntervalMs: getPedidosRefreshIntervalMs(),
  });

  const [loadingId, setLoadingId] = useState<number | null>(null);

  async function handleConfirm(orderId: number) {
    setLoadingId(orderId);
    try {
      const response = await authenticatedFetch(
        `/api/pedidos/${orderId}/confirmar`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentMethod: 'cash',
            idempotencyKey: crypto.randomUUID(),
          }),
        }
      );
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Error al confirmar el pedido');
      }
      await refresh();
    } finally {
      setLoadingId(null);
    }
  }

  async function handleCancel(orderId: number) {
    setLoadingId(orderId);
    try {
      const response = await authenticatedFetch(
        `/api/pedidos/${orderId}/cancelar`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Cancelado desde el panel' }),
        }
      );
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Error al cancelar el pedido');
      }
      await refresh();
    } finally {
      setLoadingId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg bg-destructive/15 p-4 text-base text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-white/8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Sucursal</TableHead>
              <TableHead>Entrega</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Creado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                <TableCell className="font-medium">
                  #{order.orderNumber}
                </TableCell>
                <TableCell data-testid="order-customer-name">
                  {order.customerName}
                </TableCell>
                <TableCell>{order.branch?.name ?? '—'}</TableCell>
                <TableCell>{deliveryLabels[order.deliveryType]}</TableCell>
                <TableCell className="font-mono">
                  ${order.total.toFixed(2)}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={statusVariants[order.status]}>
                      {statusLabels[order.status]}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>{formatDateTime(order.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {order.unreadCount > 0 && (
                      <Badge
                        variant="destructive"
                        className="px-1.5 py-0.5 text-xs"
                        aria-label={`${order.unreadCount} mensajes sin leer`}
                      >
                        {order.unreadCount}
                      </Badge>
                    )}
                    <Link
                      href={routes.pedidoDetalle(order.id)}
                      data-testid={`view-order-${order.id}`}
                      className={cn(
                        buttonVariants({ variant: 'outline', size: 'sm' })
                      )}
                    >
                      Ver
                    </Link>
                    {order.status === 'pending' && (
                      <>
                        <Button
                          data-testid={`confirm-order-${order.id}`}
                          variant="secondary"
                          size="sm"
                          disabled={loadingId === order.id}
                          onClick={() => handleConfirm(order.id)}
                        >
                          Confirmar
                        </Button>
                        <Button
                          data-testid={`cancel-order-${order.id}`}
                          variant="destructive"
                          size="sm"
                          disabled={loadingId === order.id}
                          onClick={() => handleCancel(order.id)}
                        >
                          Cancelar
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {orders.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-muted-foreground"
                >
                  No hay pedidos para mostrar.
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
