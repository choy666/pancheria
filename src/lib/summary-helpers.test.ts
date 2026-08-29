import { addItemToSummary, fillMissingCriticalSupplies } from './summary-helpers';

describe('summary-helpers', () => {
  describe('addItemToSummary', () => {
    it('suma un producto simple a productsSummary', () => {
      const productsSummary: Record<string, number> = {};
      const criticalSuppliesSummary: Record<string, number> = {};
      const recipeSuppliesSummary: Record<string, number> = {};

      addItemToSummary(
        productsSummary,
        criticalSuppliesSummary,
        recipeSuppliesSummary,
        { id: 1, name: 'Pancho', type: 'service', criticalSupplyType: null },
        2,
        new Map()
      );

      expect(productsSummary).toEqual({ Pancho: 2 });
      expect(criticalSuppliesSummary).toEqual({});
      expect(recipeSuppliesSummary).toEqual({});
    });

    it('suma una bebida critica a criticalSuppliesSummary', () => {
      const productsSummary: Record<string, number> = {};
      const criticalSuppliesSummary: Record<string, number> = {};
      const recipeSuppliesSummary: Record<string, number> = {};

      addItemToSummary(
        productsSummary,
        criticalSuppliesSummary,
        recipeSuppliesSummary,
        { id: 1, name: 'Coca 500ml', type: 'critical_supply', criticalSupplyType: 'beverage' },
        3,
        new Map()
      );

      expect(productsSummary).toEqual({ 'Coca 500ml': 3 });
      expect(criticalSuppliesSummary).toEqual({ 'Coca 500ml': 3 });
      expect(recipeSuppliesSummary).toEqual({});
    });

    it('ignora insumos criticos que no sean bebidas', () => {
      const productsSummary: Record<string, number> = {};
      const criticalSuppliesSummary: Record<string, number> = {};
      const recipeSuppliesSummary: Record<string, number> = {};

      addItemToSummary(
        productsSummary,
        criticalSuppliesSummary,
        recipeSuppliesSummary,
        { id: 1, name: 'Pan', type: 'critical_supply', criticalSupplyType: 'bread' },
        5,
        new Map()
      );

      expect(productsSummary).toEqual({ Pan: 5 });
      expect(criticalSuppliesSummary).toEqual({});
      expect(recipeSuppliesSummary).toEqual({});
    });

    it('acumula consumos de recetas con autoDiscount para productos compuestos', () => {
      const productsSummary: Record<string, number> = {};
      const criticalSuppliesSummary: Record<string, number> = {};
      const recipeSuppliesSummary: Record<string, number> = {};

      const recipesByProduct = new Map([
        [
          1,
          [
            { supplyId: 10, quantity: 2, autoDiscount: true, supply: { name: 'Pan' } },
            { supplyId: 11, quantity: 1, autoDiscount: true, supply: { name: 'Chorizo' } },
            { supplyId: 12, quantity: 1, autoDiscount: false, supply: { name: 'Sal' } },
          ] as { supplyId: number; quantity: number; autoDiscount: boolean; supply: { name: string } }[],
        ],
      ]);

      addItemToSummary(
        productsSummary,
        criticalSuppliesSummary,
        recipeSuppliesSummary,
        { id: 1, name: 'Panchuque', type: 'compound', criticalSupplyType: null },
        3,
        recipesByProduct
      );

      expect(productsSummary).toEqual({ Panchuque: 3 });
      expect(criticalSuppliesSummary).toEqual({
        Pan: 6,
        Chorizo: 3,
      });
      expect(recipeSuppliesSummary).toEqual({
        Pan: 6,
        Chorizo: 3,
        Sal: 3,
      });
    });

    it('usa supplyId como fallback cuando no hay nombre de insumo', () => {
      const productsSummary: Record<string, number> = {};
      const criticalSuppliesSummary: Record<string, number> = {};
      const recipeSuppliesSummary: Record<string, number> = {};

      const recipesByProduct = new Map([
        [
          1,
          [{ supplyId: 99, quantity: 1, autoDiscount: true }],
        ],
      ]);

      addItemToSummary(
        productsSummary,
        criticalSuppliesSummary,
        recipeSuppliesSummary,
        { id: 1, name: 'Combo', type: 'compound', criticalSupplyType: null },
        2,
        recipesByProduct
      );

      expect(criticalSuppliesSummary).toEqual({ 'Insumo 99': 2 });
      expect(recipeSuppliesSummary).toEqual({ 'Insumo 99': 2 });
    });

    it('resta cuando el signo es negativo', () => {
      const productsSummary: Record<string, number> = { Panchuque: 5 };
      const criticalSuppliesSummary: Record<string, number> = { Coca: 5 };
      const recipeSuppliesSummary: Record<string, number> = { Panchuque: 5 };

      addItemToSummary(
        productsSummary,
        criticalSuppliesSummary,
        recipeSuppliesSummary,
        { id: 1, name: 'Panchuque', type: 'critical_supply', criticalSupplyType: 'beverage' },
        2,
        new Map(),
        undefined,
        -1
      );

      expect(productsSummary).toEqual({ Panchuque: 3 });
      expect(criticalSuppliesSummary).toEqual({ Coca: 5, Panchuque: -2 });
      expect(recipeSuppliesSummary).toEqual({ Panchuque: 5 });
    });

    it('acumula multiples llamadas en el mismo resumen', () => {
      const productsSummary: Record<string, number> = {};
      const criticalSuppliesSummary: Record<string, number> = {};
      const recipeSuppliesSummary: Record<string, number> = {};

      const product = { id: 1, name: 'Coca 500ml', type: 'critical_supply' as const, criticalSupplyType: 'beverage' as const };

      addItemToSummary(productsSummary, criticalSuppliesSummary, recipeSuppliesSummary, product, 2, new Map());
      addItemToSummary(productsSummary, criticalSuppliesSummary, recipeSuppliesSummary, product, 3, new Map());

      expect(productsSummary).toEqual({ 'Coca 500ml': 5 });
      expect(criticalSuppliesSummary).toEqual({ 'Coca 500ml': 5 });
      expect(recipeSuppliesSummary).toEqual({});
    });

    it('acumula todos los insumos seleccionados cuando hay snapshot', () => {
      const productsSummary: Record<string, number> = {};
      const criticalSuppliesSummary: Record<string, number> = {};
      const recipeSuppliesSummary: Record<string, number> = {};

      const product = { id: 1, name: 'Promo', type: 'compound', criticalSupplyType: null };
      const recipeSnapshot = [
        { supplyId: 10, supplyName: 'Pan', supplyType: 'critical_supply' as const, quantity: 1, autoDiscount: true, isOptional: false, selected: true, selectedByDefault: false },
        { supplyId: 11, supplyName: 'Mayonesa', supplyType: 'manual_supply' as const, quantity: 1, autoDiscount: false, isOptional: true, selected: true, selectedByDefault: true },
      ];

      addItemToSummary(
        productsSummary,
        criticalSuppliesSummary,
        recipeSuppliesSummary,
        product,
        2,
        new Map(),
        recipeSnapshot
      );

      expect(productsSummary).toEqual({ Promo: 2 });
      expect(criticalSuppliesSummary).toEqual({ Pan: 2 });
      expect(recipeSuppliesSummary).toEqual({ Pan: 2, Mayonesa: 2 });
    });
  });

  describe('fillMissingCriticalSupplies', () => {
    it('completa insumos activos que no estan en el resumen', () => {
      const summary: Record<string, number> = { Pan: 5 };
      const supplies = [{ name: 'Pan' }, { name: 'Chorizo' }, { name: 'Gaseosa' }];

      fillMissingCriticalSupplies(summary, supplies);

      expect(summary).toEqual({
        Pan: 5,
        Chorizo: 0,
        Gaseosa: 0,
      });
    });

    it('no sobreescribe valores existentes', () => {
      const summary: Record<string, number> = { Pan: 5 };
      const supplies = [{ name: 'Pan' }];

      fillMissingCriticalSupplies(summary, supplies);

      expect(summary).toEqual({ Pan: 5 });
    });

    it('no hace nada si no hay insumos', () => {
      const summary: Record<string, number> = {};
      fillMissingCriticalSupplies(summary, []);
      expect(summary).toEqual({});
    });
  });
});
