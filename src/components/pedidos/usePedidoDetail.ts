'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { nanoid } from 'nanoid';
import { authenticatedFetch } from '@/lib/fetch';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { formatMoney } from '@/lib/money';
import {
  PEDIDOS_CONFIRMAR_API,
  PEDIDOS_RECIBIR_API,
  PEDIDOS_FINALIZAR_API,
  PEDIDOS_CANCELAR_API,
} from '@/config/api';
import { useCashRegister } from '@/hooks/useCashRegister';
import { usePaymentParts } from '@/hooks/usePaymentParts';
import type { CashRegister } from '@/config/caja';
import type { OrderStatus, DeliveryType, PaymentPart, OrderMessage, RecipeItemConfig } from '@/domain/types';

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
  recipeSnapshot?: RecipeItemConfig[];
}

interface OrderDetail {
  id: number;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryType: DeliveryType;
  address: string | null;
  notes: string | null;
  total: number;
  status: OrderStatus;
  convertedSaleId: number | null;
  createdAt: string;
  branch: { name: string } | null;
  items: OrderDetailItem[];
}

export interface UsePedidoDetailResult {
  order: OrderDetail | null;
  initialMessages: OrderMessage[];
  chatTotal: number | undefined;
  chatHasMore: boolean | undefined;
  chatIsExpired: boolean | undefined;
  unreadCount: number;
  loading: boolean;
  error: string | null;
  payments: PaymentPart[];
  setPayments: (value: PaymentPart[]) => void;
  isPaymentComplete: boolean;
  paymentRemaining: number;
  cancelReason: string;
  setCancelReason: (value: string) => void;
  actionError: string | null;
  isSubmitting: boolean;
  cashRegister: CashRegister | null;
  cashRegisterLoading: boolean;
  whatsappUrl: string | null;
  loadOrder: () => Promise<void>;
  handleReceive: () => Promise<void>;
  handleConfirm: () => Promise<void>;
  handleFinish: () => Promise<void>;
  handleCancel: () => Promise<void>;
}

export function usePedidoDetail(orderId: number): UsePedidoDetailResult {
  const router = useRouter();
  const isMountedRef = useRef(true);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [initialMessages, setInitialMessages] = useState<OrderMessage[]>([]);
  const [chatTotal, setChatTotal] = useState<number | undefined>(undefined);
  const [chatHasMore, setChatHasMore] = useState<boolean | undefined>(undefined);
  const [chatIsExpired, setChatIsExpired] = useState<boolean | undefined>(undefined);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const orderTotal = order?.total ?? 0;
  const {
    paymentParts,
    setPayments: setPaymentOverrides,
    remaining,
    isComplete,
  } = usePaymentParts(orderTotal, {
    defaultMethod: 'cash',
    fallbackOnInvalid: false,
  });
  const [cancelReason, setCancelReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    cashRegister,
    refresh: refreshCashRegister,
    loading: cashRegisterLoading,
  } = useCashRegister();

  const whatsappUrl = useMemo(() => {
    if (!order) return null;

    try {
      return buildWhatsAppUrl({
        items: order.items.map((item) => ({
          productId: item.productId,
          name: item.product?.name ?? `Producto ${item.productId}`,
          price: item.unitPrice,
          unit: item.product?.unit ?? 'unidad',
          quantity: item.quantity,
        })),
        customerName: order.customerName,
        customerPhone: order.customerPhone ?? undefined,
        deliveryType: order.deliveryType,
        address: order.address ?? undefined,
        notes: order.notes ?? undefined,
        total: order.total,
        orderNumber: order.orderNumber,
        branchName: order.branch?.name,
      });
    } catch {
      return null;
    }
  }, [order]);

  const loadOrder = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [orderResponse, messagesResponse] = await Promise.all([
        authenticatedFetch(`/api/pedidos/${orderId}`),
        authenticatedFetch(`/api/pedidos/${orderId}/chat`),
      ]);

      if (!orderResponse.ok) {
        const data = (await orderResponse.json()) as { error?: string };
        throw new Error(data.error || 'Error al cargar el pedido');
      }

      const data = (await orderResponse.json()) as {
        order: OrderDetail & { unreadCount?: number };
      };

      if (!isMountedRef.current) return;
      setOrder(data.order);

      if (messagesResponse.ok) {
        const messagesData = (await messagesResponse.json()) as {
          messages: OrderMessage[];
          total: number;
          hasMore: boolean;
          isExpired: boolean;
        };
        if (isMountedRef.current) {
          setInitialMessages(messagesData.messages);
          setChatTotal(messagesData.total);
          setChatHasMore(messagesData.hasMore);
          setChatIsExpired(messagesData.isExpired);
          setUnreadCount(data.order.unreadCount ?? 0);
        }
      }
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

  async function handleReceive() {
    setActionError(null);
    setIsSubmitting(true);

    try {
      const response = await authenticatedFetch(PEDIDOS_RECIBIR_API(orderId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Error al recibir el pedido');
      }

      await loadOrder();
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirm() {
    setActionError(null);

    if (!order) {
      setActionError('El pedido no está cargado.');
      return;
    }

    if (!isComplete) {
      setActionError(
        `El pago no cubre el total. ${
          remaining > 0
            ? `Faltan ${formatMoney(remaining)}.`
            : `Sobran ${formatMoney(Math.abs(remaining))}.`
        }`
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await authenticatedFetch(
        PEDIDOS_CONFIRMAR_API(orderId),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payments: paymentParts,
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

  async function handleFinish() {
    setActionError(null);
    setIsSubmitting(true);

    try {
      const response = await authenticatedFetch(
        PEDIDOS_FINALIZAR_API(orderId),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Error al finalizar el pedido');
      }

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

  return {
    order,
    initialMessages,
    chatTotal,
    chatHasMore,
    chatIsExpired,
    unreadCount,
    loading,
    error,
    payments: paymentParts,
    setPayments: setPaymentOverrides,
    isPaymentComplete: isComplete,
    paymentRemaining: remaining,
    cancelReason,
    setCancelReason,
    actionError,
    isSubmitting,
    cashRegister,
    cashRegisterLoading,
    whatsappUrl,
    loadOrder,
    handleReceive,
    handleConfirm,
    handleFinish,
    handleCancel,
  };
}
