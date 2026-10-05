/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import { PromoOptionsDialog } from './promo-options-dialog';
import type { RecipeItemConfig } from '@/domain/types';

jest.mock('next/image', () => ({
  __esModule: true,
  default: function Image({
    src,
    alt,
    className,
    onError,
  }: React.ImgHTMLAttributes<HTMLImageElement>) {
    // El mock solo simula el renderizado de `next/image` en JSDOM.
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={alt} src={src} className={className} onError={onError} />;
  },
}));

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

  function renderDialog(props: Partial<Parameters<typeof PromoOptionsDialog>[0]> = {}) {
    return render(
      <PromoOptionsDialog
        open
        onOpenChange={jest.fn()}
        productName="Promo"
        productPrice={1500}
        recipe={baseRecipe}
        onConfirm={jest.fn()}
        {...props}
      />
    );
  }

  test('los insumos no opcionales ya no se listan como filas', () => {
    renderDialog();

    expect(screen.queryByText('Pan')).not.toBeInTheDocument();
    expect(screen.queryByText('Caja')).not.toBeInTheDocument();
    expect(screen.queryByText('Incluye')).not.toBeInTheDocument();
  });

  test('los opcionales se agrupan en "A tu gusto" (manuales) y "Sumale" (servicios)', () => {
    renderDialog();

    const gusto = screen.getByText('A tu gusto').closest('section')!;
    const sumale = screen.getByText('Sumale').closest('section')!;

    expect(
      within(gusto).getByRole('switch', { name: /Incluir Ketchup en Promo/ })
    ).toBeInTheDocument();
    expect(
      within(gusto).getByRole('switch', { name: /Incluir Mayonesa en Promo/ })
    ).toBeInTheDocument();
    expect(
      within(sumale).getByRole('switch', {
        name: /Incluir Vaso de gaseosa en Promo/,
      })
    ).toBeInTheDocument();
    expect(
      within(sumale).getByRole('switch', {
        name: /Incluir Servilleta extra en Promo/,
      })
    ).toBeInTheDocument();
  });

  test('los toggles respetan selectedByDefault y muestran su estado en texto', () => {
    renderDialog();

    const ketchup = screen.getByRole('switch', {
      name: /Incluir Ketchup en Promo/,
    });
    const mayonesa = screen.getByRole('switch', {
      name: /Incluir Mayonesa en Promo/,
    });

    expect(ketchup).toHaveAttribute('aria-checked', 'true');
    expect(ketchup).toHaveTextContent('Lleva');
    expect(mayonesa).toHaveAttribute('aria-checked', 'false');
    expect(mayonesa).toHaveTextContent('Sin Mayonesa');
  });

  test('confirmar emite los ids seleccionados y cantidad 1 por defecto', () => {
    const onConfirm = jest.fn();
    renderDialog({ onConfirm });

    fireEvent.click(screen.getByTestId('promo-options-confirm'));

    expect(onConfirm).toHaveBeenCalledWith({
      selectedRecipeItemIds: [2, 4],
      quantity: 1,
      notes: null,
    });
  });

  test('el CTA muestra el precio por unidad', () => {
    renderDialog();

    expect(
      screen.getByRole('button', { name: 'Agregar · $ 1.500' })
    ).toBeInTheDocument();
  });

  test('desactivar un opcional lo excluye de los ids confirmados', () => {
    const onConfirm = jest.fn();
    renderDialog({ onConfirm });

    fireEvent.click(
      screen.getByRole('switch', { name: /Incluir Ketchup en Promo/ })
    );
    fireEvent.click(screen.getByTestId('promo-options-confirm'));

    expect(onConfirm).toHaveBeenCalledWith({
      selectedRecipeItemIds: [4],
      quantity: 1,
      notes: null,
    });
  });

  test('el stepper incrementa la cantidad y el CTA refleja el total', () => {
    const onConfirm = jest.fn();
    renderDialog({ onConfirm });

    fireEvent.click(screen.getByTestId('promo-quantity-increase'));
    fireEvent.click(screen.getByTestId('promo-quantity-increase'));

    expect(screen.getByTestId('promo-quantity-value')).toHaveTextContent('3');
    expect(
      screen.getByRole('button', { name: 'Agregar · $ 4.500' })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('promo-options-confirm'));

    expect(onConfirm).toHaveBeenCalledWith({
      selectedRecipeItemIds: [2, 4],
      quantity: 3,
      notes: null,
    });
  });

  test('el stepper no baja de 1', () => {
    renderDialog();

    const decrease = screen.getByTestId('promo-quantity-decrease');
    expect(decrease).toBeDisabled();
    expect(screen.getByTestId('promo-quantity-value')).toHaveTextContent('1');
  });

  test('maxQuantity limita el stepper', () => {
    renderDialog({ maxQuantity: 2 });

    const increase = screen.getByTestId('promo-quantity-increase');
    fireEvent.click(increase);
    fireEvent.click(increase);

    expect(screen.getByTestId('promo-quantity-value')).toHaveTextContent('2');
    expect(increase).toBeDisabled();
  });

  test('en modo edición no hay stepper y el CTA es "Guardar cambios"', () => {
    const onConfirm = jest.fn();
    renderDialog({
      onConfirm,
      initialSelectedIds: [2, 4],
      mode: 'edit',
    });

    expect(
      screen.queryByTestId('promo-quantity-increase')
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('switch', { name: /Incluir Mayonesa en Promo/ })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(onConfirm).toHaveBeenCalledWith({
      selectedRecipeItemIds: [2, 4, 3],
      quantity: 1,
      notes: null,
    });
  });

  test('confirmLabel personaliza el CTA en modo agregar', () => {
    renderDialog({ confirmLabel: 'Agregar a la venta' });

    expect(
      screen.getByRole('button', { name: 'Agregar a la venta · $ 1.500' })
    ).toBeInTheDocument();
  });

  test('la variante pública marca el contenido con el scope de tema claro y muestra el hero', () => {
    renderDialog({ variant: 'public' });

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('data-theme', 'light');
    expect(
      within(dialog).getByRole('img', {
        name: 'Imagen no disponible para Promo',
      })
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: 'Cerrar' })
    ).toBeInTheDocument();
  });

  test('la variante pública renderiza la imagen del producto en el hero', () => {
    renderDialog({ variant: 'public', imageUrl: '/img/promo.png' });

    expect(
      screen.getByAltText('Imagen de Promo')
    ).toBeInTheDocument();
  });

  test('la variante de ventas no aplica el scope claro ni el hero', () => {
    renderDialog({ description: 'Descripción de promo' });

    expect(screen.getByRole('dialog')).not.toHaveAttribute('data-theme');
    expect(
      screen.queryByRole('img', { name: /Imagen/ })
    ).not.toBeInTheDocument();
    expect(screen.getByText('Descripción de promo')).toBeInTheDocument();
  });

  test('muestra el campo de aclaraciones con placeholder y límite', () => {
    renderDialog();

    const notes = screen.getByRole('textbox', { name: 'Aclaraciones' });
    expect(notes).toHaveAttribute('placeholder', 'Ej: bien tostado');
    expect(notes).toHaveAttribute('maxLength', '200');
  });

  test('confirmar emite la aclaración recortada', () => {
    const onConfirm = jest.fn();
    renderDialog({ onConfirm });

    fireEvent.change(screen.getByRole('textbox', { name: 'Aclaraciones' }), {
      target: { value: '  bien tostado  ' },
    });
    fireEvent.click(screen.getByTestId('promo-options-confirm'));

    expect(onConfirm).toHaveBeenCalledWith({
      selectedRecipeItemIds: [2, 4],
      quantity: 1,
      notes: 'bien tostado',
    });
  });

  test('la aclaración vacía se confirma como null', () => {
    const onConfirm = jest.fn();
    renderDialog({ onConfirm });

    fireEvent.change(screen.getByRole('textbox', { name: 'Aclaraciones' }), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByTestId('promo-options-confirm'));

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ notes: null })
    );
  });

  test('en modo edición precarga la aclaración existente', () => {
    renderDialog({ mode: 'edit', initialNotes: 'sin sal' });

    expect(
      screen.getByRole('textbox', { name: 'Aclaraciones' })
    ).toHaveValue('sin sal');
  });

  test('en modo edición de un producto sin opcionales solo se ven las aclaraciones', () => {
    renderDialog({ recipe: [], mode: 'edit' });

    expect(screen.queryByText('A tu gusto')).not.toBeInTheDocument();
    expect(screen.queryByText('Sumale')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('promo-quantity-increase')
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: 'Aclaraciones' })
    ).toBeInTheDocument();
  });

  test('al llegar al tope se deshabilitan los opcionales no seleccionados', () => {
    // La selección por defecto (Ketchup + Vaso) ya llega al tope de 2.
    renderDialog({ maxOptionalSelections: 2 });

    expect(screen.getByTestId('promo-options-limit')).toHaveTextContent(
      'Podés elegir hasta 2 opcionales (llevas 2)'
    );
    expect(
      screen.getByRole('switch', { name: /Incluir Mayonesa en Promo/ })
    ).toBeDisabled();
    expect(
      screen.getByRole('switch', { name: /Incluir Servilleta extra en Promo/ })
    ).toBeDisabled();
    // Los ya seleccionados siguen habilitados para poder quitarlos.
    expect(
      screen.getByRole('switch', { name: /Incluir Ketchup en Promo/ })
    ).not.toBeDisabled();
  });

  test('al liberar un lugar bajo el tope se puede volver a agregar', () => {
    renderDialog({ maxOptionalSelections: 2 });

    fireEvent.click(
      screen.getByRole('switch', { name: /Incluir Ketchup en Promo/ })
    );

    const mayonesa = screen.getByRole('switch', {
      name: /Incluir Mayonesa en Promo/,
    });
    expect(mayonesa).not.toBeDisabled();

    fireEvent.click(mayonesa);
    expect(mayonesa).toHaveAttribute('aria-checked', 'true');
    expect(
      screen.getByRole('switch', { name: /Incluir Servilleta extra en Promo/ })
    ).toBeDisabled();
    expect(screen.getByTestId('promo-options-limit')).toHaveTextContent(
      'llevas 2'
    );
  });

  test('una selección inicial por encima del tope permite quitar pero no confirmar', () => {
    renderDialog({
      maxOptionalSelections: 1,
      initialSelectedIds: [2, 4],
      mode: 'edit',
    });

    expect(screen.getByTestId('promo-options-limit')).toHaveTextContent(
      'el máximo es 1'
    );
    expect(
      screen.getByRole('button', { name: 'Guardar cambios' })
    ).toBeDisabled();

    fireEvent.click(
      screen.getByRole('switch', { name: /Incluir Ketchup en Promo/ })
    );

    expect(
      screen.getByRole('button', { name: 'Guardar cambios' })
    ).not.toBeDisabled();
  });

  test('sin tope no hay contador ni toggles deshabilitados', () => {
    renderDialog();

    expect(
      screen.queryByTestId('promo-options-limit')
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('switch', { name: /Incluir Servilleta extra en Promo/ })
    ).not.toBeDisabled();
  });
});
