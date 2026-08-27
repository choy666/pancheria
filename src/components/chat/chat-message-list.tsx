import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, CheckCheck } from 'lucide-react';
import { ChatAttachment } from './chat-attachment';
import { formatTime } from '@/lib/date';
import type { OrderMessage, OrderMessageSenderType } from '@/domain/types';

interface ChatMessageListProps {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  messages: OrderMessage[];
  hasMore: boolean;
  isLoadingOlder: boolean;
  onLoadOlder: () => void;
  isOwnMessage: (senderType: OrderMessageSenderType) => boolean;
  token?: string;
  title: string;
  displayedUnreadCount: number;
  isPolling: boolean;
}

function MessageStatusIcon({
  deliveredAt,
  readAt,
}: {
  deliveredAt: Date | null;
  readAt: Date | null;
}) {
  if (readAt) {
    return (
      <span
        data-testid="message-status-read"
        className="inline-flex"
        title={`Leído ${formatTime(readAt)}`}
        aria-label="Leído"
      >
        <CheckCheck className="size-3 shrink-0 text-blue-400" />
      </span>
    );
  }

  if (deliveredAt) {
    return (
      <span
        data-testid="message-status-delivered"
        className="inline-flex"
        title={`Entregado ${formatTime(deliveredAt)}`}
        aria-label="Entregado"
      >
        <CheckCheck className="size-3 shrink-0 opacity-70" />
      </span>
    );
  }

  return (
    <span
      data-testid="message-status-sent"
      className="inline-flex"
      title="Enviado"
      aria-label="Enviado"
    >
      <Check className="size-3 shrink-0 opacity-70" />
    </span>
  );
}

export function ChatMessageList({
  scrollRef,
  messages,
  hasMore,
  isLoadingOlder,
  onLoadOlder,
  isOwnMessage,
  token,
  title,
  displayedUnreadCount,
  isPolling,
}: ChatMessageListProps) {
  return (
    <>
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">{title}</h3>
          {displayedUnreadCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {displayedUnreadCount}
            </Badge>
          )}
          {isPolling && (
            <span className="text-xs text-muted-foreground">Sincronizando...</span>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto p-4"
      >
        {hasMore && (
          <div className="flex justify-center py-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void onLoadOlder()}
              disabled={isLoadingOlder}
            >
              {isLoadingOlder ? 'Cargando...' : 'Cargar mensajes anteriores'}
            </Button>
          </div>
        )}

        {messages.map((message) => {
          const own = isOwnMessage(message.senderType);

          return (
            <div
              key={message.id}
              data-testid="chat-message"
              data-sender-type={message.senderType}
              className={`flex ${own ? 'justify-end' : 'justify-start'}`}
            >
              <div
                data-testid="chat-message-bubble"
                data-sender-type={message.senderType}
                className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                  own
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                {message.senderName && (
                  <p className="mb-1 text-xs opacity-80">{message.senderName}</p>
                )}
                {message.content && (
                  <p data-testid="chat-message-text" className="whitespace-pre-wrap text-sm">
                    {message.content}
                  </p>
                )}
                {message.attachmentUrl && (
                  <ChatAttachment message={message} token={token} />
                )}
                <div
                  className={`mt-1 flex items-center justify-end gap-1 text-xs ${
                    own
                      ? 'text-primary-foreground/70'
                      : 'text-muted-foreground'
                  }`}
                >
                  <span title={`Enviado ${formatTime(message.createdAt)}`}>
                    {formatTime(message.createdAt)}
                  </span>
                  {own && (
                    <MessageStatusIcon
                      deliveredAt={message.deliveredAt}
                      readAt={message.readAt}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            Todavía no hay mensajes. Empezá la conversación.
          </p>
        )}
      </div>
    </>
  );
}
