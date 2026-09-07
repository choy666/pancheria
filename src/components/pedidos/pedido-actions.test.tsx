/**
 * @jest-environment jsdom
 */
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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

  test('permite ingresar un pago mixto', () => {
    function TestWrapper() {
      const [payments, setPayments] = useState([
        { method: 'cash' as const, amount: 1500 },
        { method: 'transfer' as const, amount: 0 },
      ]);

      return (
        <PedidoActions
          status="pending"
          total={1500}
          cashRegister={openCashRegister}
          payments={payments}
          setPayments={setPayments}
          isPaymentComplete={
            payments.reduce((sum, p) => sum + p.amount, 0) === 1500
          }
          paymentRemaining={
            1500 - payments.reduce((sum, p) => sum + p.amount, 0)
          }
          cancelReason=""
          setCancelReason={jest.fn()}
          actionError={null}
          isSubmitting={false}
          onReceive={jest.fn()}
          onConfirm={jest.fn()}
          onFinish={jest.fn()}
          onCancel={jest.fn()}
        />
      );
    }

    render(<TestWrapper />);

    const cashInput = screen.getByTestId('payment-cash-input');
    const transferInput = screen.getByTestId('payment-transfer-input');

    fireEvent.change(cashInput, { target: { value: '1000' } });
    fireEvent.change(transferInput, { target: { value: '500' } });

    expect(cashInput).toHaveValue('1000');
    expect(transferInput).toHaveValue('500');
    expect(
      screen.getByTestId('payment-remaining-message')
    ).toHaveTextContent('Pago completo');
  });
});
