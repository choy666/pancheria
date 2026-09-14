import { notFound } from 'next/navigation';
import * as chatService from '@/application/services/chatService';
import { OrderChat } from '@/components/chat/order-chat';
import {
  getSocialLinkHref,
  getSocialNetworkLabel,
} from '@/lib/branch-helpers';
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
        {context.branchPhones.map((phone, index) => (
          <p key={`phone-${index}`} className="text-sm text-muted-foreground">
            {phone.label}: {phone.number}
          </p>
        ))}
        {context.branchSocialLinks.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {context.branchSocialLinks.map((link, index) => {
              const href = getSocialLinkHref(link);
              const label = getSocialNetworkLabel(link.network);
              return (
                <span key={`${link.network}-${index}`}>
                  {index > 0 && ' · '}
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {label}
                    </a>
                  ) : (
                    `${label}: ${link.url}`
                  )}
                </span>
              );
            })}
          </p>
        )}
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
        title="Chat del pedido"
      />
    </div>
  );
}

export const dynamic = 'force-dynamic';
