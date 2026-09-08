/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { PedidoSuccessDialog } from './pedido-success-dialog';
import type { CreatedOrder } from './usePedidoClient';
import type { Branch } from '@/domain/types';

function makeBranch(overrides: Partial<Branch> = {}): Branch {
  return { id: 1, name: 'Sucursal A', openingHours: [], createdAt: new Date(), ...overrides };
}

function makeOrder(overrides: Partial<CreatedOrder> = {}): CreatedOrder {
  return {
    id: 42,
    orderNumber: 'PED-1-1234567890-abc',
    status: 'pending',
    total: 1200,
    customerName: 'Juan Pérez',
    customerPhone: '3415555555',
    deliveryType: 'pickup',
    address: null,
    notes: null,
    cancellationToken: 'token',
    branchName: 'Sucursal A',
    items: [
      {
        productId: 1,
        name: 'Panchuque',
        price: 1200,
        unit: 'unidad',
        quantity: 1,
      },
    ],
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    ...overrides,
  };
}

function renderDialog(order: CreatedOrder, branch = makeBranch()) {
  return render(
    <PedidoSuccessDialog
      open
      onOpenChange={jest.fn()}
      createdOrder={order}
      branch={branch}
      cancellationReason=""
      setCancellationReason={jest.fn()}
      isCancelling={false}
      cancellationError={null}
      onCancel={jest.fn()}
      onGoToChat={jest.fn()}
    />
  );
}

describe('PedidoSuccessDialog', () => {
  test('muestra el horario de retiro estimado para pedidos de retiro', () => {
    const openingHours = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
      dayOfWeek,
      open: '08:00',
      close: '23:59',
    }));

    renderDialog(makeOrder(), makeBranch({ openingHours }));

    expect(
      screen.getByText(/Horario de retiro estimado:/)
    ).toBeInTheDocument();
  });

  test('muestra la dirección de envío en lugar del horario de retiro para delivery', () => {
    renderDialog(
      makeOrder({ deliveryType: 'delivery', address: 'Calle Falsa 123' })
    );

    expect(
      screen.getByText(/Enviaremos tu pedido a:/)
    ).toBeInTheDocument();
    expect(screen.getByText('Calle Falsa 123')).toBeInTheDocument();
    expect(
      screen.queryByText(/Horario de retiro estimado/)
    ).not.toBeInTheDocument();
  });

  test('no muestra texto crudo cuando la sucursal no tiene horarios', () => {
    renderDialog(makeOrder(), makeBranch({ openingHours: [] }));

    expect(
      screen.queryByText('No hay horarios de apertura configurados.')
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Consultá el horario por el chat/)).toBeInTheDocument();
  });

  test('destaca el número de pedido con botón para copiar', () => {
    renderDialog(makeOrder());

    expect(screen.getByTestId('order-success-number')).toHaveTextContent(
      'PED-1-1234567890-abc'
    );
    expect(
      screen.getByRole('button', { name: /Copiar número/ })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Guardalo para seguir tu pedido/)
    ).toBeInTheDocument();
  });

  test('la cancelación queda dentro de un bloque colapsable', () => {
    renderDialog(makeOrder());

    expect(
      screen.getByText('¿Necesitás cancelar el pedido?')
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Motivo de cancelación/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Cancelar pedido' })
    ).toBeInTheDocument();
  });
});
