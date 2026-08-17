'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { authenticatedFetch } from '@/lib/fetch';
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
  } = usePaginatedData(load);

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
                <TableCell>{order.customerName}</TableCell>
                <TableCell>{order.branch?.name ?? '—'}</TableCell>
                <TableCell>{deliveryLabels[order.deliveryType]}</TableCell>
                <TableCell className="font-mono">
                  ${order.total.toFixed(2)}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariants[order.status]}>
                    {statusLabels[order.status]}
                  </Badge>
                </TableCell>
                <TableCell>{formatDateTime(order.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <Link
                    href={routes.pedidoDetalle(order.id)}
                    className={cn(
                      buttonVariants({ variant: 'outline', size: 'sm' })
                    )}
                  >
                    Ver
                  </Link>
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
