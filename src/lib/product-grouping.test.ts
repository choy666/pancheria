import { groupProductsByType } from './product-grouping';
import type { CriticalSupplyType, ProductRow, ProductType } from '@/domain/types';

const typePriority: Record<ProductType, number> = {
  compound: 1,
  critical_supply: 2,
  manual_supply: 3,
  service: 4,
};

const criticalSupplyTypePriority: Record<CriticalSupplyType, number> = {
  bread: 1,
  sausage: 2,
  beverage: 3,
};

function makeProduct(
  id: number,
  name: string,
  type: ProductType,
  criticalSupplyType?: CriticalSupplyType | null
): ProductRow {
  return {
    id,
    branchId: 1,
    name,
    type,
    criticalSupplyType:
      criticalSupplyType ?? (type === 'critical_supply' ? 'bread' : null),
    description: null,
    price: 0,
    unit: 'unidad',
    stock: 0,
    minStock: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
}

describe('groupProductsByType', () => {
  test('devuelve un array vacío cuando no hay productos', () => {
    const result = groupProductsByType([], typePriority);
    expect(result).toEqual([]);
  });

  test('agrupa productos ordenados por prioridad de tipo y luego por nombre', () => {
    const products = [
      makeProduct(1, 'Zanahoria', 'manual_supply'),
      makeProduct(2, 'Panchuque', 'compound'),
      makeProduct(3, 'Pan', 'critical_supply', 'bread'),
      makeProduct(4, 'Aderezo', 'manual_supply'),
      makeProduct(5, 'Gaseosa', 'critical_supply', 'beverage'),
      makeProduct(6, 'Vaso', 'service'),
    ];

    const result = groupProductsByType(
      products,
      typePriority,
      criticalSupplyTypePriority
    );

    expect(result).toHaveLength(4);

    expect(result[0].type).toBe('compound');
    expect(result[0].items.map((p) => p.name)).toEqual(['Panchuque']);

    expect(result[1].type).toBe('critical_supply');
    expect(result[1].items.map((p) => p.name)).toEqual(['Pan', 'Gaseosa']);

    expect(result[2].type).toBe('manual_supply');
    expect(result[2].items.map((p) => p.name)).toEqual(['Aderezo', 'Zanahoria']);

    expect(result[3].type).toBe('service');
    expect(result[3].items.map((p) => p.name)).toEqual(['Vaso']);
  });

  test('respeta el orden alfabético dentro de cada grupo', () => {
    const products = [
      makeProduct(1, 'Salchicha', 'critical_supply', 'sausage'),
      makeProduct(2, 'Pan', 'critical_supply', 'bread'),
      makeProduct(3, 'Bebida', 'critical_supply', 'beverage'),
    ];

    const result = groupProductsByType(
      products,
      typePriority,
      criticalSupplyTypePriority
    );

    expect(result).toHaveLength(1);
    expect(result[0].items.map((p) => p.name)).toEqual([
      'Pan',
      'Salchicha',
      'Bebida',
    ]);
  });

  test('agrupa los insumos críticos por subtipo y luego por nombre', () => {
    const products = [
      makeProduct(1, 'Coca', 'critical_supply', 'beverage'),
      makeProduct(2, 'Salchicha grande', 'critical_supply', 'sausage'),
      makeProduct(3, 'Pan', 'critical_supply', 'bread'),
      makeProduct(4, 'Pritty', 'critical_supply', 'beverage'),
      makeProduct(5, 'Salchicha chica', 'critical_supply', 'sausage'),
      makeProduct(6, 'Pan de salvado', 'critical_supply', 'bread'),
    ];

    const result = groupProductsByType(
      products,
      typePriority,
      criticalSupplyTypePriority
    );

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('critical_supply');
    expect(result[0].items.map((p) => p.name)).toEqual([
      'Pan',
      'Pan de salvado',
      'Salchicha chica',
      'Salchicha grande',
      'Coca',
      'Pritty',
    ]);
  });
});
