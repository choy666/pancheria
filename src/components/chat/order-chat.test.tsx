/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { OrderChat } from './order-chat';

jest.mock('@/lib/fetch', () => ({
  authenticatedFetch: jest.fn(),
}));

jest.mock('@/config/chat', () => ({
  getChatRefreshIntervalMs: jest.fn().mockReturnValue(100),
  getChatMaxTextLength: jest.fn().mockReturnValue(1000),
  getChatPageSize: jest.fn().mockReturnValue(50),
}));

const mockFetch = jest.fn();

describe('OrderChat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  function buildMessage(
    id: number,
    senderType: 'client' | 'operator' = 'client',
    content = 'Hola'
  ) {
    return {
      id,
      orderId: 1,
      senderType,
      senderName: null,
      content,
      readAt: null,
      createdAt: new Date(),
      attachmentUrl: null,
      attachmentKey: null,
      attachmentMimeType: null,
      attachmentSize: null,
      attachmentName: null,
    };
  }

  test('renderiza los mensajes iniciales', () => {
    render(
      <OrderChat
        orderId={1}
        initialMessages={[
          buildMessage(1, 'client', 'Hola'),
          buildMessage(2, 'operator', 'Adiós'),
        ]}
        initialTotal={2}
        initialHasMore={false}
        disablePollingOnMount
        isClient
        chatApiUrl="/api/public/pedido/1/chat"
      />
    );

    expect(screen.getByText('Hola')).toBeInTheDocument();
    expect(screen.getByText('Adiós')).toBeInTheDocument();
  });

  test('muestra el botón de cargar anteriores cuando hay más mensajes', () => {
    render(
      <OrderChat
        orderId={1}
        initialMessages={[buildMessage(50, 'client', 'Último')]}
        initialTotal={100}
        initialHasMore={true}
        disablePollingOnMount
        isClient
        chatApiUrl="/api/public/pedido/1/chat"
      />
    );

    expect(screen.getByText('Cargar mensajes anteriores')).toBeInTheDocument();
  });

  test('carga mensajes anteriores al hacer clic', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        messages: [buildMessage(49, 'client', 'Anterior')],
        status: 'pending',
        total: 100,
        hasMore: true,
        isExpired: false,
      }),
    });

    render(
      <OrderChat
        orderId={1}
        token="token"
        initialMessages={[buildMessage(50, 'client', 'Último')]}
        initialTotal={100}
        initialHasMore={true}
        disablePollingOnMount
        isClient
        chatApiUrl="/api/public/pedido/1/chat"
      />
    );

    fireEvent.click(screen.getByText('Cargar mensajes anteriores'));

    await waitFor(() => {
      expect(screen.getByText('Anterior')).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('before=50')
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('token=token')
    );
  });

  test('deshabilita el envío cuando el pedido expiró aunque siga pending', () => {
    render(
      <OrderChat
        orderId={1}
        initialMessages={[buildMessage(1, 'client', 'Hola')]}
        initialTotal={1}
        initialHasMore={false}
        initialIsExpired={true}
        disablePollingOnMount
        isClient
        chatApiUrl="/api/public/pedido/1/chat"
      />
    );

    const input = screen.getByPlaceholderText('El pedido no está pendiente.');
    expect(input).toBeDisabled();
  });

  test('agrega mensajes nuevos del polling', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        messages: [buildMessage(2, 'operator', 'Nuevo mensaje')],
        status: 'pending',
        total: 2,
        hasMore: false,
        isExpired: false,
      }),
    });

    render(
      <OrderChat
        orderId={1}
        token="token"
        initialMessages={[buildMessage(1, 'client', 'Hola')]}
        initialTotal={1}
        initialHasMore={false}
        isClient
        chatApiUrl="/api/public/pedido/1/chat"
      />
    );

    await waitFor(
      () => {
        expect(screen.getByText('Nuevo mensaje')).toBeInTheDocument();
      },
      { timeout: 1000 }
    );
  });
});
