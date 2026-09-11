import { OrderChat } from '@/components/chat/order-chat';
import {
  PEDIDOS_CHAT_API,
  PEDIDOS_CHAT_UBICACION_API,
  PEDIDOS_CHAT_LEIDO_API,
  PEDIDOS_CHAT_UPLOAD_API,
} from '@/config/api';
import type { DeliveryType, OrderMessage, OrderStatus } from '@/domain/types';

interface PedidoChatSectionProps {
  orderId: number;
  status: OrderStatus;
  deliveryType: DeliveryType;
  branchLocation: string | null;
  initialMessages: OrderMessage[];
  chatTotal?: number;
  chatHasMore?: boolean;
  chatIsExpired?: boolean;
  unreadCount: number;
}

export function PedidoChatSection({
  orderId,
  status,
  deliveryType,
  branchLocation,
  initialMessages,
  chatTotal,
  chatHasMore,
  chatIsExpired,
  unreadCount,
}: PedidoChatSectionProps) {
  return (
    <div data-tour="pedidos-chat">
      <OrderChat
        orderId={orderId}
        initialMessages={initialMessages}
        initialTotal={chatTotal}
        initialHasMore={chatHasMore}
        initialIsExpired={chatIsExpired}
        readOnly={status === 'finished' || status === 'cancelled'}
        deliveryType={deliveryType}
        branchLocation={branchLocation}
        chatApiUrl={PEDIDOS_CHAT_API(orderId)}
        branchLocationApiUrl={PEDIDOS_CHAT_UBICACION_API(orderId)}
        readApiUrl={PEDIDOS_CHAT_LEIDO_API(orderId)}
        uploadApiUrl={PEDIDOS_CHAT_UPLOAD_API(orderId)}
        unreadCount={unreadCount}
        title="Chat con el cliente"
      />
    </div>
  );
}
