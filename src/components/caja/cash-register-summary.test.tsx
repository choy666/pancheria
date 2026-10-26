/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { CashRegisterSummary } from './cash-register-summary';

const baseCashRegister = {
  id: 1,
  openedAt: new Date('2026-10-04T12:00:00Z'),
  closedAt: null,
  openedBy: 'admin',
  closedBy: null,
  status: 'open' as const,
  autoClosed: false,
  initialAmount: 0,
  total: 0,
  cashTotal: 0,
  transferTotal: 0,
  totalSales: 0,
};

describe('CashRegisterSummary', () => {
  it('lista los productos vendidos y el consumo de insumos críticos', () => {
    render(
      <CashRegisterSummary
        cashRegister={{
          ...baseCashRegister,
          productsSummary: { 'Vaso de gaseosa': 3, 'Promo Amigos': 2 },
          criticalSuppliesSummary: { Pan: 4 },
        }}
        now={new Date('2026-10-04T13:00:00Z')}
      />
    );

    const productItems = screen.getAllByTestId('cash-register-product-item');
    const productsByName = Object.fromEntries(
      productItems.map((item) => [
        item.getAttribute('data-product-name'),
        item.textContent,
      ])
    );
    expect(productsByName['Vaso de gaseosa']).toContain('3');
    expect(productsByName['Promo Amigos']).toContain('2');

    const supplyItems = screen.getAllByTestId('cash-register-supply-item');
    const suppliesByName = Object.fromEntries(
      supplyItems.map((item) => [
        item.getAttribute('data-product-name'),
        item.textContent,
      ])
    );
    expect(suppliesByName['Pan']).toContain('4');
  });

  it('muestra mensajes de vacío cuando no hay ventas ni consumo', () => {
    render(
      <CashRegisterSummary
        cashRegister={baseCashRegister}
        now={new Date('2026-10-04T13:00:00Z')}
      />
    );

    expect(screen.getByText('Sin ventas registradas')).toBeInTheDocument();
    expect(screen.getByText('Sin consumo registrado')).toBeInTheDocument();
    expect(
      screen.queryByTestId('cash-register-product-item')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('cash-register-supply-item')
    ).not.toBeInTheDocument();
  });

  it('no renderiza las tarjetas retiradas de insumos de recetas ni consumo total', () => {
    render(
      <CashRegisterSummary
        cashRegister={{
          ...baseCashRegister,
          productsSummary: { 'Vaso de gaseosa': 3 },
          criticalSuppliesSummary: { Pan: 4 },
        }}
        now={new Date('2026-10-04T13:00:00Z')}
      />
    );

    expect(screen.queryByTestId('recipe-supplies-card')).toBeNull();
    expect(screen.queryByTestId('supplies-summary-card')).toBeNull();
  });
});
