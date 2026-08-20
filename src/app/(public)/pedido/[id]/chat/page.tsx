import { notFound } from 'next/navigation';
import * as chatService from '@/application/services/chatService';
import { OrderChat } from '@/components/chat/order-chat';
import {
  PUBLIC_PEDIDO_CHAT_API,
  PUBLIC_PEDIDO_CHAT_LEIDO_API,
  PUBLIC_PEDIDO_CHAT_UPLOAD_API,
} from '@/config/api';

interface ChatPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function PedidoChatPage({
  params,
  searchParams,
}: ChatPageProps) {
  const { id } = await params;
  const { token } = await searchParams;

  const orderId = Number(id);
  if (Number.isNaN(orderId) || orderId <= 0 || !token) {
    notFound();
  }

  let context;
  try {
    context = await chatService.getChatContext(orderId, token);
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Pedido #{context.orderNumber}
        </h1>
        <p className="text-sm text-muted-foreground">
          {context.branchName ? `Sucursal: ${context.branchName}` : 'Chat con la sucursal'}
        </p>
      </div>

      <OrderChat
        orderId={orderId}
        token={token}
        initialMessages={context.messages}
        readOnly={context.status !== 'pending'}
        isClient
        chatApiUrl={PUBLIC_PEDIDO_CHAT_API(orderId)}
        readApiUrl={PUBLIC_PEDIDO_CHAT_LEIDO_API(orderId)}
        uploadApiUrl={PUBLIC_PEDIDO_CHAT_UPLOAD_API(orderId)}
        title="Chat del pedido"
      />
    </div>
  );
}
