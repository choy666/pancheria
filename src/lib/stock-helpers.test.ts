import {
  collectStockProductIdsToLock,
  iterRecipeConsumptions,
  buildStockMovementReason,
  STOCK_MOVEMENT_TYPES,
} from './stock-helpers';

describe('stock-helpers', () => {
  describe('collectStockProductIdsToLock', () => {
    it('devuelve un array vacio cuando no hay items', () => {
      const productById = new Map([
        [1, { id: 1, name: 'Pancho', type: 'service', criticalSupplyType: null }],
      ]);

      const result = collectStockProductIdsToLock([], productById, new Map());
      expect(result).toEqual([]);
    });

    it('ignora productos desconocidos', () => {
      const result = collectStockProductIdsToLock(
        [{ productId: 99, quantity: 1 }],
        new Map(),
        new Map()
      );
      expect(result).toEqual([]);
    });

    it('agrega el producto cuando es bebida critica', () => {
      const productById = new Map([
        [1, { id: 1, name: 'Coca', type: 'critical_supply', criticalSupplyType: 'beverage' }],
      ]);

      const result = collectStockProductIdsToLock(
        [{ productId: 1, quantity: 2 }],
        productById,
        new Map()
      );

      expect(result).toEqual([1]);
    });

    it('ignora insumos criticos que no sean bebidas', () => {
      const productById = new Map([
        [1, { id: 1, name: 'Pan', type: 'critical_supply', criticalSupplyType: 'bread' }],
      ]);

      const result = collectStockProductIdsToLock(
        [{ productId: 1, quantity: 1 }],
        productById,
        new Map()
      );

      expect(result).toEqual([]);
    });

    it('agrega los supplyId de recetas con autoDiscount para productos compuestos', () => {
      const productById = new Map([
        [1, { id: 1, name: 'Panchuque', type: 'compound', criticalSupplyType: null }],
      ]);
      const recipesByProduct = new Map([
        [
          1,
          [
            { supplyId: 10, quantity: 1, autoDiscount: true },
            { supplyId: 11, quantity: 1, autoDiscount: true },
            { supplyId: 12, quantity: 1, autoDiscount: false },
          ],
        ],
      ]);

      const result = collectStockProductIdsToLock(
        [{ productId: 1, quantity: 2 }],
        productById,
        recipesByProduct
      );

      expect(result).toEqual([10, 11]);
    });

    it('deduplica ids y preserva orden de aparicion', () => {
      const productById = new Map([
        [1, { id: 1, name: 'Coca', type: 'critical_supply', criticalSupplyType: 'beverage' }],
        [2, { id: 2, name: 'Panchuque', type: 'compound', criticalSupplyType: null }],
      ]);
      const recipesByProduct = new Map([
        [
          2,
          [
            { supplyId: 1, quantity: 1, autoDiscount: true },
            { supplyId: 10, quantity: 1, autoDiscount: true },
          ],
        ],
      ]);

      const result = collectStockProductIdsToLock(
        [
          { productId: 1, quantity: 1 },
          { productId: 2, quantity: 1 },
        ],
        productById,
        recipesByProduct
      );

      expect(result).toEqual([1, 10]);
    });

    it('no incluye servicios', () => {
      const productById = new Map([
        [1, { id: 1, name: 'Delivery', type: 'service', criticalSupplyType: null }],
      ]);

      const result = collectStockProductIdsToLock(
        [{ productId: 1, quantity: 1 }],
        productById,
        new Map()
      );

      expect(result).toEqual([]);
    });
  });

  describe('iterRecipeConsumptions', () => {
    it('no genera consumos para productos no compuestos', () => {
      const product = { id: 1, name: 'Coca', type: 'critical_supply', criticalSupplyType: 'beverage' as const };
      const result = Array.from(iterRecipeConsumptions(product, 2, new Map()));
      expect(result).toEqual([]);
    });

    it('genera consumos de recetas con autoDiscount', () => {
      const product = { id: 1, name: 'Panchuque', type: 'compound', criticalSupplyType: null };
      const recipesByProduct = new Map([
        [
          1,
          [
            { supplyId: 10, quantity: 2, autoDiscount: true, supply: { name: 'Pan' } },
            { supplyId: 11, quantity: 1, autoDiscount: true, supply: { name: 'Chorizo' } },
            { supplyId: 12, quantity: 1, autoDiscount: false, supply: { name: 'Sal' } },
          ],
        ],
      ]);

      const result = Array.from(iterRecipeConsumptions(product, 3, recipesByProduct));

      expect(result).toEqual([
        { supplyId: 10, consumed: 6, supplyName: 'Pan' },
        { supplyId: 11, consumed: 3, supplyName: 'Chorizo' },
      ]);
    });

    it('usa nombre generico cuando el insumo no tiene nombre', () => {
      const product = { id: 1, name: 'Panchuque', type: 'compound', criticalSupplyType: null };
      const recipesByProduct = new Map([
        [1, [{ supplyId: 99, quantity: 1, autoDiscount: true }]],
      ]);

      const result = Array.from(iterRecipeConsumptions(product, 2, recipesByProduct));

      expect(result).toEqual([{ supplyId: 99, consumed: 2, supplyName: 'Insumo 99' }]);
    });

    it('devuelve array vacio cuando no hay recetas', () => {
      const product = { id: 1, name: 'Panchuque', type: 'compound', criticalSupplyType: null };
      const result = Array.from(iterRecipeConsumptions(product, 1, new Map()));
      expect(result).toEqual([]);
    });
  });

  describe('STOCK_MOVEMENT_TYPES', () => {
    it('contiene los tipos de movimiento validos', () => {
      expect(STOCK_MOVEMENT_TYPES).toEqual([
        'sale',
        'cancellation',
        'manual_adjustment',
        'restock',
        'reserve',
        'reserve_release',
      ]);
    });
  });

  describe('buildStockMovementReason', () => {
    it('devuelve razon de venta con saleId', () => {
      expect(buildStockMovementReason('sale', 42)).toBe('Venta #42');
    });

    it('devuelve razon de venta generica sin saleId', () => {
      expect(buildStockMovementReason('sale')).toBe('Venta');
    });

    it('devuelve razon de anulacion con saleId', () => {
      expect(buildStockMovementReason('cancellation', 7)).toBe('Anulación de venta #7');
    });

    it('devuelve razon de anulacion generica sin saleId', () => {
      expect(buildStockMovementReason('cancellation')).toBe('Anulación de venta');
    });

    it('devuelve razon de reserva con orderId', () => {
      expect(buildStockMovementReason('reserve', undefined, 42)).toBe(
        'Reservado para pedido #42'
      );
    });

    it('devuelve razon de reserva generica sin orderId', () => {
      expect(buildStockMovementReason('reserve')).toBe('Reservado');
    });

    it('devuelve razon de liberacion de reserva con orderId', () => {
      expect(buildStockMovementReason('reserve_release', undefined, 42)).toBe(
        'Reserva liberada del pedido #42'
      );
    });

    it('devuelve razon de liberacion de reserva generica sin orderId', () => {
      expect(buildStockMovementReason('reserve_release')).toBe(
        'Reserva liberada'
      );
    });

    it('devuelve null para otros tipos', () => {
      expect(buildStockMovementReason('manual_adjustment')).toBeNull();
      expect(buildStockMovementReason('restock')).toBeNull();
    });
  });
});
