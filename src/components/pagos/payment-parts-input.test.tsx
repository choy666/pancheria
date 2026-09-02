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
    ).toHaveTextContent('Pago completo');
    expect(
      screen.getByTestId('payment-mixed-badge')
    ).toHaveTextContent('Mixto');

    fireEvent.change(screen.getByTestId('payment-cash-input'), {
      target: { value: '800' },
    });

    expect(
      screen.getByTestId('payment-remaining-badge')
    ).toHaveTextContent('Faltan: $ 200');
    expect(
      screen.getByTestId('payment-cash-input')
    ).toHaveValue('800');
    expect(
      screen.getByTestId('payment-transfer-input')
    ).toHaveValue('500');

    fireEvent.change(screen.getByTestId('payment-cash-input'), {
      target: { value: '1000' },
    });

    expect(
      screen.getByTestId('payment-remaining-badge')
    ).toHaveTextContent('Pago completo');
    expect(
      screen.getByTestId('payment-cash-input')
    ).toHaveValue('1000');
    expect(
      screen.getByTestId('payment-transfer-input')
    ).toHaveValue('500');
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

  test('redondea los montos decimales al entero más cercano', () => {
    const onChange = jest.fn();
    render(
      <PaymentPartsInput
        total={1500}
        payments={[{ method: 'cash', amount: 1500 }]}
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByTestId('payment-cash-input'), {
      target: { value: '500.70' },
    });

    expect(onChange).toHaveBeenLastCalledWith([{ method: 'cash', amount: 501 }]);
  });

  test('los botones de denominación suman al monto actual sin superar el total', () => {
    const onChange = jest.fn();
    render(
      <PaymentPartsInput
        total={5000}
        payments={[{ method: 'cash', amount: 1000 }]}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByTestId('payment-cash-denom-2000'));

    expect(onChange).toHaveBeenLastCalledWith([{ method: 'cash', amount: 3000 }]);

    fireEvent.click(screen.getByTestId('payment-cash-denom-5000'));

    expect(onChange).toHaveBeenLastCalledWith([{ method: 'cash', amount: 5000 }]);
  });

  test('el botón Completar resto rellena el monto faltante', () => {
    const onChange = jest.fn();
    render(
      <PaymentPartsInput
        total={5000}
        payments={[{ method: 'cash', amount: 1000 }]}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByTestId('payment-cash-complete-rest'));

    expect(onChange).toHaveBeenLastCalledWith([{ method: 'cash', amount: 5000 }]);
  });

  test('muestra el monto restante formateado con separador de miles', () => {
    render(
      <PaymentPartsInput
        total={15000}
        payments={[{ method: 'cash', amount: 5000 }]}
        onChange={jest.fn()}
      />
    );

    expect(
      screen.getByTestId('payment-remaining-badge')
    ).toHaveTextContent('Faltan: $ 10.000');
  });

  test('el botón Completar con transferencia divide el pago restante', () => {
    const onChange = jest.fn();
    render(
      <PaymentPartsInput
        total={5000}
        payments={[{ method: 'cash', amount: 1000 }]}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByTestId('payment-cash-complete-other'));

    expect(onChange).toHaveBeenLastCalledWith([
      { method: 'cash', amount: 1000 },
      { method: 'transfer', amount: 4000 },
    ]);
  });

  test('pagar con un billete común ajusta el pago al total y muestra el vuelto', () => {
    function TestWrapper() {
      const [payments, setPayments] = useState<PaymentPart[]>([]);
      return (
        <PaymentPartsInput
          total={1500}
          payments={payments}
          onChange={setPayments}
        />
      );
    }

    render(<TestWrapper />);

    fireEvent.click(screen.getByTestId('payment-cash-bill-2000'));

    expect(
      screen.getByTestId('payment-change-badge')
    ).toHaveTextContent('Vuelto: $ 500');
    expect(
      screen.getByTestId('payment-remaining-badge')
    ).toHaveTextContent('Pago completo');
  });

  test('pagar con varios billetes acumula el entregado y calcula el vuelto', () => {
    function TestWrapper() {
      const [payments, setPayments] = useState<PaymentPart[]>([]);
      return (
        <PaymentPartsInput
          total={1500}
          payments={payments}
          onChange={setPayments}
        />
      );
    }

    render(<TestWrapper />);

    fireEvent.click(screen.getByTestId('payment-cash-bill-1000'));
    fireEvent.click(screen.getByTestId('payment-cash-bill-1000'));

    expect(
      screen.getByTestId('payment-change-badge')
    ).toHaveTextContent('Vuelto: $ 500');
    expect(
      screen.getByTestId('payment-remaining-badge')
    ).toHaveTextContent('Pago completo');
  });

  test('pagar con un billete menor al total deja un pago parcial', () => {
    function TestWrapper() {
      const [payments, setPayments] = useState<PaymentPart[]>([]);
      return (
        <PaymentPartsInput
          total={5000}
          payments={payments}
          onChange={setPayments}
        />
      );
    }

    render(<TestWrapper />);

    fireEvent.click(screen.getByTestId('payment-cash-bill-2000'));

    expect(
      screen.getByTestId('payment-remaining-badge')
    ).toHaveTextContent('Faltan: $ 3.000');
  });

  test('presionar Enter completa el pago con el otro método', () => {
    const onChange = jest.fn();
    render(
      <PaymentPartsInput
        total={1500}
        payments={[{ method: 'cash', amount: 1000 }]}
        onChange={onChange}
      />
    );

    const input = screen.getByTestId('payment-cash-input');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenLastCalledWith([
      { method: 'cash', amount: 1000 },
      { method: 'transfer', amount: 500 },
    ]);
  });

  test('presionar Escape vuelve al pago completo en efectivo', () => {
    const onChange = jest.fn();
    render(
      <PaymentPartsInput
        total={1500}
        payments={[
          { method: 'cash', amount: 500 },
          { method: 'transfer', amount: 500 },
        ]}
        onChange={onChange}
      />
    );

    const input = screen.getByTestId('payment-transfer-input');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onChange).toHaveBeenLastCalledWith([{ method: 'cash', amount: 1500 }]);
  });

  test('el botón Limpiar pago vuelve al estado inicial', () => {
    const onChange = jest.fn();
    render(
      <PaymentPartsInput
        total={1500}
        payments={[
          { method: 'cash', amount: 700 },
          { method: 'transfer', amount: 500 },
        ]}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByTestId('payment-clear'));

    expect(onChange).toHaveBeenLastCalledWith([]);
  });
});
