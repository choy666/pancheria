/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { ChatMessageList } from './chat-message-list';
import { formatTime } from '@/lib/date';
import type { OrderMessage } from '@/domain/types';

function buildMessage(overrides: Partial<OrderMessage> = {}): OrderMessage {
  return {
    id: 1,
    orderId: 1,
    senderType: 'client',
    senderName: null,
    content: 'Hola',
    attachmentUrl: null,
    attachmentKey: null,
    attachmentMimeType: null,
    attachmentSize: null,
    attachmentName: null,
    deliveredAt: null,
    readAt: null,
    createdAt: new Date('2026-01-01T12:34:00.000Z'),
    ...overrides,
  };
}

describe('ChatMessageList', () => {
  test('renderiza el estado enviado en mensajes propios', () => {
    render(
      <ChatMessageList
        scrollRef={{ current: null }}
        messages={[buildMessage({ senderType: 'client' })]}
        hasMore={false}
        isLoadingOlder={false}
        onLoadOlder={() => {}}
        isOwnMessage={(sender) => sender === 'client'}
        title="Chat"
        displayedUnreadCount={0}
        isPolling={false}
      />
    );

    expect(screen.getByTestId('message-status-sent')).toBeInTheDocument();
    expect(screen.queryByTestId('message-status-delivered')).not.toBeInTheDocument();
    expect(screen.queryByTestId('message-status-read')).not.toBeInTheDocument();
  });

  test('renderiza el estado entregado en mensajes propios', () => {
    render(
      <ChatMessageList
        scrollRef={{ current: null }}
        messages={[
          buildMessage({
            senderType: 'client',
            deliveredAt: new Date(),
          }),
        ]}
        hasMore={false}
        isLoadingOlder={false}
        onLoadOlder={() => {}}
        isOwnMessage={(sender) => sender === 'client'}
        title="Chat"
        displayedUnreadCount={0}
        isPolling={false}
      />
    );

    expect(screen.getByTestId('message-status-delivered')).toBeInTheDocument();
    expect(screen.queryByTestId('message-status-sent')).not.toBeInTheDocument();
    expect(screen.queryByTestId('message-status-read')).not.toBeInTheDocument();
  });

  test('renderiza el estado leído en mensajes propios', () => {
    render(
      <ChatMessageList
        scrollRef={{ current: null }}
        messages={[
          buildMessage({
            senderType: 'client',
            deliveredAt: new Date(),
            readAt: new Date(),
          }),
        ]}
        hasMore={false}
        isLoadingOlder={false}
        onLoadOlder={() => {}}
        isOwnMessage={(sender) => sender === 'client'}
        title="Chat"
        displayedUnreadCount={0}
        isPolling={false}
      />
    );

    expect(screen.getByTestId('message-status-read')).toBeInTheDocument();
    expect(screen.queryByTestId('message-status-sent')).not.toBeInTheDocument();
    expect(screen.queryByTestId('message-status-delivered')).not.toBeInTheDocument();
  });

  test('no renderiza estado en mensajes ajenos', () => {
    render(
      <ChatMessageList
        scrollRef={{ current: null }}
        messages={[
          buildMessage({
            senderType: 'operator',
            deliveredAt: new Date(),
            readAt: new Date(),
          }),
        ]}
        hasMore={false}
        isLoadingOlder={false}
        onLoadOlder={() => {}}
        isOwnMessage={(sender) => sender === 'client'}
        title="Chat"
        displayedUnreadCount={0}
        isPolling={false}
      />
    );

    expect(screen.queryByTestId('message-status-sent')).not.toBeInTheDocument();
    expect(screen.queryByTestId('message-status-delivered')).not.toBeInTheDocument();
    expect(screen.queryByTestId('message-status-read')).not.toBeInTheDocument();
  });

  test('muestra la hora de envío', () => {
    const message = buildMessage();
    render(
      <ChatMessageList
        scrollRef={{ current: null }}
        messages={[message]}
        hasMore={false}
        isLoadingOlder={false}
        onLoadOlder={() => {}}
        isOwnMessage={() => true}
        title="Chat"
        displayedUnreadCount={0}
        isPolling={false}
      />
    );

    const formatted = formatTime(message.createdAt);
    expect(screen.getByText(formatted)).toBeInTheDocument();
  });
});
