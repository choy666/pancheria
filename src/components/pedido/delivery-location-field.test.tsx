/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DeliveryLocationField } from './delivery-location-field';

function mockNavigatorGeolocation(options: {
  position?: { coords: { latitude: number; longitude: number } };
  error?: { code: number };
  supported?: boolean;
}) {
  if (options.supported === false) {
    Object.defineProperty(global, 'navigator', {
      value: {},
      writable: true,
    });
    return;
  }

  Object.defineProperty(global, 'navigator', {
    value: {
      geolocation: {
        getCurrentPosition: jest.fn((success, failure) => {
          if (options.position) {
            success(options.position as GeolocationPosition);
          } else if (options.error) {
            failure(
              Object.assign(new Error('geo error'), {
                code: options.error.code,
                PERMISSION_DENIED: 1,
                POSITION_UNAVAILABLE: 2,
                TIMEOUT: 3,
              }) as GeolocationPositionError
            );
          }
        }),
      },
    },
    writable: true,
  });
}

describe('DeliveryLocationField', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_MAPS_PROVIDER = 'openstreetmap';
  });

  test('obtiene el pin con el GPS, muestra el estado de éxito y el enlace al mapa', async () => {
    mockNavigatorGeolocation({
      position: { coords: { latitude: -34.6037, longitude: -58.3816 } },
    });
    const onChange = jest.fn();

    const { rerender } = render(
      <DeliveryLocationField value="" onChange={onChange} />
    );

    fireEvent.click(screen.getByTestId('checkout-delivery-location-button'));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.stringContaining('openstreetmap.org')
      );
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.stringContaining('mlat=-34.6037')
    );

    // El valor controlado lo sube el padre: se re-renderiza con la URL nueva.
    rerender(
      <DeliveryLocationField
        value={onChange.mock.calls[0][0] as string}
        onChange={onChange}
      />
    );
    expect(screen.getByTestId('delivery-location-granted')).toBeInTheDocument();
    expect(screen.getByTestId('delivery-location-map-link')).toHaveAttribute(
      'href',
      expect.stringContaining('openstreetmap.org')
    );
  });

  test('muestra "Obteniendo ubicación…" con el botón deshabilitado mientras pide el GPS', async () => {
    let resolvePosition: ((p: GeolocationPosition) => void) | undefined;
    Object.defineProperty(global, 'navigator', {
      value: {
        geolocation: {
          getCurrentPosition: jest.fn((success) => {
            resolvePosition = success;
          }),
        },
      },
      writable: true,
    });

    render(<DeliveryLocationField value="" onChange={jest.fn()} />);

    const button = screen.getByTestId('checkout-delivery-location-button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toBeDisabled();
      expect(screen.getByText('Obteniendo ubicación…')).toBeInTheDocument();
    });

    resolvePosition?.({
      coords: { latitude: -34.6, longitude: -58.3 },
    } as GeolocationPosition);
  });

  test('muestra el error traducido cuando el permiso es denegado y mantiene el fallback manual', async () => {
    mockNavigatorGeolocation({ error: { code: 1 } }); // PERMISSION_DENIED

    render(<DeliveryLocationField value="" onChange={jest.fn()} />);

    fireEvent.click(screen.getByTestId('checkout-delivery-location-button'));

    await waitFor(() => {
      expect(screen.getByTestId('delivery-location-geo-error')).toHaveTextContent(
        'No se concedió permiso para acceder a la ubicación.'
      );
    });

    // El fallback manual sigue disponible.
    expect(screen.getByTestId('delivery-location-input')).toBeInTheDocument();
  });

  test('marca el enlace inválido solo después del blur y nunca el campo vacío', () => {
    const onChange = jest.fn();

    const { rerender } = render(
      <DeliveryLocationField value="" onChange={onChange} />
    );

    const input = screen.getByTestId('delivery-location-input');
    // Vacío sin interacción: no se marca como inválido.
    expect(
      screen.queryByTestId('delivery-location-input-error')
    ).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'texto inválido' } });
    rerender(<DeliveryLocationField value="texto inválido" onChange={onChange} />);

    // Sin blur todavía no hay error visible.
    expect(
      screen.queryByTestId('delivery-location-input-error')
    ).not.toBeInTheDocument();

    fireEvent.blur(input);
    expect(
      screen.getByTestId('delivery-location-input-error')
    ).toBeInTheDocument();
  });

  test('ofrece el enlace "Ver en mapa" para un input manual válido', () => {
    render(
      <DeliveryLocationField
        value="https://maps.app.goo.gl/abc123"
        onChange={jest.fn()}
      />
    );

    expect(screen.getByTestId('delivery-location-map-link')).toHaveAttribute(
      'href',
      'https://maps.app.goo.gl/abc123'
    );
    expect(screen.getByTestId('delivery-location-map-link')).toHaveAttribute(
      'target',
      '_blank'
    );
    expect(screen.getByTestId('delivery-location-map-link')).toHaveAttribute(
      'rel',
      'noopener noreferrer'
    );
  });

  test('sin soporte de geolocalización no muestra el botón GPS', () => {
    mockNavigatorGeolocation({ supported: false });

    render(<DeliveryLocationField value="" onChange={jest.fn()} />);

    expect(
      screen.queryByTestId('checkout-delivery-location-button')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('delivery-location-input')).toBeInTheDocument();
  });
});
