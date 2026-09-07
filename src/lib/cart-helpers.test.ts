import {
  areRecipeSelectionsEqual,
  groupCartItemsForSubmit,
  hasOptionalRecipeItems,
} from './cart-helpers';

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

  describe('hasOptionalRecipeItems', () => {
    test('devuelve true si la receta tiene algún insumo opcional', () => {
      expect(
        hasOptionalRecipeItems({
          recipe: [
            { isOptional: false },
            { isOptional: true },
          ],
        })
      ).toBe(true);
    });

    test('devuelve false sin receta o sin opcionales', () => {
      expect(hasOptionalRecipeItems({})).toBe(false);
      expect(hasOptionalRecipeItems({ recipe: [] })).toBe(false);
      expect(
        hasOptionalRecipeItems({ recipe: [{ isOptional: false }] })
      ).toBe(false);
    });
  });

  describe('groupCartItemsForSubmit', () => {
    test('agrupa líneas del mismo producto con selecciones iguales', () => {
      const result = groupCartItemsForSubmit([
        { productId: 1, quantity: 1, selectedRecipeItemIds: [2, 3] },
        { productId: 1, quantity: 1, selectedRecipeItemIds: [3, 2] },
        { productId: 1, quantity: 1, selectedRecipeItemIds: [2, 3] },
      ]);

      expect(result).toEqual([
        { productId: 1, quantity: 3, selectedRecipeItemIds: [2, 3] },
      ]);
    });

    test('mantiene separadas las líneas con selecciones distintas', () => {
      const result = groupCartItemsForSubmit([
        { productId: 1, quantity: 1, selectedRecipeItemIds: [2] },
        { productId: 1, quantity: 1, selectedRecipeItemIds: [3] },
        { productId: 2, quantity: 1, selectedRecipeItemIds: [] },
      ]);

      expect(result).toEqual([
        { productId: 1, quantity: 1, selectedRecipeItemIds: [2] },
        { productId: 1, quantity: 1, selectedRecipeItemIds: [3] },
        { productId: 2, quantity: 1, selectedRecipeItemIds: [] },
      ]);
    });

    test('suma cantidades ya agrupadas y normaliza selecciones ausentes', () => {
      const result = groupCartItemsForSubmit([
        { productId: 1, quantity: 2 },
        { productId: 1, quantity: 1, selectedRecipeItemIds: [] },
      ]);

      expect(result).toEqual([
        { productId: 1, quantity: 3, selectedRecipeItemIds: [] },
      ]);
    });
  });
});
