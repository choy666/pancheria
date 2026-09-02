'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePedidoDetail } from './usePedidoDetail';
import { PedidoHeader } from './pedido-header';
import { PedidoInfo } from './pedido-info';
import { PedidoItemsList } from './pedido-items-list';
import { PedidoActions } from './pedido-actions';
import { PedidoChatSection } from './pedido-chat-section';

interface PedidoDetailProps {
  orderId: number;
}

export function PedidoDetail({ orderId }: PedidoDetailProps) {
  const {
    order,
    initialMessages,
    chatTotal,
    chatHasMore,
    chatIsExpired,
    unreadCount,
    loading,
    error,
    payments,
    setPayments,
    isPaymentComplete,
    paymentRemaining,
    cancelReason,
    setCancelReason,
    actionError,
    isSubmitting,
    cashRegister,
    cashRegisterLoading,
    whatsappUrl,
    handleReceive,
    handleConfirm,
    handleFinish,
    handleCancel,
  } = usePedidoDetail(orderId);

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

  return (
    <div className="space-y-5">
      <PedidoHeader orderNumber={order.orderNumber} status={order.status} />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Detalle del pedido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <PedidoInfo order={order} />
            <PedidoItemsList items={order.items} />
          </CardContent>
        </Card>

        {(order.status === 'pending' ||
          order.status === 'in_process' ||
          order.status === 'paid') && (
          <PedidoActions
            status={order.status}
            total={order.total}
            cashRegister={cashRegister}
            payments={payments}
            setPayments={setPayments}
            isPaymentComplete={isPaymentComplete}
            paymentRemaining={paymentRemaining}
            cancelReason={cancelReason}
            setCancelReason={setCancelReason}
            actionError={actionError}
            isSubmitting={isSubmitting}
            whatsappUrl={whatsappUrl}
            onReceive={handleReceive}
            onConfirm={handleConfirm}
            onFinish={handleFinish}
            onCancel={handleCancel}
          />
        )}
      </div>

      <PedidoChatSection
        orderId={order.id}
        status={order.status}
        initialMessages={initialMessages}
        chatTotal={chatTotal}
        chatHasMore={chatHasMore}
        chatIsExpired={chatIsExpired}
        unreadCount={unreadCount}
      />
    </div>
  );
}
