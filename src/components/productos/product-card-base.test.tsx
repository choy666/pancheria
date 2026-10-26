/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ProductCardBase } from './product-card-base';
import type { ProductCardProduct } from './product-card-base';

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

function makeProduct(
  overrides: Partial<ProductCardProduct> = {}
): ProductCardProduct {
  return {
    id: 1,
    name: 'Panchuque',
    description: null,
    type: 'compound',
    criticalSupplyType: null,
    price: 1200,
    unit: 'unidad',
    imageUrl: null,
    availability: 5,
    recipe: [],
    ...overrides,
  };
}

describe('ProductCardBase', () => {
  describe('variant="catalog"', () => {
    test('muestra imagen, botón Agregar y testid por id', () => {
      render(
        <ProductCardBase
          variant="catalog"
          product={makeProduct({ imageUrl: '/img.png' })}
          isOutOfStock={false}
          onAdd={jest.fn()}
        />
      );

      expect(screen.getByTestId('product-card-1')).toBeInTheDocument();
      expect(screen.getByAltText('Imagen de Panchuque')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Agregar' })
      ).toBeInTheDocument();
    });

    test('muestra el fallback de marca cuando el producto no tiene imagen', () => {
      render(
        <ProductCardBase
          variant="catalog"
          product={makeProduct({ imageUrl: null })}
          isOutOfStock={false}
          onAdd={jest.fn()}
        />
      );

      expect(
        screen.getByRole('img', { name: 'Imagen no disponible para Panchuque' })
      ).toBeInTheDocument();
      expect(screen.getByText('P')).toBeInTheDocument();
    });

    test('muestra el pill Promo solo para productos compuestos', () => {
      const { rerender } = render(
        <ProductCardBase
          variant="catalog"
          product={makeProduct()}
          isOutOfStock={false}
          onAdd={jest.fn()}
        />
      );

      expect(screen.getByText('Promo')).toBeInTheDocument();

      rerender(
        <ProductCardBase
          variant="catalog"
          product={makeProduct({ type: 'critical_supply' })}
          isOutOfStock={false}
          onAdd={jest.fn()}
        />
      );

      expect(screen.queryByText('Promo')).not.toBeInTheDocument();
    });

    test('muestra la cantidad del pedido sobre el hero', () => {
      render(
        <ProductCardBase
          variant="catalog"
          product={makeProduct()}
          isOutOfStock={false}
          inCartQuantity={2}
          onAdd={jest.fn()}
        />
      );

      expect(
        screen.getByTestId('product-card-cart-quantity-1')
      ).toHaveTextContent('2 en tu pedido');
    });

    test('muestra "Agregar otro" cuando inCart es true aunque no haya cantidad', () => {
      render(
        <ProductCardBase
          variant="catalog"
          product={makeProduct()}
          isOutOfStock={false}
          inCart={true}
          onAdd={jest.fn()}
        />
      );

      expect(
        screen.getByRole('button', { name: 'Agregar otro' })
      ).toBeInTheDocument();
    });

    test('el botón Agregar hace quick-add con la selección por defecto', () => {
      const onAdd = jest.fn();
      const product = makeProduct({
        recipe: [
          {
            supplyId: 20,
            supplyName: 'Cebolla',
            supplyType: 'manual_supply',
            quantity: 1,
            autoDiscount: false,
            isOptional: true,
            selected: false,
            selectedByDefault: true,
          },
        ],
      });

      render(
        <ProductCardBase
          variant="catalog"
          product={product}
          isOutOfStock={false}
          onAdd={onAdd}
        />
      );

      fireEvent.click(screen.getByTestId('add-product-1'));
      expect(onAdd).toHaveBeenCalledWith();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('la superficie de la card hace quick-add una sola vez', () => {
      const onAdd = jest.fn();
      render(
        <ProductCardBase
          variant="catalog"
          product={makeProduct()}
          isOutOfStock={false}
          onAdd={onAdd}
        />
      );

      fireEvent.click(screen.getByTestId('add-product-surface-1'));
      expect(onAdd).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('la superficie queda deshabilitada cuando el producto está agotado', () => {
      const onAdd = jest.fn();
      render(
        <ProductCardBase
          variant="catalog"
          product={makeProduct()}
          isOutOfStock={true}
          onAdd={onAdd}
        />
      );

      const surface = screen.getByTestId('add-product-surface-1');
      expect(surface).toBeDisabled();
      fireEvent.click(surface);
      expect(onAdd).not.toHaveBeenCalled();
    });

    test('el botón circular abre el diálogo de personalización', () => {
      const onAdd = jest.fn();
      const product = makeProduct({
        recipe: [
          {
            supplyId: 20,
            supplyName: 'Cebolla',
            supplyType: 'manual_supply',
            quantity: 1,
            autoDiscount: false,
            isOptional: true,
            selected: false,
            selectedByDefault: false,
          },
        ],
      });

      render(
        <ProductCardBase
          variant="catalog"
          product={product}
          isOutOfStock={false}
          onAdd={onAdd}
        />
      );

      fireEvent.click(screen.getByTestId('customize-product-1'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(onAdd).not.toHaveBeenCalled();
    });

    test('el diálogo emite la selección y la cantidad del stepper', () => {
      const onAdd = jest.fn();
      const product = makeProduct({
        recipe: [
          {
            supplyId: 20,
            supplyName: 'Cebolla',
            supplyType: 'manual_supply',
            quantity: 1,
            autoDiscount: false,
            isOptional: true,
            selected: false,
            selectedByDefault: false,
          },
        ],
      });

      render(
        <ProductCardBase
          variant="catalog"
          product={product}
          isOutOfStock={false}
          onAdd={onAdd}
        />
      );

      fireEvent.click(screen.getByTestId('customize-product-1'));
      fireEvent.click(
        screen.getByRole('switch', { name: /Incluir Cebolla en Panchuque/ })
      );
      fireEvent.click(screen.getByTestId('promo-quantity-increase'));
      fireEvent.click(screen.getByTestId('promo-options-confirm'));

      expect(onAdd).toHaveBeenCalledWith({
        selectedRecipeItemIds: [20],
        quantity: 2,
        notes: null,
      });
    });

    test('no muestra el botón de personalización cuando no hay opcionales', () => {
      render(
        <ProductCardBase
          variant="catalog"
          product={makeProduct({ type: 'critical_supply' })}
          isOutOfStock={false}
          onAdd={jest.fn()}
        />
      );

      expect(
        screen.queryByTestId('customize-product-1')
      ).not.toBeInTheDocument();
    });

    test('muestra la disponibilidad cualitativa sin unidades ni cantidades en el catálogo', () => {
      render(
        <ProductCardBase
          variant="catalog"
          product={makeProduct({ unit: 'porción' })}
          isOutOfStock={false}
          onAdd={jest.fn()}
        />
      );

      expect(screen.getByTestId('product-availability')).toHaveTextContent(
        'Disponible'
      );
      expect(screen.getByTestId('product-availability')).not.toHaveTextContent(
        'porción'
      );
      expect(screen.getByTestId('product-availability')).not.toHaveTextContent(
        '5'
      );
    });
  });

  describe('variant="sales"', () => {
    test('la tarjeta es presentacional y el botón Agregar llama onAdd', () => {
      const onAdd = jest.fn();
      render(
        <ProductCardBase
          variant="sales"
          product={makeProduct()}
          isOutOfStock={false}
          onAdd={onAdd}
        />
      );

      // Sin `role="button"` en el contenedor: no hay botones anidados.
      const card = screen.getByTestId('product-card');
      expect(card).not.toHaveAttribute('role');
      expect(card).not.toHaveAttribute('tabindex');

      fireEvent.click(screen.getByTestId('add-sale-product'));
      expect(onAdd).toHaveBeenCalledTimes(1);
    });

    test('la superficie de la card hace quick-add una sola vez', () => {
      const onAdd = jest.fn();
      render(
        <ProductCardBase
          variant="sales"
          product={makeProduct()}
          isOutOfStock={false}
          onAdd={onAdd}
        />
      );

      fireEvent.click(screen.getByTestId('add-sale-product-surface'));
      expect(onAdd).toHaveBeenCalledTimes(1);
    });

    test('la superficie queda deshabilitada con producto agotado o carrito bloqueado', () => {
      const onAdd = jest.fn();
      const { rerender } = render(
        <ProductCardBase
          variant="sales"
          product={makeProduct()}
          isOutOfStock={true}
          onAdd={onAdd}
        />
      );

      const surface = screen.getByTestId('add-sale-product-surface');
      expect(surface).toBeDisabled();

      rerender(
        <ProductCardBase
          variant="sales"
          product={makeProduct()}
          isOutOfStock={false}
          disabled={true}
          onAdd={onAdd}
        />
      );

      expect(screen.getByTestId('add-sale-product-surface')).toBeDisabled();
      expect(onAdd).not.toHaveBeenCalled();
    });

    test('los controles son botones reales (Enter/Espacio nativos)', () => {
      const onAdd = jest.fn();
      render(
        <ProductCardBase
          variant="sales"
          product={makeProduct()}
          isOutOfStock={false}
          onAdd={onAdd}
        />
      );

      const button = screen.getByTestId('add-sale-product');
      expect(button.tagName).toBe('BUTTON');
      expect(button).not.toBeDisabled();
    });

    test('el botón de personalizar llama onCustomize sin agregar', () => {
      const onAdd = jest.fn();
      const onCustomize = jest.fn();
      const product = makeProduct({
        recipe: [
          {
            supplyId: 20,
            supplyName: 'Cebolla',
            supplyType: 'manual_supply',
            quantity: 1,
            autoDiscount: false,
            isOptional: true,
            selected: false,
            selectedByDefault: false,
          },
        ],
      });

      render(
        <ProductCardBase
          variant="sales"
          product={product}
          isOutOfStock={false}
          onAdd={onAdd}
          onCustomize={onCustomize}
        />
      );

      fireEvent.click(screen.getByTestId('customize-sale-product'));
      expect(onCustomize).toHaveBeenCalledTimes(1);
      expect(onAdd).not.toHaveBeenCalled();
    });

    test('sin opcionales no se muestra el botón de personalizar', () => {
      render(
        <ProductCardBase
          variant="sales"
          product={makeProduct()}
          isOutOfStock={false}
          onAdd={jest.fn()}
          onCustomize={jest.fn()}
        />
      );

      expect(
        screen.queryByTestId('customize-sale-product')
      ).not.toBeInTheDocument();
    });

    test('no muestra el badge con la cantidad de opcionales', () => {
      render(
        <ProductCardBase
          variant="sales"
          product={makeProduct({
            recipe: [
              {
                supplyId: 20,
                supplyName: 'Cebolla',
                supplyType: 'manual_supply',
                quantity: 1,
                autoDiscount: false,
                isOptional: true,
                selected: false,
                selectedByDefault: true,
              },
            ],
          })}
          isOutOfStock={false}
          onAdd={jest.fn()}
          onCustomize={jest.fn()}
        />
      );

      expect(screen.queryByText(/opcionales/)).not.toBeInTheDocument();
      // La existencia de opcionales la delata el botón de personalizar.
      expect(screen.getByTestId('customize-sale-product')).toBeInTheDocument();
    });

    test('muestra el badge de cantidad en venta', () => {
      render(
        <ProductCardBase
          variant="sales"
          product={makeProduct()}
          isOutOfStock={false}
          inCartQuantity={3}
          onAdd={jest.fn()}
        />
      );

      expect(
        screen.getByTestId('product-card-cart-quantity-1')
      ).toHaveTextContent('3 en venta');
    });

    test('muestra el stock restante con la unidad del producto', () => {
      render(
        <ProductCardBase
          variant="sales"
          product={makeProduct({ unit: 'botella' })}
          isOutOfStock={false}
          maxAdditional={4}
          onAdd={jest.fn()}
        />
      );

      expect(screen.getByTestId('product-availability')).toHaveTextContent(
        'Disponible: 5 botella'
      );
      expect(screen.getByText('Podés sumar: 4 más')).toBeInTheDocument();
    });

    test('oculta "Podés sumar" cuando el remanente coincide con la disponibilidad', () => {
      render(
        <ProductCardBase
          variant="sales"
          product={makeProduct()}
          isOutOfStock={false}
          maxAdditional={5}
          onAdd={jest.fn()}
        />
      );

      expect(screen.getByTestId('product-availability')).toHaveTextContent(
        'Disponible: 5 unidad'
      );
      expect(screen.queryByText(/Podés sumar/)).not.toBeInTheDocument();
    });

    test('muestra "Sin stock" aunque el remanente coincida con la disponibilidad en cero', () => {
      render(
        <ProductCardBase
          variant="sales"
          product={makeProduct({ availability: 0 })}
          isOutOfStock={true}
          maxAdditional={0}
          onAdd={jest.fn()}
        />
      );

      expect(screen.getByText('Sin stock')).toBeInTheDocument();
    });

    test('muestra "Sin stock" y no dispara onAdd cuando está agotado', () => {
      const onAdd = jest.fn();
      render(
        <ProductCardBase
          variant="sales"
          product={makeProduct()}
          isOutOfStock={true}
          maxAdditional={0}
          onAdd={onAdd}
        />
      );

      const card = screen.getByTestId('product-card');
      expect(card).toHaveAttribute('data-out-of-stock', 'true');
      expect(screen.getByText('Sin stock')).toBeInTheDocument();

      const button = screen.getByTestId('add-sale-product');
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent('Agotado');

      fireEvent.click(button);
      expect(onAdd).not.toHaveBeenCalled();
    });

    test('no dispara onAdd cuando el carrito está deshabilitado', () => {
      const onAdd = jest.fn();
      render(
        <ProductCardBase
          variant="sales"
          product={makeProduct()}
          isOutOfStock={false}
          disabled={true}
          onAdd={onAdd}
        />
      );

      const button = screen.getByTestId('add-sale-product');
      expect(button).toBeDisabled();
      fireEvent.click(button);
      expect(onAdd).not.toHaveBeenCalled();
    });

    test('no muestra el extra de ventas para servicios', () => {
      render(
        <ProductCardBase
          variant="sales"
          product={makeProduct({ type: 'service' })}
          isOutOfStock={false}
          maxAdditional={Number.MAX_SAFE_INTEGER}
          onAdd={jest.fn()}
        />
      );

      expect(screen.queryByText(/En este pedido:/)).not.toBeInTheDocument();
      expect(screen.getByTestId('product-availability')).toHaveTextContent(
        'Disponible: sin límite'
      );
    });
  });
});
