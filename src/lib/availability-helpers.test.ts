import { calculateCompoundAvailability } from './availability-helpers';

describe('availability-helpers', () => {
  describe('calculateCompoundAvailability', () => {
    test('devuelve 0 cuando no hay insumos críticos', () => {
      const items = [
        { supplyId: 1, quantity: 1, autoDiscount: false, supply: { stock: 10 } },
      ];

      expect(calculateCompoundAvailability(items)).toBe(0);
    });

    test('devuelve 0 cuando el array de recetas está vacío', () => {
      expect(calculateCompoundAvailability([])).toBe(0);
    });

    test('calcula disponibilidad con stock suficiente', () => {
      const items = [
        { supplyId: 1, quantity: 2, autoDiscount: true, supply: { stock: 10 } },
        { supplyId: 2, quantity: 1, autoDiscount: true, supply: { stock: 5 } },
      ];

      // El insumo 1 permite 5 unidades (10 / 2) y el insumo 2 permite 5 (5 / 1).
      expect(calculateCompoundAvailability(items)).toBe(5);
    });

    test('limita la disponibilidad por el insumo con menor stock', () => {
      const items = [
        { supplyId: 1, quantity: 1, autoDiscount: true, supply: { stock: 100 } },
        { supplyId: 2, quantity: 1, autoDiscount: true, supply: { stock: 3 } },
      ];

      expect(calculateCompoundAvailability(items)).toBe(3);
    });

    test('considera consumos previamente comprometidos', () => {
      const items = [
        { supplyId: 1, quantity: 2, autoDiscount: true, supply: { stock: 10 } },
      ];

      expect(calculateCompoundAvailability(items, undefined, { 1: 4 })).toBe(3);
    });

    test('permite sobreescribir el stock con stockBySupplyId', () => {
      const items = [
        { supplyId: 1, quantity: 2, autoDiscount: true, supply: { stock: 10 } },
      ];

      expect(calculateCompoundAvailability(items, { 1: 6 })).toBe(3);
    });

    test('devuelve disponibilidad negativa cuando el stock neto es negativo', () => {
      const items = [
        { supplyId: 1, quantity: 2, autoDiscount: true, supply: { stock: 5 } },
      ];

      expect(calculateCompoundAvailability(items, undefined, { 1: 7 })).toBe(-1);
    });

    test('ignora insumos opcionales o manuales en el cálculo', () => {
      const items = [
        { supplyId: 1, quantity: 1, autoDiscount: true, supply: { stock: 5 } },
        { supplyId: 2, quantity: 1, autoDiscount: false, supply: { stock: 0 } },
      ];

      // El insumo 2 no limita porque autoDiscount es false.
      expect(calculateCompoundAvailability(items)).toBe(5);
    });

    test('combina stock sobreescrito y consumos', () => {
      const items = [
        { supplyId: 1, quantity: 3, autoDiscount: true, supply: { stock: 100 } },
        { supplyId: 2, quantity: 1, autoDiscount: true, supply: { stock: 4 } },
      ];

      // Insumo 1: (8 - 2) / 3 = 2. Insumo 2: 4 / 1 = 4.
      expect(
        calculateCompoundAvailability(
          items,
          { 1: 8, 2: 4 },
          { 1: 2 }
        )
      ).toBe(2);
    });
  });
});
