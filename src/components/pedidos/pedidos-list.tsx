'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2, RefreshCw } from 'lucide-react';
import { authenticatedFetch } from '@/lib/fetch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  customerPhone: string;
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

const SEARCH_DEBOUNCE_MS = 300;

export function PedidosList({ status = 'pending', branchId }: PedidosListProps) {
  const [statusFilter, setStatusFilter] = useState<OrderStatus>(status);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(
    async (page: number, limit: number, signal: AbortSignal) => {
      const params = new URLSearchParams({
        branchId: String(branchId),
        status: statusFilter,
        page: String(page),
        limit: String(limit),
      });

      if (search) {
        params.set('search', search);
      }

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
    [statusFilter, search, branchId]
  );

  const {
    items: orders,
    total,
    page,
    limit,
    isLoading,
    isRefreshing,
    error,
    setPage,
    setLimit,
    refresh,
  } = usePaginatedData(load, {
    refreshIntervalMs: getPedidosRefreshIntervalMs(),
  });

  const appliedSearchRef = useRef(search);
  const pageRef = useRef(page);

  useEffect(() => {
    appliedSearchRef.current = search;
    pageRef.current = page;
  }, [search, page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchInput.trim();
      if (trimmed === appliedSearchRef.current) return;

      setSearch(trimmed);
      if (pageRef.current !== 1) {
        setPage(1);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchInput, setPage]);

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

  function handleStatusChange(value: string | null) {
    if (!value || value === statusFilter) return;
    setStatusFilter(value as OrderStatus);
    if (page !== 1) {
      setPage(1);
    }
  }

  function handleClearSearch() {
    setSearchInput('');
    if (search !== '') {
      setSearch('');
    }
    if (page !== 1) {
      setPage(1);
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

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex w-full flex-col gap-1.5 sm:w-auto">
          <Label htmlFor="orders-status-filter" className="text-sm text-muted-foreground">
            Estado
          </Label>
          <Select
            value={statusFilter}
            onValueChange={handleStatusChange}
          >
            <SelectTrigger
              id="orders-status-filter"
              data-testid="orders-status-filter"
              className="w-full sm:w-[180px]"
              aria-label="Filtrar por estado"
            >
              <SelectValue placeholder="Seleccionar estado" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(statusLabels) as OrderStatus[]).map((statusValue) => (
                <SelectItem key={statusValue} value={statusValue}>
                  {statusLabels[statusValue]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex w-full items-end gap-2 sm:w-auto">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="orders-search" className="text-sm text-muted-foreground">
              Buscar cliente
            </Label>
            <Input
              id="orders-search"
              data-testid="orders-search"
              type="search"
              placeholder="Nombre o teléfono..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full sm:w-[260px]"
            />
          </div>
          <Button
            data-testid="orders-refresh"
            type="button"
            variant="outline"
            onClick={refresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 sm:mr-2" />
            )}
            <span className="hidden sm:inline">
              {isRefreshing ? 'Actualizando' : 'Actualizar'}
            </span>
          </Button>
          <Button
            data-testid="orders-search-clear"
            type="button"
            variant="outline"
            onClick={handleClearSearch}
            disabled={!searchInput}
          >
            Limpiar
          </Button>
        </div>
      </div>

      {isRefreshing && (
        <div
          className="flex items-center gap-2 text-sm text-muted-foreground"
          data-testid="orders-refreshing"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          Actualizando pedidos...
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
                  {order.customerPhone && (
                    <p className="text-xs text-muted-foreground">
                      {order.customerPhone}
                    </p>
                  )}
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
