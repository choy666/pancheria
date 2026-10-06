/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { BranchPublicPreview } from './branch-public-preview';

// Lunes 28/09/2026 15:00 UTC = 12:00 en la timezone de sucursal por defecto
// (America/Argentina/Buenos_Aires, UTC-3): cae dentro de la franja
// 08:00–22:00 del día 1 (lunes) usada en los tests. Se construye como
// instante absoluto para que sea determinista en cualquier tz del runner.
const NOW = new Date('2026-09-28T15:00:00.000Z');

const BASE_PROPS = {
  name: 'Sucursal Centro',
  address: 'Av. Pellegrini 1234',
  phones: [{ label: 'Pedidos', number: '3415555555' }],
  socialLinks: [{ network: 'instagram' as const, url: '@pancho.centro' }],
  location: '-32.9468, -60.6393',
  openingHours: [{ dayOfWeek: 1, open: '08:00', close: '22:00' }],
};

describe('BranchPublicPreview', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('muestra la vista de catálogo con chip, dirección, teléfonos y redes', () => {
    render(<BranchPublicPreview {...BASE_PROPS} />);

    expect(screen.getByTestId('branch-status-chip')).toHaveTextContent(
      'Abierto ahora'
    );

    const card = screen.getByTestId('branch-info-card');
    // Variante header: microcopy en lugar del nombre de la sucursal.
    expect(card).toHaveTextContent('Pedí por acá');
    expect(card).not.toHaveTextContent('Sucursal Centro');
    expect(card).toHaveTextContent('Horario de hoy: Hoy de 08:00 a 22:00');
    expect(card).toHaveTextContent('Dirección: Av. Pellegrini 1234');
    expect(card).toHaveTextContent('Pedidos: 3415555555');
    expect(card).toHaveTextContent('Instagram: @pancho.centro');
    // Coordenadas: el mapa embebido se muestra visible, como en /pedido.
    expect(screen.getByTestId('branch-map-frame')).toBeInTheDocument();
  });

  test('la vista checkout muestra el nombre, el estado y el banner', () => {
    render(<BranchPublicPreview {...BASE_PROPS} />);

    fireEvent.click(screen.getByTestId('branch-preview-view-checkout'));

    const card = screen.getByTestId('branch-info-card');
    expect(card).toHaveTextContent('Sucursal Centro');
    expect(card).toHaveTextContent('Abierto ahora');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Sucursal abierta: Hoy de 08:00 a 22:00.'
    );
    // El chip solo acompaña a la vista de catálogo.
    expect(
      screen.queryByTestId('branch-status-chip')
    ).not.toBeInTheDocument();
  });

  test('el modo cerrado fuerza el aviso de sucursal cerrada', () => {
    render(<BranchPublicPreview {...BASE_PROPS} />);

    fireEvent.click(screen.getByTestId('branch-preview-mode-closed'));
    expect(screen.getByTestId('branch-status-chip')).toHaveTextContent(
      'Cerrado ahora'
    );

    fireEvent.click(screen.getByTestId('branch-preview-view-checkout'));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'La sucursal está cerrada.'
    );
  });

  test('en modo auto el estado se estima solo por los horarios cargados', () => {
    render(
      <BranchPublicPreview
        {...BASE_PROPS}
        openingHours={[{ dayOfWeek: 1, open: '18:00', close: '22:00' }]}
      />
    );

    // Lunes 12:00 queda fuera de la franja 18:00–22:00.
    expect(screen.getByTestId('branch-status-chip')).toHaveTextContent(
      'Cerrado ahora'
    );
  });

  test('descarta teléfonos vacíos y redes sin enlace', () => {
    render(
      <BranchPublicPreview
        {...BASE_PROPS}
        phones={[
          { label: '', number: '' },
          { label: 'Pedidos', number: '3415555555' },
        ]}
        socialLinks={[
          { network: 'instagram', url: '' },
          { network: 'facebook', url: 'https://facebook.com/pancho' },
        ]}
      />
    );

    const card = screen.getByTestId('branch-info-card');
    expect(card).toHaveTextContent('Pedidos: 3415555555');
    const social = screen.getByTestId('branch-social-links');
    expect(social).toHaveTextContent('Facebook');
    expect(social).not.toHaveTextContent('Instagram');
  });

  test('usa un nombre de relleno cuando el nombre está vacío', () => {
    render(<BranchPublicPreview {...BASE_PROPS} name="" />);

    fireEvent.click(screen.getByTestId('branch-preview-view-checkout'));
    expect(screen.getByTestId('branch-info-card')).toHaveTextContent(
      'Sucursal'
    );
  });
});
