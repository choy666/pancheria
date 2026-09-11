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

function mockNavigatorGeolocation(
  position?: { coords: { latitude: number; longitude: number } }
) {
  Object.defineProperty(global, 'navigator', {
    value: {
      geolocation: {
        getCurrentPosition: jest.fn((success, _error, _options) => {
          if (position) {
            success(position as GeolocationPosition);
          }
        }),
      },
    },
    writable: true,
  });
}

describe('OrderChat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch as unknown as typeof fetch;
    process.env.NEXT_PUBLIC_MAPS_PROVIDER = 'openstreetmap';
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
      deliveredAt: null,
      readAt: null,
      createdAt: new Date(),
      attachmentUrl: null,
      attachmentKey: null,
      attachmentMimeType: null,
      attachmentSize: null,
      attachmentName: null,
    };
  }

  function mockApiResponse(overrides: Record<string, unknown> = {}) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        messages: [],
        status: 'pending',
        deliveryType: 'pickup',
        branchLocation: null,
        total: 0,
        hasMore: false,
        isExpired: false,
        ...overrides,
      }),
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
    mockFetch.mockResolvedValueOnce(
      mockApiResponse({
        messages: [buildMessage(49, 'client', 'Anterior')],
        total: 100,
        hasMore: true,
      })
    );

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
    mockFetch.mockResolvedValue(
      mockApiResponse({
        messages: [buildMessage(2, 'operator', 'Nuevo mensaje')],
        total: 2,
      })
    );

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

  test('muestra botón de ubicación para pedidos delivery del cliente', () => {
    mockNavigatorGeolocation({ coords: { latitude: -34.6, longitude: -58.3 } });

    render(
      <OrderChat
        orderId={1}
        initialMessages={[]}
        initialTotal={0}
        initialHasMore={false}
        disablePollingOnMount
        isClient
        deliveryType="delivery"
        chatApiUrl="/api/public/pedido/1/chat"
      />
    );

    expect(
      screen.getByTestId('chat-client-location-button')
    ).toBeInTheDocument();
  });

  test('no muestra botón de ubicación si el cliente no tiene delivery', () => {
    mockNavigatorGeolocation({ coords: { latitude: -34.6, longitude: -58.3 } });

    render(
      <OrderChat
        orderId={1}
        initialMessages={[]}
        initialTotal={0}
        initialHasMore={false}
        disablePollingOnMount
        isClient
        deliveryType="pickup"
        chatApiUrl="/api/public/pedido/1/chat"
      />
    );

    expect(
      screen.queryByTestId('chat-client-location-button')
    ).not.toBeInTheDocument();
  });

  test('muestra botón de ubicación de sucursal para pedidos pickup del operador', () => {
    render(
      <OrderChat
        orderId={1}
        initialMessages={[]}
        initialTotal={0}
        initialHasMore={false}
        disablePollingOnMount
        deliveryType="pickup"
        branchLocation="https://maps.example.com/sucursal"
        chatApiUrl="/api/pedidos/1/chat"
        branchLocationApiUrl="/api/pedidos/1/chat/ubicacion"
      />
    );

    expect(
      screen.getByTestId('chat-branch-location-button')
    ).toBeInTheDocument();
  });

  test('renderiza un enlace de ubicación cuando el mensaje contiene una URL de mapa', () => {
    render(
      <OrderChat
        orderId={1}
        initialMessages={[
          buildMessage(
            1,
            'client',
            'https://www.openstreetmap.org/?mlat=-34.6&mlon=-58.3'
          ),
        ]}
        initialTotal={1}
        initialHasMore={false}
        disablePollingOnMount
        isClient
        chatApiUrl="/api/public/pedido/1/chat"
      />
    );

    expect(screen.getByTestId('chat-location-link')).toBeInTheDocument();
    expect(screen.getByText('Ver ubicación')).toBeInTheDocument();
  });

  test('el cliente comparte su ubicación al hacer clic en el botón', async () => {
    mockNavigatorGeolocation({ coords: { latitude: -34.6, longitude: -58.3 } });

    render(
      <OrderChat
        orderId={1}
        token="token"
        initialMessages={[]}
        initialTotal={0}
        initialHasMore={false}
        disablePollingOnMount
        isClient
        deliveryType="delivery"
        chatApiUrl="/api/public/pedido/1/chat"
      />
    );

    fireEvent.click(screen.getByTestId('chat-client-location-button'));

    await waitFor(() => {
      const input = screen.getByPlaceholderText('Escribí un mensaje...');
      expect((input as HTMLTextAreaElement).value).toContain('openstreetmap.org');
    });
  });
});
