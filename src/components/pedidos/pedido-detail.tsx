'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { nanoid } from 'nanoid';
import { authenticatedFetch } from '@/lib/fetch';
import { formatDateTime } from '@/lib/date';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { PEDIDOS_CONFIRMAR_API, PEDIDOS_CANCELAR_API } from '@/config/api';
import { useCashRegister } from '@/hooks/useCashRegister';
import type { OrderStatus, DeliveryType, PaymentMethod } from '@/domain/types';

interface OrderDetailItem {
  id: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  product?: {
    name: string;
    unit: string;
  } | null;
}

interface OrderDetail {
  id: number;
  orderNumber: string;
  customerName: string;
  deliveryType: DeliveryType;
  address: string | null;
  notes: string | null;
  total: number;
  status: OrderStatus;
  convertedSaleId: number | null;
  createdAt: string;
  items: OrderDetailItem[];
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
  delivery: 'Envío a domicilio',
  pickup: 'Retiro en sucursal',
};

interface PedidoDetailProps {
  orderId: number;
}

export function PedidoDetail({ orderId }: PedidoDetailProps) {
  const router = useRouter();
  const isMountedRef = useRef(true);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cancelReason, setCancelReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { cashRegister, refresh: refreshCashRegister, loading: cashRegisterLoading } =
    useCashRegister();

  const loadOrder = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await authenticatedFetch(`/api/pedidos/${orderId}`);

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Error al cargar el pedido');
      }

      const data = (await response.json()) as { order: OrderDetail };
      if (!isMountedRef.current) return;
      setOrder(data.order);
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    isMountedRef.current = true;
    queueMicrotask(() => void loadOrder());

    return () => {
      isMountedRef.current = false;
    };
  }, [loadOrder]);

  async function handleConfirm() {
    setActionError(null);
    setIsSubmitting(true);

    try {
      const response = await authenticatedFetch(
        PEDIDOS_CONFIRMAR_API(orderId),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentMethod,
            idempotencyKey: nanoid(),
          }),
        }
      );

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Error al confirmar el pedido');
      }

      await refreshCashRegister();
      await loadOrder();
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCancel() {
    if (!cancelReason.trim()) {
      setActionError('El motivo de cancelación es obligatorio.');
      return;
    }

    setActionError(null);
    setIsSubmitting(true);

    try {
      const response = await authenticatedFetch(
        PEDIDOS_CANCELAR_API(orderId),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reason: cancelReason.trim(),
          }),
        }
      );

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Error al cancelar el pedido');
      }

      await loadOrder();
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading || cashRegisterLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="rounded-lg bg-destructive/15 p-4 text-base text-destructive">
        {error || 'Pedido no encontrado.'}
      </div>
    );
  }

  const canConfirm = order.status === 'pending' && !!cashRegister;
  const canCancel = order.status === 'pending';

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            Pedido #{order.orderNumber}
          </h1>
          <Badge variant={statusVariants[order.status]}>
            {statusLabels[order.status]}
          </Badge>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Detalle del pedido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Cliente</p>
                <p className="text-base font-medium">{order.customerName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Entrega</p>
                <p className="text-base font-medium">
                  {deliveryLabels[order.deliveryType]}
                </p>
              </div>
              {order.address && (
                <div className="sm:col-span-2">
                  <p className="text-sm text-muted-foreground">Dirección</p>
                  <p className="text-base">{order.address}</p>
                </div>
              )}
              {order.notes && (
                <div className="sm:col-span-2">
                  <p className="text-sm text-muted-foreground">Notas</p>
                  <p className="text-base">{order.notes}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Creado</p>
                <p className="text-base">{formatDateTime(order.createdAt)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="font-mono text-lg font-bold">
                  ${order.total.toFixed(2)}
                </p>
              </div>
              {order.convertedSaleId && (
                <div className="sm:col-span-2">
                  <p className="text-sm text-muted-foreground">Venta asociada</p>
                  <p className="text-base">#{order.convertedSaleId}</p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/8">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/8 text-left text-muted-foreground">
                    <th className="p-3">Producto</th>
                    <th className="p-3 text-right">Cantidad</th>
                    <th className="p-3 text-right">Precio unitario</th>
                    <th className="p-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id} className="border-b border-white/8 last:border-0">
                      <td className="p-3">
                        {item.product?.name ?? `Producto ${item.productId}`}
                      </td>
                      <td className="p-3 text-right">{item.quantity}</td>
                      <td className="p-3 text-right">
                        ${item.unitPrice.toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-mono">
                        ${item.subtotal.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          {order.status === 'pending' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Acciones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {actionError && (
                  <div className="rounded-lg bg-destructive/15 p-3 text-sm text-destructive">
                    {actionError}
                  </div>
                )}

                {!cashRegister && (
                  <div className="rounded-lg bg-amber-500/15 p-3 text-sm text-amber-500">
                    No hay una caja abierta. Abrí la caja para confirmar el pedido.
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="paymentMethod">Medio de pago</Label>
                  <Select
                    value={paymentMethod}
                    onValueChange={(value) =>
                      setPaymentMethod(value as PaymentMethod)
                    }
                    disabled={!canConfirm || isSubmitting}
                  >
                    <SelectTrigger id="paymentMethod">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Efectivo</SelectItem>
                      <SelectItem value="transfer">Transferencia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  className="w-full"
                  onClick={handleConfirm}
                  disabled={!canConfirm || isSubmitting}
                >
                  {isSubmitting ? 'Confirmando...' : 'Confirmar como venta'}
                </Button>

                <div className="space-y-2">
                  <Label htmlFor="cancelReason">Motivo de cancelación</Label>
                  <Textarea
                    id="cancelReason"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Motivo de la cancelación"
                    disabled={!canCancel || isSubmitting}
                  />
                </div>

                <Button
                  className="w-full"
                  variant="destructive"
                  onClick={handleCancel}
                  disabled={!canCancel || isSubmitting}
                >
                  {isSubmitting ? 'Cancelando...' : 'Cancelar pedido'}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
