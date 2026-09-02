/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { PedidoActions } from './pedido-actions';
import type { CashRegister } from '@/config/caja';

const openCashRegister: CashRegister = {
  id: 1,
  branchId: 1,
  status: 'open',
  openedBy: 'admin',
  openedAt: new Date().toISOString(),
  closedAt: null,
  closedBy: null,
  autoClosed: false,
  initialAmount: 0,
  total: 0,
  cashTotal: 0,
  transferTotal: 0,
  totalSales: 0,
  createdAt: new Date().toISOString(),
};

function renderPedidoActions(
  overrides: {
    isPaymentComplete?: boolean;
    paymentRemaining?: number;
    status?: 'pending' | 'in_process' | 'paid';
    cashRegister?: CashRegister | null;
  } = {}
) {
  return render(
    <PedidoActions
      status={overrides.status ?? 'pending'}
      total={1500}
      cashRegister={
        overrides.cashRegister === undefined ? openCashRegister : overrides.cashRegister
      }
      payments={[{ method: 'cash', amount: 1500 }]}
      setPayments={jest.fn()}
      isPaymentComplete={overrides.isPaymentComplete ?? true}
      paymentRemaining={overrides.paymentRemaining ?? 0}
      cancelReason=""
      setCancelReason={jest.fn()}
      actionError={null}
      isSubmitting={false}
      whatsappUrl={null}
      onReceive={jest.fn()}
      onConfirm={jest.fn()}
      onFinish={jest.fn()}
      onCancel={jest.fn()}
    />
  );
}

describe('PedidoActions', () => {
  test('habilita Confirmar pago cuando el pago está completo', () => {
    renderPedidoActions({ isPaymentComplete: true });
    const button = screen.getByRole('button', { name: 'Confirmar pago' });
    expect(button).not.toBeDisabled();
  });

  test('deshabilita Confirmar pago cuando falta dinero', () => {
    renderPedidoActions({
      isPaymentComplete: false,
      paymentRemaining: 500,
    });
    const button = screen.getByRole('button', { name: 'Confirmar pago' });
    expect(button).toBeDisabled();
    expect(
      screen.getByText('Faltan $ 500 para completar el pago.')
    ).toBeInTheDocument();
  });

  test('deshabilita Confirmar pago cuando sobra dinero', () => {
    renderPedidoActions({
      isPaymentComplete: false,
      paymentRemaining: -300,
    });
    const button = screen.getByRole('button', { name: 'Confirmar pago' });
    expect(button).toBeDisabled();
    expect(
      screen.getByText('Sobran $ 300. Ajustá el pago antes de confirmar.')
    ).toBeInTheDocument();
  });

  test('no muestra el mensaje de pago incompleto si no se puede confirmar', () => {
    renderPedidoActions({
      isPaymentComplete: false,
      paymentRemaining: 500,
      cashRegister: null,
    });
    expect(
      screen.queryByText(/Faltan/)
    ).not.toBeInTheDocument();
  });
});
