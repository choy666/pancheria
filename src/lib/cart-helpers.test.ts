import {
  areRecipeSelectionsEqual,
  groupCartItemsForSubmit,
  hasOptionalRecipeItems,
  normalizeItemNote,
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

  describe('normalizeItemNote', () => {
    test('normaliza ausencia, null y vacío a null', () => {
      expect(normalizeItemNote(undefined)).toBeNull();
      expect(normalizeItemNote(null)).toBeNull();
      expect(normalizeItemNote('')).toBeNull();
      expect(normalizeItemNote('   ')).toBeNull();
    });

    test('recorta espacios en los extremos', () => {
      expect(normalizeItemNote('  bien tostado  ')).toBe('bien tostado');
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
        {
          productId: 1,
          quantity: 3,
          selectedRecipeItemIds: [2, 3],
          notes: null,
        },
      ]);
    });

    test('mantiene separadas las líneas con selecciones distintas', () => {
      const result = groupCartItemsForSubmit([
        { productId: 1, quantity: 1, selectedRecipeItemIds: [2] },
        { productId: 1, quantity: 1, selectedRecipeItemIds: [3] },
        { productId: 2, quantity: 1, selectedRecipeItemIds: [] },
      ]);

      expect(result).toEqual([
        {
          productId: 1,
          quantity: 1,
          selectedRecipeItemIds: [2],
          notes: null,
        },
        {
          productId: 1,
          quantity: 1,
          selectedRecipeItemIds: [3],
          notes: null,
        },
        {
          productId: 2,
          quantity: 1,
          selectedRecipeItemIds: [],
          notes: null,
        },
      ]);
    });

    test('suma cantidades ya agrupadas y normaliza selecciones ausentes', () => {
      const result = groupCartItemsForSubmit([
        { productId: 1, quantity: 2 },
        { productId: 1, quantity: 1, selectedRecipeItemIds: [] },
      ]);

      expect(result).toEqual([
        {
          productId: 1,
          quantity: 3,
          selectedRecipeItemIds: [],
          notes: null,
        },
      ]);
    });

    test('agrupa líneas con la misma aclaración y suma sus cantidades', () => {
      const result = groupCartItemsForSubmit([
        { productId: 1, quantity: 1, notes: 'bien tostado' },
        { productId: 1, quantity: 1, notes: ' bien tostado ' },
        { productId: 1, quantity: 2, notes: 'bien tostado' },
      ]);

      expect(result).toEqual([
        {
          productId: 1,
          quantity: 4,
          selectedRecipeItemIds: [],
          notes: 'bien tostado',
        },
      ]);
    });

    test('mantiene separadas las líneas con aclaraciones distintas', () => {
      const result = groupCartItemsForSubmit([
        { productId: 1, quantity: 1, notes: 'bien tostado' },
        { productId: 1, quantity: 1, notes: 'sin sal' },
        { productId: 1, quantity: 1 },
      ]);

      expect(result).toEqual([
        {
          productId: 1,
          quantity: 1,
          selectedRecipeItemIds: [],
          notes: 'bien tostado',
        },
        {
          productId: 1,
          quantity: 1,
          selectedRecipeItemIds: [],
          notes: 'sin sal',
        },
        {
          productId: 1,
          quantity: 1,
          selectedRecipeItemIds: [],
          notes: null,
        },
      ]);
    });
  });
});
