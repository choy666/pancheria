'use client';

import type { OrderStatus } from '@/domain/types';
import { useCallback, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { routes } from '@/config/routes';
import { Search, MessageCircle, ArrowLeft } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { PUBLIC_PEDIDO_SEGUIMIENTO_API } from '@/config/api';
import { ApiError } from '@/lib/fetch';
import { addRecentOrder, buildChatUrl } from '@/lib/recent-orders';
import { formatMoney } from '@/lib/money';
import {
  getLastCustomerName,
  setLastCustomerName,
} from '@/lib/last-customer-name';
import {
  getLastCustomerPhone,
  setLastCustomerPhone,
} from '@/lib/last-customer-phone';

interface TrackedOrder {
  id: number;
  orderNumber: string;
  status: OrderStatus;
  total: number;
  customerName: string;
  customerPhone: string;
  branchId: number;
  branchName: string | null;
  cancellationToken?: string;
  expiresAt?: string;
}

function useLastCustomerNameSnapshot(): string | null {
  const subscribe = useCallback((callback: () => void) => {
    const handle = (event: StorageEvent) => {
      if (event.key === 'pancheria-last-customer-name') callback();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handle);
      return () => window.removeEventListener('storage', handle);
    }
    return () => {};
  }, []);

  const getSnapshot = useCallback(() => getLastCustomerName(), []);

  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

function useLastCustomerPhoneSnapshot(): string | null {
  const subscribe = useCallback((callback: () => void) => {
    const handle = (event: StorageEvent) => {
      if (event.key === 'pancheria-last-customer-phone') callback();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handle);
      return () => window.removeEventListener('storage', handle);
    }
    return () => {};
  }, []);

  const getSnapshot = useCallback(() => getLastCustomerPhone(), []);

  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

export function OrderTracker() {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState('');
  const storedCustomerName = useLastCustomerNameSnapshot();
  const storedCustomerPhone = useLastCustomerPhoneSnapshot();
  const [customerName, setCustomerName] = useState(storedCustomerName ?? '');
  const [customerPhone, setCustomerPhone] = useState(storedCustomerPhone ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<TrackedOrder | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setOrder(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(PUBLIC_PEDIDO_SEGUIMIENTO_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: orderNumber.trim(),
          customerName: customerName.trim() || undefined,
          customerPhone: customerPhone.trim().replace(/\s/g, '') || undefined,
        }),
      });

      const data = (await response.json()) as {
        order?: TrackedOrder;
        error?: string;
      };

      if (!response.ok) {
        throw new ApiError(
          data.error ?? 'Error al buscar el pedido',
          response.status
        );
      }

      if (!data.order) {
        throw new ApiError('No se encontró el pedido.', 404);
      }

      const tracked = data.order;
      setOrder(tracked);
      setLastCustomerName(customerName.trim());
      setLastCustomerPhone(customerPhone.trim());
      if (tracked.customerPhone) {
        setCustomerPhone(tracked.customerPhone);
        setLastCustomerPhone(tracked.customerPhone);
      }

      if (tracked.status === 'pending' && tracked.cancellationToken && tracked.expiresAt) {
        addRecentOrder({
          id: tracked.id,
          orderNumber: tracked.orderNumber,
          cancellationToken: tracked.cancellationToken,
          expiresAt: tracked.expiresAt,
          branchId: tracked.branchId,
          branchName: tracked.branchName ?? 'Sucursal',
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  }

  const statusLabel: Record<OrderStatus, string> = {
    pending: 'Pendiente',
    in_process: 'En proceso',
    paid: 'Pagado',
    finished: 'Finalizado',
    cancelled: 'Cancelado',
  };

  const progressSteps: OrderStatus[] = [
    'pending',
    'in_process',
    'paid',
    'finished',
  ];

  return (
    <div className="mx-auto max-w-xl space-y-6 p-4">
      <Button
        type="button"
        variant="ghost"
        onClick={() => router.push(routes.pedido)}
        className="-ml-4"
      >
        <ArrowLeft className="mr-2 size-4" />
        Volver al catálogo
      </Button>

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Seguimiento de pedido
        </h1>
        <p className="text-sm text-muted-foreground">
          Ingresá el número de pedido y tu nombre o teléfono para consultar el estado.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Buscar pedido</CardTitle>
          <CardDescription>
            Los datos deben coincidir con los que usaste al crear el pedido.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orderNumber">Número de pedido</Label>
              <Input
                id="orderNumber"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="Ej: PED-..."
                required
                aria-describedby="orderNumber-help"
              />
              <p id="orderNumber-help" className="text-xs text-muted-foreground">
                Lo recibiste al confirmar el pedido.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerName">Tu nombre</Label>
              <Input
                id="customerName"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Tu nombre"
                aria-describedby="customerName-help"
              />
              <p
                id="customerName-help"
                className="text-xs text-muted-foreground"
              >
                Completá tu nombre o tu teléfono; alcanza con uno de los dos.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerPhone">Teléfono</Label>
              <Input
                id="customerPhone"
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Ej: 3415555555"
              />
            </div>
            {error && (
              <div className="rounded-lg bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? 'Buscando...' : (
                <>
                  <Search className="mr-2 size-4" />
                  Buscar pedido
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {order && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Pedido #{order.orderNumber}
            </CardTitle>
            <CardDescription>
              {order.branchName ?? 'Sucursal'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {order.status === 'cancelled' ? (
              <p
                data-testid="order-progress"
                className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
              >
                Este pedido fue cancelado.
              </p>
            ) : (
              <ol
                data-testid="order-progress"
                className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs"
              >
                {progressSteps.map((step, index) => {
                  const currentIndex = progressSteps.indexOf(order.status);
                  const isDone = currentIndex > -1 && index < currentIndex;
                  const isCurrent = index === currentIndex;
                  return (
                    <li key={step} className="flex items-center gap-2">
                      {index > 0 && (
                        <span
                          aria-hidden="true"
                          className="text-muted-foreground"
                        >
                          →
                        </span>
                      )}
                      <span
                        aria-current={isCurrent ? 'step' : undefined}
                        className={
                          isCurrent
                            ? 'rounded-full bg-primary/15 px-2 py-0.5 font-medium text-primary'
                            : isDone
                              ? 'text-green-400'
                              : 'text-muted-foreground'
                        }
                      >
                        {statusLabel[step]}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Estado</p>
                <p className="font-medium">{statusLabel[order.status]}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total</p>
                <p className="font-mono font-medium">
                  {formatMoney(order.total)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Cliente</p>
                <p className="font-medium">{order.customerName}</p>
                {order.customerPhone && (
                  <p className="font-mono text-xs">{order.customerPhone}</p>
                )}
              </div>
            </div>

            {order.status !== 'finished' &&
              order.status !== 'cancelled' &&
              order.cancellationToken && (
                <Link
                  href={buildChatUrl(order.id, order.cancellationToken)}
                  className={cn(buttonVariants(), 'w-full')}
                >
                  <MessageCircle className="mr-2 size-4" />
                  Ir al chat del pedido
                </Link>
              )}

            {(order.status === 'finished' || order.status === 'cancelled') && (
              <p className="text-sm text-muted-foreground">
                Este pedido ya fue {order.status === 'finished' ? 'finalizado' : 'cancelado'} y el chat está cerrado.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
