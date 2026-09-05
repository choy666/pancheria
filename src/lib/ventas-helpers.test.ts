import {
  areRecipeSelectionsEqual,
  sortSellableProducts,
  getDefaultSelectedRecipeItemIds,
  getProductAdditional,
  isProductOutOfStock,
} from './ventas-helpers';
import type { SellableProduct } from './ventas-helpers';
import type { ProductType, CriticalSupplyType, RecipeItemConfig } from '@/domain/types';

function makeProduct(overrides: {
  id: number;
  name: string;
  type: ProductType;
  criticalSupplyType?: CriticalSupplyType | null;
  availability?: number;
  recipe?: RecipeItemConfig[];
}): SellableProduct {
  return {
    id: overrides.id,
    branchId: 1,
    name: overrides.name,
    description: null,
    type: overrides.type,
    criticalSupplyType: overrides.criticalSupplyType ?? null,
    price: 1000,
    stock: 10,
    minStock: 0,
    isActive: true,
    unit: 'unidad',
    availability: overrides.availability ?? 10,
    recipe: overrides.recipe,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    deletedAt: null,
  };
}

function makeRecipeItem(
  overrides: Partial<RecipeItemConfig> & { supplyId: number }
): RecipeItemConfig {
  return {
    supplyId: overrides.supplyId,
    supplyName: overrides.supplyName ?? 'Insumo',
    supplyType: overrides.supplyType ?? 'critical_supply',
    quantity: overrides.quantity ?? 1,
    autoDiscount: overrides.autoDiscount ?? false,
    isOptional: overrides.isOptional ?? false,
    selected: overrides.selected ?? false,
    selectedByDefault: overrides.selectedByDefault ?? false,
  };
}

describe('ventas-helpers', () => {
  describe('areRecipeSelectionsEqual', () => {
    test('re-exporta la comparación de selecciones', () => {
      expect(areRecipeSelectionsEqual([2, 1], [1, 2])).toBe(true);
      expect(areRecipeSelectionsEqual([1], [1, 2])).toBe(false);
    });
  });

  describe('sortSellableProducts', () => {
    test('ordena por prioridad de tipo y luego por nombre', () => {
      const products = [
        makeProduct({
          id: 4,
          name: 'Z servicio',
          type: 'service',
        }),
        makeProduct({
          id: 3,
          name: 'Bebida A',
          type: 'critical_supply',
          criticalSupplyType: 'beverage',
        }),
        makeProduct({
          id: 1,
          name: 'Compuesto B',
          type: 'compound',
        }),
        makeProduct({
          id: 2,
          name: 'Compuesto A',
          type: 'compound',
        }),
        makeProduct({
          id: 5,
          name: 'Pan',
          type: 'critical_supply',
          criticalSupplyType: 'bread',
        }),
      ];

      const sorted = sortSellableProducts(products).map((p) => p.id);

      // Prioridad: compound (1), bebidas (2), service (3), otros (4).
      expect(sorted).toEqual([2, 1, 3, 4, 5]);
    });

    test('no modifica el array original', () => {
      const products = [makeProduct({ id: 1, name: 'A', type: 'service' })];
      const original = [...products];

      sortSellableProducts(products);

      expect(products).toEqual(original);
    });
  });

  describe('getDefaultSelectedRecipeItemIds', () => {
    test('devuelve los supplyId de insumos opcionales seleccionados por defecto', () => {
      const product = makeProduct({
        id: 1,
        name: 'Compuesto',
        type: 'compound',
        recipe: [
          makeRecipeItem({
            supplyId: 10,
            isOptional: true,
            selectedByDefault: true,
          }),
          makeRecipeItem({
            supplyId: 11,
            isOptional: false,
            selectedByDefault: true,
          }),
          makeRecipeItem({
            supplyId: 12,
            isOptional: true,
            selectedByDefault: false,
          }),
        ],
      });

      expect(getDefaultSelectedRecipeItemIds(product)).toEqual([10]);
    });

    test('devuelve un array vacío si no hay receta', () => {
      const product = makeProduct({
        id: 1,
        name: 'Compuesto',
        type: 'compound',
      });

      expect(getDefaultSelectedRecipeItemIds(product)).toEqual([]);
    });
  });

  describe('getProductAdditional', () => {
    test('devuelve el máximo seguro para productos de tipo servicio', () => {
      const product = makeProduct({
        id: 1,
        name: 'Servicio',
        type: 'service',
      });

      expect(getProductAdditional(product, {}, 5)).toBe(Number.MAX_SAFE_INTEGER);
    });

    test('usa cartAvailability si está definida', () => {
      const product = makeProduct({
        id: 1,
        name: 'Pancho',
        type: 'critical_supply',
        criticalSupplyType: 'sausage',
        availability: 0,
      });

      expect(getProductAdditional(product, { 1: 5 }, 1)).toBe(5);
    });

    test('calcula disponibilidad adicional desde product.availability', () => {
      const product = makeProduct({
        id: 1,
        name: 'Pancho',
        type: 'critical_supply',
        criticalSupplyType: 'sausage',
        availability: 10,
      });

      expect(getProductAdditional(product, {}, 3)).toBe(7);
    });

    test('no devuelve negativos cuando no hay disponibilidad', () => {
      const product = makeProduct({
        id: 1,
        name: 'Pancho',
        type: 'critical_supply',
        criticalSupplyType: 'sausage',
        availability: 2,
      });

      expect(getProductAdditional(product, {}, 5)).toBe(0);
    });

    test('usa 0 como disponibilidad si product.availability es undefined', () => {
      const product = {
        ...makeProduct({
          id: 1,
          name: 'Pancho',
          type: 'critical_supply',
          criticalSupplyType: 'sausage',
        }),
        availability: undefined,
      } as unknown as SellableProduct;

      expect(getProductAdditional(product, {}, 0)).toBe(0);
    });
  });

  describe('isProductOutOfStock', () => {
    test('los servicios nunca están sin stock', () => {
      const product = makeProduct({
        id: 1,
        name: 'Servicio',
        type: 'service',
      });

      expect(isProductOutOfStock(product, {}, 999)).toBe(false);
    });

    test('devuelve false cuando hay disponibilidad adicional', () => {
      const product = makeProduct({
        id: 1,
        name: 'Pancho',
        type: 'critical_supply',
        criticalSupplyType: 'sausage',
        availability: 5,
      });

      expect(isProductOutOfStock(product, {}, 2)).toBe(false);
    });

    test('devuelve true cuando la disponibilidad adicional es 0', () => {
      const product = makeProduct({
        id: 1,
        name: 'Pancho',
        type: 'critical_supply',
        criticalSupplyType: 'sausage',
        availability: 2,
      });

      expect(isProductOutOfStock(product, {}, 2)).toBe(true);
    });

    test('respeta cartAvailability negativa', () => {
      const product = makeProduct({
        id: 1,
        name: 'Pancho',
        type: 'critical_supply',
        criticalSupplyType: 'sausage',
        availability: 10,
      });

      expect(isProductOutOfStock(product, { 1: -3 }, 0)).toBe(true);
    });
  });
});
