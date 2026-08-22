'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { MessageCircle, X } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { PUBLIC_PEDIDO_ESTADO_API } from '@/config/api';
import { buildChatUrl, type RecentOrder } from '@/lib/recent-orders';

interface RecentOrdersBannerProps {
  orders: RecentOrder[];
  onDismiss: (orderId: number) => void;
}

interface OrderStatusResult {
  status: string;
  expiresAt: string;
  isExpired: boolean;
}

export function RecentOrdersBanner({
  orders,
  onDismiss,
}: RecentOrdersBannerProps) {
  const checkedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (orders.length === 0) return;

    const pending = orders.filter((order) => !checkedRef.current.has(order.id));
    if (pending.length === 0) return;

    for (const order of pending) {
      checkedRef.current.add(order.id);
    }

    void Promise.all(
      pending.map(async (order) => {
        try {
          const response = await fetch(
            `${PUBLIC_PEDIDO_ESTADO_API(order.id)}?token=${encodeURIComponent(
              order.cancellationToken
            )}`
          );

          if (!response.ok) {
            if (response.status === 404) {
              onDismiss(order.id);
            }
            return;
          }

          const data = (await response.json()) as OrderStatusResult;
          if (data.status !== 'pending' || data.isExpired) {
            onDismiss(order.id);
          }
        } catch {
          // Errores de red no deben ocultar pedidos sin confirmar.
        }
      })
    );
  }, [orders, onDismiss]);

  if (orders.length === 0) return null;

  return (
    <Card
      className="border-primary/20 bg-primary/5"
      data-testid="recent-orders-banner"
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          {orders.length === 1 ? 'Pedido reciente' : 'Pedidos recientes'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {orders.map((order) => (
          <div
            key={order.id}
            className="flex flex-col gap-2 rounded-lg border border-white/8 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium">Pedido #{order.orderNumber}</p>
              <p className="text-sm text-muted-foreground">
                {order.branchName}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={buildChatUrl(order.id, order.cancellationToken)}
                className={cn(
                  buttonVariants({ size: 'sm' }),
                  'flex-1 sm:flex-none'
                )}
              >
                <MessageCircle className="mr-2 size-4" />
                Ir al chat
              </Link>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label={`Ocultar recordatorio del pedido ${order.orderNumber}`}
                onClick={() => onDismiss(order.id)}
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
