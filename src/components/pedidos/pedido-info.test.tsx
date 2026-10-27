/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { PedidoInfo } from './pedido-info';

function makeOrder(
  overrides: Record<string, unknown> = {}
): React.ComponentProps<typeof PedidoInfo>['order'] {
  return {
    customerName: 'Juan Pérez',
    customerPhone: '3415555555',
    deliveryType: 'delivery',
    address: 'Calle Falsa 123',
    deliveryLocation: null,
    notes: null,
    total: 1200,
    createdAt: new Date().toISOString(),
    convertedSaleId: null,
    branch: { name: 'Sucursal A', location: null },
    ...overrides,
  } as React.ComponentProps<typeof PedidoInfo>['order'];
}

describe('PedidoInfo', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_MAPS_PROVIDER = 'openstreetmap';
  });

  test('muestra "Ubicación de entrega" con enlace al mapa en delivery con pin', () => {
    render(
      <PedidoInfo
        order={makeOrder({
          deliveryLocation:
            'https://www.openstreetmap.org/?mlat=-34.6037&mlon=-58.3816',
        })}
      />
    );

    expect(screen.getByText('Ubicación de entrega')).toBeInTheDocument();
    const link = screen.getByTestId('order-delivery-location-link');
    expect(link).toHaveTextContent('Ver en mapa');
    expect(link).toHaveAttribute(
      'href',
      'https://www.openstreetmap.org/?mlat=-34.6037&mlon=-58.3816'
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('no muestra el bloque de ubicación en delivery sin pin (legacy)', () => {
    render(<PedidoInfo order={makeOrder({ deliveryLocation: null })} />);

    expect(
      screen.queryByText('Ubicación de entrega')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('order-delivery-location-link')
    ).not.toBeInTheDocument();
  });

  test('no muestra el bloque de ubicación en pedidos pickup', () => {
    render(
      <PedidoInfo
        order={makeOrder({
          deliveryType: 'pickup',
          deliveryLocation:
            'https://www.openstreetmap.org/?mlat=-34.6037&mlon=-58.3816',
        })}
      />
    );

    expect(
      screen.queryByText('Ubicación de entrega')
    ).not.toBeInTheDocument();
  });
});
