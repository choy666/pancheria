/**
 * @jest-environment node
 */
import {
  productTypeLabels,
  publicProductTypeLabels,
  salesProductTypeLabels,
  criticalTypeLabels,
  typePriority,
  criticalSupplyTypePriority,
  productTypeBadgeClasses,
  productTypeTextClasses,
  productTypeDotClasses,
  productTypeGroupClasses,
  publicProductTypeGroupClasses,
} from './product-style';
import type { CriticalSupplyType, ProductType } from '@/domain/types';

const PRODUCT_TYPES: ProductType[] = [
  'critical_supply',
  'compound',
  'manual_supply',
  'service',
];
const CRITICAL_TYPES: CriticalSupplyType[] = ['bread', 'sausage', 'beverage'];

describe('product-style', () => {
  test('todos los mapas por tipo de producto cubren cada ProductType', () => {
    const maps: Record<ProductType, string | number>[] = [
      productTypeLabels,
      publicProductTypeLabels,
      salesProductTypeLabels,
      typePriority,
      productTypeBadgeClasses,
      productTypeTextClasses,
      productTypeDotClasses,
      productTypeGroupClasses,
      publicProductTypeGroupClasses,
    ];

    for (const map of maps) {
      for (const type of PRODUCT_TYPES) {
        expect(map[type]).toBeDefined();
        if (typeof map[type] === 'string') {
          expect((map[type] as string).length).toBeGreaterThan(0);
        }
      }
    }
  });

  test('los mapas de insumo crítico cubren cada CriticalSupplyType', () => {
    for (const type of CRITICAL_TYPES) {
      expect(criticalTypeLabels[type].length).toBeGreaterThan(0);
      expect(criticalSupplyTypePriority[type]).toBeGreaterThan(0);
    }
  });

  test('las prioridades de tipo son únicas y ordenan promo primero', () => {
    const priorities = PRODUCT_TYPES.map((type) => typePriority[type]);

    expect(new Set(priorities).size).toBe(PRODUCT_TYPES.length);
    expect(typePriority.compound).toBe(Math.min(...priorities));
  });

  test('las etiquetas públicas usan lenguaje de cliente', () => {
    expect(publicProductTypeLabels.compound).toBe('Combos y promos');
    expect(publicProductTypeLabels.critical_supply).toBe('Bebidas');
    expect(publicProductTypeLabels.service).toBe('Extras');
  });

  test('las etiquetas del terminal usan lenguaje de mostrador', () => {
    expect(salesProductTypeLabels.compound).toBe('Combos y promos');
    expect(salesProductTypeLabels.critical_supply).toBe('Bebidas');
    expect(salesProductTypeLabels.service).toBe('Servicios y extras');
  });
});
