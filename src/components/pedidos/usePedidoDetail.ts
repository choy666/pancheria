'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authenticatedFetch, throwApiError } from '@/lib/fetch';
import { formatMoney } from '@/lib/money';
import {
  PEDIDOS_CONFIRMAR_API,
  PEDIDOS_RECIBIR_API,
  PEDIDOS_FINALIZAR_API,
  PEDIDOS_CANCELAR_API,
} from '@/config/api';
import { useCashRegister } from '@/hooks/useCashRegister';
import { usePaymentParts } from '@/hooks/usePaymentParts';
import {
  orderConfirmationSignature,
  useSubmitIdempotencyKey,
} from '@/hooks/use-submit-idempotency-key';
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
  branch: { name: string; location?: string | null } | null;
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
    setPayments,
    remaining,
    isComplete,
  } = usePaymentParts(orderTotal, {
    defaultMethod: 'cash',
    fallbackOnInvalid: false,
  });
  const [cancelReason, setCancelReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // La clave de confirmación se conserva entre reintentos del mismo
  // pedido (QA-02): si la venta se creó pero la respuesta se perdió, el
  // reintento deduplica en el servidor. Rota solo tras el éxito o si
  // cambia el pedido confirmado. Los pagos no forman parte de la firma.
  const confirmKey = useSubmitIdempotencyKey();

  const {
    cashRegister,
    refresh: refreshCashRegister,
    loading: cashRegisterLoading,
  } = useCashRegister();

  const loadOrder = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [orderResponse, messagesResponse] = await Promise.all([
        authenticatedFetch(`/api/pedidos/${orderId}`),
        authenticatedFetch(`/api/pedidos/${orderId}/chat`),
      ]);

      if (!orderResponse.ok) {
        await throwApiError(orderResponse, 'Error al cargar el pedido');
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
        await throwApiError(response, 'Error al recibir el pedido');
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
      const confirmPayments = paymentParts.filter((part) => part.amount > 0);
      const response = await authenticatedFetch(
        PEDIDOS_CONFIRMAR_API(orderId),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payments: confirmPayments,
            idempotencyKey: confirmKey.resolve(
              orderConfirmationSignature(order.id, confirmPayments)
            ),
          }),
        }
      );

      if (!response.ok) {
        await throwApiError(response, 'Error al confirmar el pedido');
      }

      const data = (await response.json()) as {
        sale: unknown;
        deduplicated?: boolean;
      };
      confirmKey.reset();
      await refreshCashRegister();
      await loadOrder();
      router.refresh();
      if (data.deduplicated) {
        setActionError(
          'El pedido ya estaba confirmado como venta; se recuperó la venta registrada originalmente.'
        );
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error desconocido');
      // El estado mostrado puede estar stale (p.ej. un 409 por pedido
      // vencido que ya quedó cancelado): se recarga el detalle.
      await loadOrder();
      router.refresh();
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
        await throwApiError(response, 'Error al finalizar el pedido');
      }

      await loadOrder();
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error desconocido');
      await loadOrder();
      router.refresh();
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
        await throwApiError(response, 'Error al cancelar el pedido');
      }

      await loadOrder();
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error desconocido');
      await loadOrder();
      router.refresh();
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
    setPayments,
    isPaymentComplete: isComplete,
    paymentRemaining: remaining,
    cancelReason,
    setCancelReason,
    actionError,
    isSubmitting,
    cashRegister,
    cashRegisterLoading,
    loadOrder,
    handleReceive,
    handleConfirm,
    handleFinish,
    handleCancel,
  };
}
