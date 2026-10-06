/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { BranchMap } from './branch-map';

describe('BranchMap', () => {
  test('embebe el mapa acotado y no interactivo, con overlay que abre la página de mapa', () => {
    const { container } = render(
      <BranchMap location="-32.9468, -60.6393" branchName="Sucursal Centro" />
    );

    const frame = screen.getByTestId('branch-map-frame');
    expect(frame).toHaveAttribute(
      'src',
      expect.stringContaining('openstreetmap.org/export/embed.html')
    );
    // El embed no captura gestos ni recibe foco de teclado: si lo hiciera,
    // la rueda/el arrastre quedarían atrapados y trabarían el scroll del
    // catálogo.
    expect(frame).toHaveClass('pointer-events-none');
    expect(frame).toHaveAttribute('tabindex', '-1');
    expect(frame).toHaveAttribute('aria-hidden', 'true');

    // El ancho se acota para que el 16:9 no domine el viewport en desktop
    // (el `main` público no tiene `max-width`).
    expect(frame.parentElement).toHaveClass('aspect-video', 'max-w-md');

    // El overlay cubre el iframe y abre la página de mapa en pestaña nueva.
    const overlay = screen.getByTestId('branch-map-overlay');
    expect(overlay.tagName).toBe('A');
    expect(overlay).toHaveAttribute(
      'href',
      'https://www.openstreetmap.org/?mlat=-32.9468&mlon=-60.6393#map=18/-32.9468/-60.6393'
    );
    expect(overlay).toHaveAttribute('target', '_blank');
    expect(overlay).toHaveAttribute('rel', 'noopener noreferrer');
    expect(overlay).toHaveAttribute(
      'aria-label',
      'Abrir ubicación de Sucursal Centro en el mapa'
    );
    expect(container.querySelector('a[data-testid="branch-map-overlay"]')).toBe(
      overlay
    );
  });

  test('el overlay traduce el embed de Google a la página de Maps equivalente', () => {
    render(
      <BranchMap
        location="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3393!2d-60.6393!3d-32.9468"
        branchName="Sucursal Centro"
      />
    );

    // La URL de embed abierta en pestaña muestra el error "Embed API must be
    // used in an iframe": el overlay enlaza a la página de Maps.
    const overlay = screen.getByTestId('branch-map-overlay');
    expect(overlay.getAttribute('href')).toContain('google.com/maps/search');
    expect(decodeURIComponent(overlay.getAttribute('href')!)).toContain(
      'query=-32.9468,-60.6393'
    );
  });

  test('muestra solo el enlace externo cuando la ubicación no es embebible', () => {
    render(
      <BranchMap
        location="https://maps.app.goo.gl/abc123"
        branchName="Sucursal Centro"
      />
    );

    expect(screen.getByTestId('branch-map-link')).toHaveAttribute(
      'href',
      'https://maps.app.goo.gl/abc123'
    );
    expect(screen.queryByTestId('branch-map')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('branch-map-frame')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('branch-map-overlay')
    ).not.toBeInTheDocument();
  });
});
