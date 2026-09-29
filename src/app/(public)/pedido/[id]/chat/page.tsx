import { notFound } from 'next/navigation';
import * as chatService from '@/application/services/chatService';
import { OrderChat } from '@/components/chat/order-chat';
import {
  BranchPhones,
  BranchSocialLinks,
} from '@/components/pedido/branch-contact';
import {
  PUBLIC_PEDIDO_CHAT_API,
  PUBLIC_PEDIDO_CHAT_LEIDO_API,
  PUBLIC_PEDIDO_CHAT_UPLOAD_API,
  PUBLIC_PEDIDO_CHAT_STREAM_API,
} from '@/config/api';
import { getChatStreamEnabled } from '@/config/chat';

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
        <BranchPhones
          phones={context.branchPhones}
          className="text-sm text-muted-foreground"
        />
        <BranchSocialLinks
          links={context.branchSocialLinks}
          className="text-sm text-muted-foreground"
        />
      </div>

      <OrderChat
        orderId={orderId}
        token={token}
        initialMessages={context.messages}
        initialTotal={context.total}
        initialHasMore={context.hasMore}
        initialIsExpired={context.isExpired}
        readOnly={context.status === 'finished' || context.status === 'cancelled'}
        isClient
        deliveryType={context.deliveryType}
        branchLocation={context.branchLocation}
        chatApiUrl={PUBLIC_PEDIDO_CHAT_API(orderId)}
        readApiUrl={PUBLIC_PEDIDO_CHAT_LEIDO_API(orderId)}
        uploadApiUrl={PUBLIC_PEDIDO_CHAT_UPLOAD_API(orderId)}
        streamApiUrl={
          getChatStreamEnabled()
            ? PUBLIC_PEDIDO_CHAT_STREAM_API(orderId)
            : undefined
        }
        title="Chat del pedido"
      />
    </div>
  );
}

export const dynamic = 'force-dynamic';
