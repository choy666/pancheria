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

    test('muestra "Personalizar" y abre el diálogo para promos con opcionales', () => {
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
          onAdd={jest.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Personalizar' }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    test('usa la unidad genérica "unidades" en el catálogo', () => {
      render(
        <ProductCardBase
          variant="catalog"
          product={makeProduct({ unit: 'porción' })}
          isOutOfStock={false}
          onAdd={jest.fn()}
        />
      );

      expect(screen.getByTestId('product-availability')).toHaveTextContent(
        'Disponible: 5 unidades'
      );
    });
  });

  describe('variant="sales"', () => {
    test('la tarjeta completa actúa como botón y llama onAdd', () => {
      const onAdd = jest.fn();
      render(
        <ProductCardBase
          variant="sales"
          product={makeProduct()}
          isOutOfStock={false}
          onAdd={onAdd}
        />
      );

      const card = screen.getByRole('button', {
        name: 'Agregar Panchuque al pedido',
      });
      fireEvent.click(card);
      expect(onAdd).toHaveBeenCalledTimes(1);
    });

    test('responde a Enter y Espacio', () => {
      const onAdd = jest.fn();
      render(
        <ProductCardBase
          variant="sales"
          product={makeProduct()}
          isOutOfStock={false}
          onAdd={onAdd}
        />
      );

      const card = screen.getByTestId('product-card');
      fireEvent.keyDown(card, { key: 'Enter' });
      fireEvent.keyDown(card, { key: ' ' });
      expect(onAdd).toHaveBeenCalledTimes(2);
    });

    test('muestra el badge de cantidad en pedido', () => {
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
      ).toHaveTextContent('3 en pedido');
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
      expect(screen.getByText('En este pedido: 4 más')).toBeInTheDocument();
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
      expect(card).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByText('Sin stock')).toBeInTheDocument();

      fireEvent.click(card);
      fireEvent.keyDown(card, { key: 'Enter' });
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

      fireEvent.click(screen.getByTestId('product-card'));
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
