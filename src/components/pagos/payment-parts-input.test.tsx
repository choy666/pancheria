/**
 * @jest-environment jsdom
 */
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaymentPartsInput } from './payment-parts-input';
import type { PaymentPart } from '@/domain/types';

describe('PaymentPartsInput', () => {
  test('resalta el botón Todo efectivo cuando el pago es solo efectivo', () => {
    render(
      <PaymentPartsInput
        total={1500}
        payments={[{ method: 'cash', amount: 1500 }]}
        onChange={jest.fn()}
      />
    );

    const cashButton = screen.getByTestId('payment-cash-full');
    const transferButton = screen.getByTestId('payment-transfer-full');

    expect(cashButton).toHaveAttribute('aria-pressed', 'true');
    expect(transferButton).toHaveAttribute('aria-pressed', 'false');
  });

  test('resalta el botón Todo transferencia cuando el pago es solo transferencia', () => {
    render(
      <PaymentPartsInput
        total={1500}
        payments={[{ method: 'transfer', amount: 1500 }]}
        onChange={jest.fn()}
      />
    );

    const cashButton = screen.getByTestId('payment-cash-full');
    const transferButton = screen.getByTestId('payment-transfer-full');

    expect(cashButton).toHaveAttribute('aria-pressed', 'false');
    expect(transferButton).toHaveAttribute('aria-pressed', 'true');
  });

  test('muestra el badge Mixto cuando hay pago mixto', () => {
    render(
      <PaymentPartsInput
        total={1500}
        payments={[
          { method: 'cash', amount: 700 },
          { method: 'transfer', amount: 800 },
        ]}
        onChange={jest.fn()}
      />
    );

    expect(screen.getByTestId('payment-mixed-badge')).toHaveTextContent('Mixto');
    expect(
      screen.getByTestId('payment-remaining-badge')
    ).toHaveTextContent('Pago completo');
  });

  test('permite dividir el pago entre efectivo y transferencia', () => {
    function TestWrapper() {
      const [payments, setPayments] = useState<PaymentPart[]>([
        { method: 'cash', amount: 1500 },
      ]);
      return (
        <PaymentPartsInput
          total={1500}
          payments={payments}
          onChange={setPayments}
        />
      );
    }

    render(<TestWrapper />);

    fireEvent.change(screen.getByTestId('payment-transfer-input'), {
      target: { value: '500' },
    });

    expect(
      screen.getByTestId('payment-remaining-badge')
    ).toHaveTextContent('Sobran: $500.00');
    expect(
      screen.getByTestId('payment-mixed-badge')
    ).toHaveTextContent('Mixto');

    fireEvent.change(screen.getByTestId('payment-cash-input'), {
      target: { value: '1000' },
    });

    expect(
      screen.getByTestId('payment-remaining-badge')
    ).toHaveTextContent('Pago completo');
    expect(
      screen.getByTestId('payment-cash-input')
    ).toHaveValue(1000);
    expect(
      screen.getByTestId('payment-transfer-input')
    ).toHaveValue(500);
  });

  test('cambia a todo efectivo o todo transferencia al presionar los botones', () => {
    const onChange = jest.fn();
    render(
      <PaymentPartsInput
        total={1500}
        payments={[
          { method: 'cash', amount: 700 },
          { method: 'transfer', amount: 800 },
        ]}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByTestId('payment-cash-full'));
    expect(onChange).toHaveBeenCalledWith([{ method: 'cash', amount: 1500 }]);

    fireEvent.click(screen.getByTestId('payment-transfer-full'));
    expect(onChange).toHaveBeenCalledWith([
      { method: 'transfer', amount: 1500 },
    ]);
  });
});
