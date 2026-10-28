'use client';

import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { useRecentOrders } from '@/hooks/useRecentOrders';
import { buildChatUrl } from '@/lib/recent-orders';

interface RecentOrderChatLinkProps {
  className: string;
}

/**
 * Atajo al chat del pedido más reciente del dispositivo. Vive en un componente
 * cliente porque los pedidos recientes están en localStorage: el servidor
 * renderiza sin el enlace y el cliente lo agrega tras hidratar.
 */
export function RecentOrderChatLink({ className }: RecentOrderChatLinkProps) {
  const { orders } = useRecentOrders();
  const latest = orders[0];

  if (!latest) return null;

  return (
    <Link
      href={buildChatUrl(latest.id, latest.cancellationToken)}
      className={className}
      data-testid="header-chat-link"
    >
      <MessageCircle className="size-5 sm:size-4" aria-hidden="true" />
      <span className="sr-only sm:not-sr-only">Chat del pedido</span>
    </Link>
  );
}
