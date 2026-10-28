/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { PublicFooter } from './public-footer';
import type { BrandSettings } from '@/domain/types';

const baseBrand: BrandSettings = {
  name: null,
  tagline: null,
  logoUpdatedAt: null,
  legalName: null,
  taxId: null,
  supportEmail: null,
  termsUrl: null,
  privacyUrl: null,
  footerAbout: null,
  paymentMethods: null,
  developedBy: null,
  showHours: true,
  showMap: true,
  showSocial: true,
  faq: [],
  announcementText: null,
  announcementEnabled: false,
  announcementVariant: 'info',
};

describe('PublicFooter', () => {
  test('muestra los datos legales y los enlaces que el dueño cargó', () => {
    render(
      <PublicFooter
        brand={{
          ...baseBrand,
          name: 'Pancheria Popular',
          legalName: 'Pancheria Popular SRL',
          taxId: '30-12345678-9',
          termsUrl: '/terminos',
          privacyUrl: 'https://ejemplo.com/privacidad',
        }}
        branch={null}
      />
    );

    expect(screen.getByText(/Todos los derechos reservados/)).toHaveTextContent(
      'Pancheria Popular SRL'
    );
    expect(screen.getByText(/CUIT 30-12345678-9/)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Términos y condiciones' })
    ).toHaveAttribute('href', '/terminos');
    expect(
      screen.getByRole('link', { name: 'Política de privacidad' })
    ).toHaveAttribute('href', 'https://ejemplo.com/privacidad');
    expect(
      screen.getByRole('link', { name: 'Botón de arrepentimiento' })
    ).toHaveAttribute('href', '/pedido/seguimiento');
  });

  test('omite los enlaces y datos que no fueron cargados', () => {
    render(<PublicFooter brand={baseBrand} branch={null} />);

    expect(
      screen.queryByRole('link', { name: 'Términos y condiciones' })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/CUIT/)).not.toBeInTheDocument();
    expect(screen.getByText(/Todos los derechos reservados/)).toHaveTextContent(
      'Pedido online'
    );
  });
});
