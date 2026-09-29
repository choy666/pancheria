/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { BranchPhones, BranchSocialLinks } from './branch-contact';

describe('BranchPhones', () => {
  test('renderiza cada teléfono como "Etiqueta: número" con testid en el primero', () => {
    render(
      <BranchPhones
        phones={[
          { label: 'Pedidos', number: '3415550001' },
          { label: 'WhatsApp', number: '3415550002' },
        ]}
      />
    );

    expect(screen.getByTestId('branch-phone')).toHaveTextContent(
      'Pedidos: 3415550001'
    );
    expect(screen.getByText(/WhatsApp: 3415550002/)).toBeInTheDocument();
    // El testid solo va en el primer teléfono.
    expect(screen.getAllByTestId('branch-phone')).toHaveLength(1);
  });

  test('aplica numberClassName al número', () => {
    render(
      <BranchPhones
        phones={[{ label: 'Pedidos', number: '3415550001' }]}
        numberClassName="font-mono"
      />
    );

    const number = screen.getByText('3415550001');
    expect(number.tagName).toBe('SPAN');
    expect(number).toHaveClass('font-mono');
  });
});

describe('BranchSocialLinks', () => {
  test('no renderiza nada sin enlaces', () => {
    const { container } = render(<BranchSocialLinks links={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('usa enlace para URLs http(s) y texto para handles', () => {
    render(
      <BranchSocialLinks
        links={[
          { network: 'instagram', url: '@pancho' },
          { network: 'facebook', url: 'https://facebook.com/pancho' },
        ]}
      />
    );

    const social = screen.getByTestId('branch-social-links');
    expect(social).toHaveTextContent('Instagram: @pancho');
    const link = screen.getByRole('link', { name: 'Facebook' });
    expect(link).toHaveAttribute('href', 'https://facebook.com/pancho');
  });

  test('con whatsappAsText el número de WhatsApp no es enlace', () => {
    const links = [{ network: 'whatsapp' as const, url: '3415550001' }];

    const { unmount } = render(<BranchSocialLinks links={links} />);
    expect(screen.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute(
      'href',
      'https://wa.me/3415550001'
    );

    unmount();
    render(<BranchSocialLinks links={links} whatsappAsText />);
    expect(
      screen.queryByRole('link', { name: 'WhatsApp' })
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('branch-social-links')).toHaveTextContent(
      'WhatsApp: 3415550001'
    );
  });
});
