import { areRecipeSelectionsEqual } from './cart-helpers';

describe('cart-helpers', () => {
  describe('areRecipeSelectionsEqual', () => {
    test('devuelve true para selecciones iguales en distinto orden', () => {
      expect(areRecipeSelectionsEqual([3, 1, 2], [2, 3, 1])).toBe(true);
      expect(areRecipeSelectionsEqual([5, 10], [10, 5])).toBe(true);
    });

    test('devuelve false cuando tienen distinta longitud', () => {
      expect(areRecipeSelectionsEqual([1, 2], [1])).toBe(false);
      expect(areRecipeSelectionsEqual([], [1])).toBe(false);
    });

    test('devuelve false cuando los ids son distintos', () => {
      expect(areRecipeSelectionsEqual([1, 2], [1, 3])).toBe(false);
      expect(areRecipeSelectionsEqual([4], [5])).toBe(false);
    });

    test('devuelve true para arrays vacíos', () => {
      expect(areRecipeSelectionsEqual([], [])).toBe(true);
    });

    test('considera correctamente los elementos duplicados', () => {
      expect(areRecipeSelectionsEqual([1, 1, 2], [2, 1, 1])).toBe(true);
      expect(areRecipeSelectionsEqual([1, 2, 2], [1, 1, 2])).toBe(false);
    });

    test('devuelve false cuando las repeticiones no coinciden', () => {
      expect(areRecipeSelectionsEqual([1, 1], [1])).toBe(false);
      expect(areRecipeSelectionsEqual([1], [1, 1])).toBe(false);
    });
  });
});
