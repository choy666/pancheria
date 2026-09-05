/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react';
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
    breakdown: [],
    ...overrides,
  };
}

describe('ProductCard', () => {
  test('muestra la disponibilidad en unidades', () => {
    render(
      <ProductCard
        product={makeProduct()}
        inCart={false}
        breakdown={[]}
        onAdd={jest.fn()}
      />
    );

    expect(screen.getByTestId('product-availability')).toHaveTextContent(
      'Disponible: 5 unidades'
    );
    expect(screen.getByRole('button', { name: 'Agregar' })).toBeInTheDocument();
  });

  test('muestra el desglose de insumos de una promo', () => {
    const product = makeProduct({
      breakdown: [
        { supplyName: 'Pan', available: 12, required: 1, isLimiting: false },
        { supplyName: 'Salchicha', available: 8, required: 2, isLimiting: true },
      ],
    });

    render(
      <ProductCard
        product={product}
        inCart={false}
        breakdown={product.breakdown}
        onAdd={jest.fn()}
        showBreakdown={true}
      />
    );

    fireEvent.click(screen.getByText('Ver insumos'));
    expect(screen.getByText('Pan: 12 disp., 1 req.')).toBeInTheDocument();
    expect(
      screen.getByText('Salchicha: 8 disp., 2 req. (limitante)')
    ).toBeInTheDocument();
  });

  test('oculta el desglose de insumos de una promo cuando showBreakdown es false', () => {
    const product = makeProduct({
      breakdown: [
        { supplyName: 'Pan', available: 12, required: 1, isLimiting: false },
        { supplyName: 'Salchicha', available: 8, required: 2, isLimiting: true },
      ],
    });

    render(
      <ProductCard
        product={product}
        inCart={false}
        breakdown={product.breakdown}
        onAdd={jest.fn()}
        showBreakdown={false}
      />
    );

    expect(screen.queryByText('Ver insumos')).not.toBeInTheDocument();
    expect(screen.queryByText('Pan: 12 disp., 1 req.')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Salchicha: 8 disp., 2 req. (limitante)')
    ).not.toBeInTheDocument();
  });

  test('muestra "Agregar otro" cuando el producto ya está en el carrito', () => {
    render(
      <ProductCard
        product={makeProduct()}
        inCart={true}
        breakdown={[]}
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
        breakdown={[]}
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
        breakdown={[]}
        onAdd={jest.fn()}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Agregar otro' })
    ).toBeInTheDocument();
  });
});
