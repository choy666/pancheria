import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import * as brandService from '@/application/services/brandService';
import * as branchService from '@/application/services/branchService';
import * as chatService from '@/application/services/chatService';
import { OrderChat } from '@/components/chat/order-chat';
import {
  BranchPhones,
  BranchSocialLinks,
} from '@/components/pedido/branch-contact';
import { PublicFooter } from '@/components/publico/public-footer';
import { PublicHeader } from '@/components/publico/public-header';
import {
  PUBLIC_PEDIDO_CHAT_API,
  PUBLIC_PEDIDO_CHAT_LEIDO_API,
  PUBLIC_PEDIDO_CHAT_UPLOAD_API,
  PUBLIC_PEDIDO_CHAT_STREAM_API,
} from '@/config/api';
import { getChatStreamEnabled } from '@/config/chat';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

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

  const [brand, found] = await Promise.all([
    brandService.getBrand(),
    branchService.getBranchById(context.branchId),
  ]);
  const branch = found?.isActive ? found : undefined;

  return (
    <>
      <PublicHeader
        brand={brand}
        branchId={context.branchId}
        branchName={context.branchName}
      />
      <main className="flex-1 p-4 md:p-6 lg:p-8">
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
      </main>
      <PublicFooter brand={brand} branch={branch} />
    </>
  );
}

export const dynamic = 'force-dynamic';
