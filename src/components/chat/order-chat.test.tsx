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
  getChatAllowedImageMimeTypes: jest
    .fn()
    .mockReturnValue(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  getChatImageMaxSizeBytes: jest.fn().mockReturnValue(4 * 1024 * 1024),
  getChatImageMaxSizeMb: jest.fn().mockReturnValue(4),
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

  test('limpia el badge de no leídos tras marcar los mensajes como leídos', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });

    render(
      <OrderChat
        orderId={1}
        token="token"
        initialMessages={[
          buildMessage(1, 'operator', 'Bienvenido'),
          buildMessage(2, 'operator', 'Detalle'),
          buildMessage(3, 'operator', 'Otro'),
        ]}
        initialTotal={3}
        initialHasMore={false}
        unreadCount={3}
        disablePollingOnMount
        isClient
        chatApiUrl="/api/public/pedido/1/chat"
        readApiUrl="/api/public/pedido/1/chat/leido"
      />
    );

    expect(screen.getByText('3')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText('3')).not.toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/leido'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  test('rechaza un archivo que supera el tamaño máximo antes de subirlo', async () => {
    render(
      <OrderChat
        orderId={1}
        token="token"
        initialMessages={[]}
        initialTotal={0}
        initialHasMore={false}
        disablePollingOnMount
        isClient
        chatApiUrl="/api/public/pedido/1/chat"
        uploadApiUrl="/api/public/pedido/1/chat/upload"
      />
    );

    const bigFile = new File(
      [new Uint8Array(5 * 1024 * 1024)],
      'foto.jpg',
      { type: 'image/jpeg' }
    );
    fireEvent.change(screen.getByTestId('chat-file-input'), {
      target: { files: [bigFile] },
    });

    await waitFor(() => {
      expect(
        screen.getByText('El archivo supera el máximo de 4 MB.')
      ).toBeInTheDocument();
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('rechaza un tipo de archivo no permitido antes de subirlo', async () => {
    render(
      <OrderChat
        orderId={1}
        token="token"
        initialMessages={[]}
        initialTotal={0}
        initialHasMore={false}
        disablePollingOnMount
        isClient
        chatApiUrl="/api/public/pedido/1/chat"
        uploadApiUrl="/api/public/pedido/1/chat/upload"
      />
    );

    const textFile = new File(['texto'], 'nota.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByTestId('chat-file-input'), {
      target: { files: [textFile] },
    });

    await waitFor(() => {
      expect(
        screen.getByText('Ese tipo de archivo no está permitido.')
      ).toBeInTheDocument();
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('el cliente comparte su ubicación al hacer clic en el botón (envío directo, sin pisar el borrador)', async () => {
    mockNavigatorGeolocation({ coords: { latitude: -34.6, longitude: -58.3 } });

    const locationMessage = buildMessage(
      10,
      'client',
      'https://www.openstreetmap.org/?mlat=-34.6&mlon=-58.3#map=18/-34.6/-58.3'
    );
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: locationMessage }),
      })
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });

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

    // El borrador queda intacto: la ubicación viaja como mensaje dedicado.
    fireEvent.change(screen.getByPlaceholderText('Escribí un mensaje...'), {
      target: { value: 'Llego en 10' },
    });

    fireEvent.click(screen.getByTestId('chat-client-location-button'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/public/pedido/1/chat'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('openstreetmap.org'),
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('chat-location-link')).toHaveTextContent(
        'Ver ubicación'
      );
    });

    expect(
      (screen.getByPlaceholderText('Escribí un mensaje...') as HTMLTextAreaElement)
        .value
    ).toBe('Llego en 10');
  });

  test('un doble clic en ubicación no dispara dos pedidos de geolocalización', async () => {
    const getCurrentPosition = jest.fn(
      (
        _success: PositionCallback,
        _error?: PositionErrorCallback | null,
        _options?: PositionOptions
      ) => {
        // La posición queda pendiente: el segundo clic debe ignorarse.
      }
    );
    Object.defineProperty(global, 'navigator', {
      value: { geolocation: { getCurrentPosition } },
      writable: true,
    });

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

    const button = screen.getByTestId('chat-client-location-button');
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => {
      expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    });

    // El botón muestra feedback de carga mientras espera la posición.
    expect(
      screen.getByTestId('chat-client-location-spinner')
    ).toBeInTheDocument();
    expect(button).toBeDisabled();
  });
});
