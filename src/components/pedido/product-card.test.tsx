/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ProductCard } from './product-card';
import type { PublicCatalogProduct } from '@/application/services/catalogService';

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
  overrides: Partial<PublicCatalogProduct> = {}
): PublicCatalogProduct {
  return {
    id: 1,
    name: 'Panchuque',
    description: null,
    type: 'compound',
    criticalSupplyType: null,
    price: 1200,
    unit: 'unidad',
    availability: 5,
    ...overrides,
  };
}

describe('ProductCard', () => {
  test('muestra la disponibilidad como estado cualitativo, sin cantidades', () => {
    render(
      <ProductCard
        product={makeProduct()}
        inCart={false}
        onAdd={jest.fn()}
      />
    );

    expect(screen.getByTestId('product-availability')).toHaveTextContent(
      'Disponible'
    );
    expect(screen.getByTestId('product-availability')).not.toHaveTextContent(
      'unidades'
    );
    expect(screen.getByRole('button', { name: 'Agregar' })).toBeInTheDocument();
  });

  test('muestra "Últimas unidades" cuando quedan 3 o menos', () => {
    render(
      <ProductCard
        product={makeProduct({ availability: 3 })}
        inCart={false}
        onAdd={jest.fn()}
      />
    );

    expect(screen.getByTestId('product-availability')).toHaveTextContent(
      'Últimas unidades'
    );
  });

  test('muestra "Agotado" cuando no hay disponibilidad', () => {
    render(
      <ProductCard
        product={makeProduct({ availability: 0 })}
        inCart={false}
        onAdd={jest.fn()}
      />
    );

    expect(screen.getByTestId('product-availability')).toHaveTextContent(
      'Agotado'
    );
    expect(screen.getByRole('button', { name: 'Agotado' })).toBeDisabled();
  });

  test('usa la etiqueta pública en el badge de tipo', () => {
    render(
      <ProductCard
        product={makeProduct()}
        inCart={false}
        onAdd={jest.fn()}
      />
    );

    expect(screen.getByText('Promo')).toBeInTheDocument();

    const { unmount } = render(
      <ProductCard
        product={makeProduct({
          id: 2,
          name: 'Gaseosa',
          type: 'critical_supply',
          criticalSupplyType: 'beverage',
        })}
        inCart={false}
        onAdd={jest.fn()}
      />
    );

    expect(screen.getByText('Bebida')).toBeInTheDocument();
    expect(screen.queryByText(/Insumo/)).not.toBeInTheDocument();
    unmount();
  });

  test('muestra "Agregar otro" cuando el producto ya está en el carrito', () => {
    render(
      <ProductCard
        product={makeProduct()}
        inCart={true}
        onAdd={jest.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Agregar otro' })).toBeInTheDocument();
  });

  test('muestra "Agregar" cuando el producto no está en el carrito', () => {
    render(
      <ProductCard
        product={makeProduct()}
        inCart={false}
        onAdd={jest.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Agregar' })).toBeInTheDocument();
  });

  test('muestra la cantidad total en el badge cuando hay múltiples líneas', () => {
    render(
      <ProductCard
        product={makeProduct()}
        inCart={true}
        inCartQuantity={3}
        onAdd={jest.fn()}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Agregar otro' })
    ).toBeInTheDocument();
  });
});
