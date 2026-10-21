/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PanelHeader } from './panel-header';

jest.mock('next/link', () => ({
  __esModule: true,
  default: function Link({
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    children: React.ReactNode;
  }) {
    return <a {...rest}>{children}</a>;
  },
}));

jest.mock('./branch-selector', () => ({
  __esModule: true,
  BranchSelector: () => <div data-testid="branch-selector-mock" />,
}));

jest.mock('@/components/tour/tour-context', () => ({
  __esModule: true,
  TourButton: () => <button type="button" data-testid="tour-button-mock" />,
}));

const setActiveBranchAction = jest.fn();
const signOutAction = jest.fn();

const adminBranches = [
  { id: 1, name: 'Sucursal Centro' },
  { id: 2, name: 'Sucursal Norte' },
];

function renderHeader(
  overrides: Partial<React.ComponentProps<typeof PanelHeader>> = {}
) {
  return render(
    <PanelHeader
      userName="Admin"
      branchName="Sucursal Centro"
      role="admin"
      branches={adminBranches}
      activeBranchId={1}
      activeBranchIsActive={true}
      setActiveBranchAction={setActiveBranchAction}
      signOutAction={signOutAction}
      {...overrides}
    />
  );
}

describe('PanelHeader — enlace a /pantalla', () => {
  test('admin: el ícono apunta a la sucursal activa y abre en pestaña nueva', () => {
    renderHeader({ activeBranchId: 2 });

    const link = screen.getByTestId('pantalla-link');
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/pantalla?branchId=2');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(link).toHaveAttribute(
      'aria-label',
      'Abrir la pantalla publicitaria de Sucursal Norte'
    );
  });

  test('operador: el ícono apunta a su sucursal fija', () => {
    renderHeader({
      role: 'operator',
      branches: undefined,
      branchName: 'Sucursal Centro',
      activeBranchId: 3,
    });

    const link = screen.getByTestId('pantalla-link');
    expect(link).toHaveAttribute('href', '/pantalla?branchId=3');
    expect(link).toHaveAttribute('target', '_blank');
  });

  test('sin activeBranchId no se renderiza el enlace (nunca /pantalla pelado)', () => {
    renderHeader({ activeBranchId: undefined });

    expect(screen.queryByTestId('pantalla-link')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
    expect(screen.queryByTestId('pantalla-link-mobile')).toBeNull();
  });

  test('sucursal activa inactiva: el acceso queda deshabilitado con aviso', () => {
    renderHeader({ activeBranchIsActive: false });

    const control = screen.getByTestId('pantalla-link');
    // No es un anchor navegable: abrir la pestaña solo mostraría el error.
    expect(control.tagName).not.toBe('A');
    expect(control).toHaveAttribute('aria-disabled', 'true');
    expect(control).toHaveAttribute(
      'title',
      'La sucursal activa está inactiva: la pantalla publicitaria no puede mostrarla'
    );
    expect(
      screen.queryByRole('link', { name: /pantalla publicitaria/i })
    ).toBeNull();
  });

  test('menú mobile: el enlace figura con el branchId y cierra el menú', () => {
    renderHeader({ activeBranchId: 2 });

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));

    const link = screen.getByTestId('pantalla-link-mobile');
    expect(link).toHaveAttribute('href', '/pantalla?branchId=2');
    expect(link).toHaveAttribute('target', '_blank');

    fireEvent.click(link);
    // El menú se cierra: la TV abre pestaña nueva y el panel queda usable.
    expect(screen.queryByTestId('pantalla-link-mobile')).toBeNull();
  });
});

describe('PanelHeader — enlace a /menu', () => {
  test('el ícono apunta a la sucursal activa y abre en pestaña nueva', () => {
    renderHeader({ activeBranchId: 2 });

    const link = screen.getByTestId('menu-link');
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/menu?branchId=2');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(link).toHaveAttribute(
      'aria-label',
      'Abrir el menú digital de Sucursal Norte'
    );
  });

  test('sin activeBranchId no se renderiza el enlace (nunca /menu pelado)', () => {
    renderHeader({ activeBranchId: undefined });

    expect(screen.queryByTestId('menu-link')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
    expect(screen.queryByTestId('menu-link-mobile')).toBeNull();
  });

  test('sucursal activa inactiva: el acceso queda deshabilitado con aviso', () => {
    renderHeader({ activeBranchIsActive: false });

    const control = screen.getByTestId('menu-link');
    expect(control.tagName).not.toBe('A');
    expect(control).toHaveAttribute('aria-disabled', 'true');
    expect(control).toHaveAttribute(
      'title',
      'La sucursal activa está inactiva: el menú digital no puede mostrarla'
    );
    expect(
      screen.queryByRole('link', { name: /menú digital/i })
    ).toBeNull();
  });

  test('menú mobile: el enlace figura con el branchId', () => {
    renderHeader({ activeBranchId: 2 });

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));

    const link = screen.getByTestId('menu-link-mobile');
    expect(link).toHaveAttribute('href', '/menu?branchId=2');
    expect(link).toHaveAttribute('target', '_blank');
  });
});
