/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import {
  SupplySearchableSelect,
  type Supply,
} from './supply-searchable-select';

const pan: Supply = {
  id: 1,
  name: 'Pan baguette',
  type: 'critical_supply',
  criticalSupplyType: 'bread',
  unit: 'unidad',
  stock: 10,
};

const salchicha: Supply = {
  id: 2,
  name: 'Salchicha parrillera',
  type: 'critical_supply',
  criticalSupplyType: 'sausage',
  unit: 'unidad',
  stock: 5,
};

const jamon: Supply = {
  id: 3,
  name: 'Jamón cocido',
  type: 'manual_supply',
  criticalSupplyType: null,
  unit: 'paquete',
  stock: 3,
};

const gaseosa: Supply = {
  id: 4,
  name: 'Gaseosa cola',
  type: 'critical_supply',
  criticalSupplyType: 'beverage',
  unit: 'botella',
  stock: 20,
};

const supplies = [pan, salchicha, jamon, gaseosa];

function renderSelect(props?: Partial<Parameters<typeof SupplySearchableSelect>[0]>) {
  const onChange = jest.fn();
  render(
    <SupplySearchableSelect
      data-testid="supply-select"
      supplies={supplies}
      value={0}
      onChange={onChange}
      {...props}
    />
  );
  return { onChange };
}

describe('SupplySearchableSelect', () => {
  beforeEach(() => {
    // jsdom no implementa estas APIs, requeridas por el popup posicionado
    // (floating-ui) y el scroll del item activo de Base UI.
    Element.prototype.scrollIntoView = jest.fn();
    Element.prototype.hasPointerCapture = jest.fn(() => false);
    Element.prototype.setPointerCapture = jest.fn();
    Element.prototype.releasePointerCapture = jest.fn();
    if (!('ResizeObserver' in window)) {
      class ResizeObserverMock {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
      (window as unknown as { ResizeObserver: unknown }).ResizeObserver =
        ResizeObserverMock;
    }
  });

  test('muestra el placeholder y abre el listado agrupado con el grupo preferido primero', () => {
    renderSelect({ preferredGroupKey: 'sausage' });

    const trigger = screen.getByTestId('supply-select');
    expect(trigger).toHaveTextContent('Seleccionar insumo');

    fireEvent.click(trigger);

    const listbox = screen.getByRole('listbox');
    expect(listbox).toBeInTheDocument();

    const groupLabels = screen.getAllByText(/^Insumos críticos|^Insumo manual/);
    expect(groupLabels[0]).toHaveTextContent('Salchicha');
    expect(groupLabels[1]).toHaveTextContent('Pan');
  });

  test('filtra sin tildes y por palabras sueltas, y la selección devuelve supply.id', () => {
    const { onChange } = renderSelect();

    fireEvent.click(screen.getByTestId('supply-select'));
    fireEvent.change(
      screen.getByPlaceholderText('Buscar por nombre, tipo o unidad'),
      { target: { value: 'jamon paq' } }
    );

    const option = screen.getByRole('option', { name: /Jamón cocido/ });
    expect(option).toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: /Salchicha/ })
    ).not.toBeInTheDocument();

    fireEvent.click(option);
    expect(onChange).toHaveBeenCalledWith(3);
  });

  test('muestra mensaje vacío cuando el filtro no encuentra insumos', () => {
    renderSelect();

    fireEvent.click(screen.getByTestId('supply-select'));
    fireEvent.change(
      screen.getByPlaceholderText('Buscar por nombre, tipo o unidad'),
      { target: { value: 'xxxx inexistente' } }
    );

    expect(
      screen.getByText('No se encontraron insumos. Probá con otro término.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });

  test('cierra con Escape y al click afuera, y click en opción selecciona sin cierre prematuro', () => {
    const { onChange } = renderSelect();
    const trigger = screen.getByTestId('supply-select');

    fireEvent.click(trigger);
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Escape',
    });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    fireEvent.click(trigger);
    fireEvent.click(
      screen.getByRole('option', { name: /Pan baguette/ })
    );
    expect(onChange).toHaveBeenCalledWith(1);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    fireEvent.click(trigger);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  test('muestra el insumo seleccionado en el trigger y marca la opción', () => {
    renderSelect({ value: salchicha.id });

    expect(screen.getByTestId('supply-select')).toHaveTextContent(
      'Salchicha parrillera (unidad) — Salchicha'
    );

    fireEvent.click(screen.getByTestId('supply-select'));
    const option = screen.getByRole('option', {
      name: /Salchicha parrillera/,
    });
    expect(option).toHaveAttribute('data-selected');
  });
});
