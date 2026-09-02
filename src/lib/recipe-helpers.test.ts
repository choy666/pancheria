import { formatRecipeSummary, formatRecipeItemName } from './recipe-helpers';
import type { RecipeItemConfig } from '@/domain/types';

const baseRecipe: RecipeItemConfig[] = [
  {
    supplyId: 1,
    supplyName: 'Pan',
    supplyType: 'critical_supply',
    quantity: 1,
    autoDiscount: true,
    isOptional: false,
    selected: true,
    selectedByDefault: true,
  },
  {
    supplyId: 2,
    supplyName: 'Ketchup',
    supplyType: 'manual_supply',
    quantity: 1,
    autoDiscount: false,
    isOptional: true,
    selected: true,
    selectedByDefault: true,
  },
  {
    supplyId: 3,
    supplyName: 'Mayonesa',
    supplyType: 'manual_supply',
    quantity: 1,
    autoDiscount: false,
    isOptional: true,
    selected: false,
    selectedByDefault: false,
  },
];

describe('recipe-helpers', () => {
  test('formatRecipeItemName incluye cantidad para insumos obligatorios', () => {
    expect(formatRecipeItemName(baseRecipe[0])).toBe('Pan (1)');
  });

  test('formatRecipeItemName oculta la cantidad para insumos opcionales', () => {
    expect(formatRecipeItemName(baseRecipe[1])).toBe('Ketchup');
  });

  test('formatRecipeSummary muestra los seleccionados y quitados', () => {
    expect(formatRecipeSummary(baseRecipe)).toBe(
      'Incluye: Pan (1), Ketchup. Sin: Mayonesa'
    );
  });

  test('formatRecipeSummary devuelve cadena vacía si no hay nada para mostrar', () => {
    expect(formatRecipeSummary([])).toBe('');
  });

  test('formatRecipeSummary muestra cantidad en insumos obligatorios seleccionados', () => {
    const recipe: RecipeItemConfig[] = [
      { ...baseRecipe[0], quantity: 2 },
      { ...baseRecipe[1], selected: true },
    ];
    expect(formatRecipeSummary(recipe)).toBe('Incluye: Pan (2), Ketchup');
  });
});
