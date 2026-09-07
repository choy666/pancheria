/**
 * @jest-environment jsdom
 */
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaymentPartsInput } from './payment-parts-input';
import type { PaymentPart } from '@/domain/types';

describe('PaymentPartsInput', () => {
  test('muestra los montos iniciales por medio de pago', () => {
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

    expect(screen.getByTestId('payment-cash-input')).toHaveValue('700');
    expect(screen.getByTestId('payment-transfer-input')).toHaveValue('800');
    expect(screen.getByTestId('payment-remaining-message')).toHaveTextContent(
      'Pago completo'
    );
  });

  test('muestra el monto faltante cuando la suma no alcanza el total', () => {
    render(
      <PaymentPartsInput
        total={1500}
        payments={[{ method: 'cash', amount: 1000 }]}
        onChange={jest.fn()}
      />
    );

    expect(screen.getByTestId('payment-remaining-message')).toHaveTextContent(
      'Faltan $ 500'
    );
  });

  test('muestra el monto sobrante cuando la suma supera el total', () => {
    render(
      <PaymentPartsInput
        total={1500}
        payments={[
          { method: 'cash', amount: 1000 },
          { method: 'transfer', amount: 800 },
        ]}
        onChange={jest.fn()}
      />
    );

    expect(screen.getByTestId('payment-remaining-message')).toHaveTextContent(
      'Sobran $ 300'
    );
  });

  test('permite ingresar un pago mixto entre efectivo y transferencia', () => {
    function TestWrapper() {
      const [payments, setPayments] = useState<PaymentPart[]>([
        { method: 'cash', amount: 1500 },
        { method: 'transfer', amount: 0 },
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

    const transferInput = screen.getByTestId('payment-transfer-input');
    fireEvent.change(transferInput, { target: { value: '500' } });

    expect(transferInput).toHaveValue('500');

    const cashInput = screen.getByTestId('payment-cash-input');
    fireEvent.change(cashInput, { target: { value: '1000' } });

    expect(cashInput).toHaveValue('1000');
    expect(screen.getByTestId('payment-remaining-message')).toHaveTextContent(
      'Pago completo'
    );
  });

  test('completa el pago con el botón Todo en efectivo', () => {
    const onChange = jest.fn();
    render(
      <PaymentPartsInput
        total={1500}
        payments={[
          { method: 'cash', amount: 0 },
          { method: 'transfer', amount: 0 },
        ]}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByTestId('payment-cash-full'));

    expect(onChange).toHaveBeenLastCalledWith([
      { method: 'cash', amount: 1500 },
      { method: 'transfer', amount: 0 },
    ]);
  });

  test('completa el pago con el botón Todo en transferencia', () => {
    const onChange = jest.fn();
    render(
      <PaymentPartsInput
        total={1500}
        payments={[
          { method: 'cash', amount: 0 },
          { method: 'transfer', amount: 0 },
        ]}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByTestId('payment-transfer-full'));

    expect(onChange).toHaveBeenLastCalledWith([
      { method: 'cash', amount: 0 },
      { method: 'transfer', amount: 1500 },
    ]);
  });

  test('notifica el cambio con ambos métodos de pago', () => {
    const onChange = jest.fn();
    render(
      <PaymentPartsInput
        total={1500}
        payments={[
          { method: 'cash', amount: 1000 },
          { method: 'transfer', amount: 0 },
        ]}
        onChange={onChange}
      />
    );

    const transferInput = screen.getByTestId('payment-transfer-input');
    fireEvent.change(transferInput, { target: { value: '500' } });

    expect(onChange).toHaveBeenLastCalledWith([
      { method: 'cash', amount: 1000 },
      { method: 'transfer', amount: 500 },
    ]);
  });
});
