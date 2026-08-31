/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { PromoOptionsDialog } from './promo-options-dialog';
import type { RecipeItemConfig } from '@/domain/types';

describe('PromoOptionsDialog', () => {
  const baseRecipe: RecipeItemConfig[] = [
    {
      supplyId: 1,
      supplyName: 'Pan',
      supplyType: 'critical_supply',
      quantity: 1,
      autoDiscount: true,
      isOptional: false,
      selected: true,
      selectedByDefault: true,
    },
    {
      supplyId: 2,
      supplyName: 'Ketchup',
      supplyType: 'manual_supply',
      quantity: 1,
      autoDiscount: false,
      isOptional: true,
      selected: true,
      selectedByDefault: true,
    },
    {
      supplyId: 3,
      supplyName: 'Mayonesa',
      supplyType: 'manual_supply',
      quantity: 1,
      autoDiscount: false,
      isOptional: true,
      selected: false,
      selectedByDefault: false,
    },
    {
      supplyId: 4,
      supplyName: 'Vaso de gaseosa',
      supplyType: 'service',
      quantity: 1,
      autoDiscount: false,
      isOptional: true,
      selected: true,
      selectedByDefault: true,
    },
    {
      supplyId: 5,
      supplyName: 'Servilleta extra',
      supplyType: 'service',
      quantity: 1,
      autoDiscount: false,
      isOptional: true,
      selected: false,
      selectedByDefault: false,
    },
    {
      supplyId: 6,
      supplyName: 'Caja',
      supplyType: 'manual_supply',
      quantity: 1,
      autoDiscount: false,
      isOptional: false,
      selected: true,
      selectedByDefault: true,
    },
  ];

  test('los críticos se renderizan en Siempre incluye y no se pueden desmarcar', () => {
    render(
      <PromoOptionsDialog
        open
        onOpenChange={jest.fn()}
        productName="Promo"
        productPrice={1500}
        recipe={baseRecipe}
        onConfirm={jest.fn()}
      />
    );

    expect(screen.getByText('Siempre incluye')).toBeInTheDocument();
    expect(screen.getByText('Pan (1)')).toBeInTheDocument();
    expect(screen.getByText('Caja (1)')).toBeInTheDocument();

    expect(
      screen.queryByRole('checkbox', { name: /Incluir Pan en Promo/ })
    ).not.toBeInTheDocument();
  });

  test('los insumos manuales y servicios opcionales se renderizan en secciones separadas', () => {
    render(
      <PromoOptionsDialog
        open
        onOpenChange={jest.fn()}
        productName="Promo"
        productPrice={1500}
        recipe={baseRecipe}
        onConfirm={jest.fn()}
      />
    );

    expect(screen.getByText('Insumos opcionales')).toBeInTheDocument();
    expect(screen.getByText('Servicios / extras')).toBeInTheDocument();

    expect(screen.getByLabelText(/Incluir Ketchup en Promo/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Incluir Mayonesa en Promo/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Incluir Vaso de gaseosa en Promo/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Incluir Servilleta extra en Promo/)).toBeInTheDocument();
  });

  test('los ítems opcionales se preseleccionan según selectedByDefault', () => {
    render(
      <PromoOptionsDialog
        open
        onOpenChange={jest.fn()}
        productName="Promo"
        productPrice={1500}
        recipe={baseRecipe}
        onConfirm={jest.fn()}
      />
    );

    expect(screen.getByLabelText(/Incluir Ketchup en Promo/)).toBeChecked();
    expect(screen.getByLabelText(/Incluir Mayonesa en Promo/)).not.toBeChecked();
    expect(screen.getByLabelText(/Incluir Vaso de gaseosa en Promo/)).toBeChecked();
    expect(screen.getByLabelText(/Incluir Servilleta extra en Promo/)).not.toBeChecked();
  });

  test('un insumo manual o service con isOptional = false aparece en Siempre incluye', () => {
    const recipe: RecipeItemConfig[] = [
      ...baseRecipe,
      {
        supplyId: 7,
        supplyName: 'Aderezo obligatorio',
        supplyType: 'manual_supply',
        quantity: 1,
        autoDiscount: false,
        isOptional: false,
        selected: true,
        selectedByDefault: true,
      },
    ];

    render(
      <PromoOptionsDialog
        open
        onOpenChange={jest.fn()}
        productName="Promo"
        productPrice={1500}
        recipe={recipe}
        onConfirm={jest.fn()}
      />
    );

    expect(screen.getByText('Aderezo obligatorio (1)')).toBeInTheDocument();
  });

  test('confirmar emite los ids seleccionados', () => {
    const onConfirm = jest.fn();
    render(
      <PromoOptionsDialog
        open
        onOpenChange={jest.fn()}
        productName="Promo"
        productPrice={1500}
        recipe={baseRecipe}
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(screen.getByText('Agregar al pedido'));

    expect(onConfirm).toHaveBeenCalledWith([2, 4]);
  });

  test('desmarcar un opcional lo excluye de los ids confirmados', () => {
    const onConfirm = jest.fn();
    render(
      <PromoOptionsDialog
        open
        onOpenChange={jest.fn()}
        productName="Promo"
        productPrice={1500}
        recipe={baseRecipe}
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(screen.getByLabelText(/Incluir Ketchup en Promo/));
    fireEvent.click(screen.getByText('Agregar al pedido'));

    expect(onConfirm).toHaveBeenCalledWith([4]);
  });

  test('muestra el resumen de ítems seleccionados', () => {
    render(
      <PromoOptionsDialog
        open
        onOpenChange={jest.fn()}
        productName="Promo"
        productPrice={1500}
        recipe={baseRecipe}
        onConfirm={jest.fn()}
      />
    );

    expect(screen.getByText(/Total: \$ 1\.500/)).toBeInTheDocument();
    expect(screen.getByText(/Incluye:/)).toBeInTheDocument();
  });
});
