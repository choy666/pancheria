import {
  isPublicSellableProduct,
  groupPublicProductsByType,
} from '@/lib/catalog';
import type { ProductRow } from '@/domain/types';

function makeProduct(
  id: number,
  name: string,
  type: ProductRow['type'],
  criticalSupplyType?: ProductRow['criticalSupplyType']
): ProductRow {
  return {
    id,
    branchId: 1,
    name,
    type,
    criticalSupplyType: criticalSupplyType ?? null,
    description: null,
    price: 100,
    unit: 'unidad',
    stock: 10,
    minStock: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
}

describe('isPublicSellableProduct', () => {
  test('acepta productos compuestos', () => {
    expect(isPublicSellableProduct(makeProduct(1, 'Panchuque', 'compound'))).toBe(true);
  });

  test('acepta servicios', () => {
    expect(isPublicSellableProduct(makeProduct(1, 'Vaso', 'service'))).toBe(true);
  });

  test('acepta bebidas (insumo crítico de tipo beverage)', () => {
    expect(
      isPublicSellableProduct(makeProduct(1, 'Gaseosa', 'critical_supply', 'beverage'))
    ).toBe(true);
  });

  test('rechaza insumos críticos que no sean bebidas', () => {
    expect(
      isPublicSellableProduct(makeProduct(1, 'Pan', 'critical_supply', 'bread'))
    ).toBe(false);
    expect(
      isPublicSellableProduct(makeProduct(1, 'Salchicha', 'critical_supply', 'sausage'))
    ).toBe(false);
  });

  test('rechaza insumos manuales', () => {
    expect(isPublicSellableProduct(makeProduct(1, 'Aderezo', 'manual_supply'))).toBe(false);
  });

  test('rechaza valores nulos o indefinidos', () => {
    expect(isPublicSellableProduct(null)).toBe(false);
    expect(isPublicSellableProduct(undefined)).toBe(false);
  });
});

describe('groupPublicProductsByType', () => {
  test('agrupa productos vendibles por tipo respetando el orden de prioridad', () => {
    const products = [
      makeProduct(1, 'Vaso', 'service'),
      makeProduct(2, 'Gaseosa', 'critical_supply', 'beverage'),
      makeProduct(3, 'Panchuque', 'compound'),
    ];

    const result = groupPublicProductsByType(products);

    expect(result).toHaveLength(3);
    expect(result[0].type).toBe('compound');
    expect(result[0].items.map((p) => p.name)).toEqual(['Panchuque']);
    expect(result[1].type).toBe('critical_supply');
    expect(result[1].items.map((p) => p.name)).toEqual(['Gaseosa']);
    expect(result[2].type).toBe('service');
    expect(result[2].items.map((p) => p.name)).toEqual(['Vaso']);
  });

  test('ordena alfabéticamente dentro de cada grupo', () => {
    const products = [
      makeProduct(1, 'Coca', 'critical_supply', 'beverage'),
      makeProduct(2, 'Pritty', 'critical_supply', 'beverage'),
      makeProduct(3, 'Panchuque', 'compound'),
      makeProduct(4, 'Super Panchuque', 'compound'),
    ];

    const result = groupPublicProductsByType(products);

    expect(result[0].items.map((p) => p.name)).toEqual([
      'Panchuque',
      'Super Panchuque',
    ]);
    expect(result[1].items.map((p) => p.name)).toEqual(['Coca', 'Pritty']);
  });

  test('devuelve un array vacío si no hay productos', () => {
    expect(groupPublicProductsByType([])).toEqual([]);
  });
});
