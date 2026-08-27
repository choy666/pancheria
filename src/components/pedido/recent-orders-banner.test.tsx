/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { RecentOrdersBanner } from './recent-orders-banner';
import type { RecentOrder } from '@/lib/recent-orders';

const mockFetch = jest.fn();

describe('RecentOrdersBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  function buildOrder(overrides: Partial<RecentOrder> = {}): RecentOrder {
    return {
      id: 1,
      orderNumber: 'PED-1-1234567890-abc',
      cancellationToken: 'token',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      branchId: 1,
      branchName: 'Sucursal A',
      ...overrides,
    };
  }

  test('no renderiza cuando no hay pedidos', () => {
    const { container } = render(
      <RecentOrdersBanner orders={[]} onDismiss={jest.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  test('renderiza los pedidos recientes', () => {
    render(<RecentOrdersBanner orders={[buildOrder()]} onDismiss={jest.fn()} />);

    expect(screen.getByText('Pedido reciente')).toBeInTheDocument();
    expect(screen.getByText(/PED-1-1234567890-abc/)).toBeInTheDocument();
  });

  test('oculta pedidos cuyo estado ya no es pending', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'finished',
        expiresAt: new Date().toISOString(),
        isExpired: false,
      }),
    });

    const onDismiss = jest.fn();
    render(<RecentOrdersBanner orders={[buildOrder()]} onDismiss={onDismiss} />);

    await waitFor(() => {
      expect(onDismiss).toHaveBeenCalledWith(1);
    });
  });

  test('oculta pedidos cuya expiración ya pasó aunque sigan pending', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'pending',
        expiresAt: new Date(Date.now() - 3_600_000).toISOString(),
        isExpired: true,
      }),
    });

    const onDismiss = jest.fn();
    render(<RecentOrdersBanner orders={[buildOrder()]} onDismiss={onDismiss} />);

    await waitFor(() => {
      expect(onDismiss).toHaveBeenCalledWith(1);
    });
  });

  test('no oculta pedidos que siguen pending', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'pending',
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        isExpired: false,
      }),
    });

    const onDismiss = jest.fn();
    render(<RecentOrdersBanner orders={[buildOrder()]} onDismiss={onDismiss} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.getByText(/Ir al chat/)).toBeInTheDocument();
  });

  test('permite descartar un pedido manualmente', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'pending',
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        isExpired: false,
      }),
    });

    const onDismiss = jest.fn();
    render(<RecentOrdersBanner orders={[buildOrder()]} onDismiss={onDismiss} />);

    const button = await screen.findByRole('button', {
      name: /Ocultar recordatorio del pedido/,
    });
    fireEvent.click(button);

    expect(onDismiss).toHaveBeenCalledWith(1);
  });
});
