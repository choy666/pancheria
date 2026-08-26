import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

        {messages.map((message) => (
          <div
            key={message.id}
            data-testid="chat-message"
            data-sender-type={message.senderType}
            className={`flex ${
              isOwnMessage(message.senderType) ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              data-testid="chat-message-bubble"
              data-sender-type={message.senderType}
              className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                isOwnMessage(message.senderType)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              }`}
            >
              {message.senderName && (
                <p className="mb-1 text-xs opacity-80">{message.senderName}</p>
              )}
              {message.content && (
                <p data-testid="chat-message-text" className="whitespace-pre-wrap text-sm">{message.content}</p>
              )}
              {message.attachmentUrl && (
                <ChatAttachment message={message} token={token} />
              )}
              <p
                className={`mt-1 text-right text-xs ${
                  isOwnMessage(message.senderType)
                    ? 'text-primary-foreground/70'
                    : 'text-muted-foreground'
                }`}
              >
                {formatTime(message.createdAt)}
              </p>
            </div>
          </div>
        ))}

        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            Todavía no hay mensajes. Empezá la conversación.
          </p>
        )}
      </div>
    </>
  );
}
