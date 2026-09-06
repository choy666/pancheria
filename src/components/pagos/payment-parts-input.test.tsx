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

  test('permite dividir el pago entre efectivo y transferencia de forma explícita', () => {
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

    const cashInput = screen.getByTestId('payment-cash-input');
    const transferInput = screen.getByTestId('payment-transfer-input');

    // Escribir en transferencia mientras el efectivo cubre todo no modifica
    // el efectivo: el monto queda en 0 porque no hay resto disponible.
    fireEvent.change(transferInput, { target: { value: '500' } });
    fireEvent.blur(transferInput);

    expect(
      screen.getByTestId('payment-remaining-badge')
    ).toHaveTextContent('Pago completo');
    expect(
      screen.queryByTestId('payment-mixed-badge')
    ).not.toBeInTheDocument();
    expect(transferInput).toHaveValue('');

    // El reparto es explícito: primero se baja el efectivo.
    fireEvent.change(cashInput, { target: { value: '1000' } });
    fireEvent.blur(cashInput);

    expect(
      screen.getByTestId('payment-remaining-badge')
    ).toHaveTextContent('Faltan: $ 500');
    expect(cashInput).toHaveValue('1.000');

    fireEvent.change(transferInput, { target: { value: '500' } });

    expect(
      screen.getByTestId('payment-remaining-badge')
    ).toHaveTextContent('Pago completo');
    expect(
      screen.getByTestId('payment-mixed-badge')
    ).toHaveTextContent('Mixto');
    expect(transferInput).toHaveValue('500');
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

    // En es-AR la coma es el separador decimal.
    fireEvent.change(screen.getByTestId('payment-cash-input'), {
      target: { value: '500,70' },
    });

    expect(onChange).toHaveBeenLastCalledWith([{ method: 'cash', amount: 501 }]);
  });

  test('muestra el monto con separador de miles al salir del campo', () => {
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

    const input = screen.getByTestId('payment-cash-input');
    fireEvent.change(input, { target: { value: '2500' } });
    expect(input).toHaveValue('2500');

    fireEvent.blur(input);
    expect(input).toHaveValue('2.500');
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

  test('presionar Enter completa el resto con el mismo método', () => {
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
      { method: 'cash', amount: 1500 },
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

  test('el efectivo recibido se muestra y calcula el vuelto', () => {
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

    fireEvent.change(screen.getByTestId('payment-cash-received-input'), {
      target: { value: '2000' },
    });

    expect(
      screen.getByTestId('payment-received-line')
    ).toHaveTextContent('Recibido en efectivo: $ 2.000');
    expect(
      screen.getByTestId('payment-change-badge')
    ).toHaveTextContent('Vuelto: $ 500');
    expect(
      screen.getByTestId('payment-remaining-badge')
    ).toHaveTextContent('Pago completo');
  });

  test('el vuelto se resetea cuando cambia el total de la venta', () => {
    function TestWrapper() {
      const [payments, setPayments] = useState<PaymentPart[]>([]);
      const [total, setTotal] = useState(1500);
      return (
        <>
          <button
            data-testid="change-total"
            onClick={() => {
              setTotal(0);
              setPayments([]);
            }}
          >
            cambiar
          </button>
          <PaymentPartsInput
            total={total}
            payments={payments}
            onChange={setPayments}
          />
        </>
      );
    }

    render(<TestWrapper />);

    fireEvent.click(screen.getByTestId('payment-cash-bill-2000'));
    expect(
      screen.getByTestId('payment-change-badge')
    ).toHaveTextContent('Vuelto: $ 500');

    fireEvent.click(screen.getByTestId('change-total'));

    expect(
      screen.queryByTestId('payment-received-line')
    ).not.toBeInTheDocument();
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
