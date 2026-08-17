/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { ProductCard } from './product-card';
import type { PublicCatalogProduct } from '@/application/services/catalogService';

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

    expect(screen.getByText('Disponible: 5 unidades')).toBeInTheDocument();
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
      />
    );

    fireEvent.click(screen.getByText('Ver insumos'));
    expect(screen.getByText('Pan: 12 disp., 1 req.')).toBeInTheDocument();
    expect(
      screen.getByText('Salchicha: 8 disp., 2 req. (limitante)')
    ).toBeInTheDocument();
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
});
