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
  it('muestra el consumo total por insumo fusionado', () => {
    render(
      <CashRegisterSummary
        cashRegister={{
          ...baseCashRegister,
          productsSummary: { 'Vaso de gaseosa': 3, 'Promo Amigos': 2 },
          recipeSuppliesSummary: { 'Vaso de gaseosa': 2, Pan: 4 },
          suppliesSummary: { 'Vaso de gaseosa': 5, Pan: 4 },
        }}
        now={new Date('2026-10-04T13:00:00Z')}
      />
    );

    const card = screen.getByTestId('supplies-summary-card');
    expect(card).toBeInTheDocument();
    expect(card).toHaveTextContent('Consumo total por insumo');

    const items = screen.getAllByTestId('cash-register-total-supply-item');
    const byName = Object.fromEntries(
      items.map((item) => [
        item.getAttribute('data-product-name'),
        item.textContent,
      ])
    );
    expect(byName['Vaso de gaseosa']).toContain('5');
    expect(byName['Pan']).toContain('4');
    expect(byName['Promo Amigos']).toBeUndefined();
  });

  it('no muestra la tarjeta vacía si no llega suppliesSummary', () => {
    render(
      <CashRegisterSummary
        cashRegister={baseCashRegister}
        now={new Date('2026-10-04T13:00:00Z')}
      />
    );

    const card = screen.getByTestId('supplies-summary-card');
    expect(card).toBeInTheDocument();
    expect(
      card.querySelectorAll('[data-testid="cash-register-total-supply-item"]')
    ).toHaveLength(0);
  });
});
