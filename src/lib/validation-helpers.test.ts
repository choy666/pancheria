import {
  validateNonEmptyString,
  validatePositiveInteger,
  validateMinLength,
  validateBranchOwnership,
  validateNonNegativeMoney,
} from './validation-helpers';
import { ValidationError } from '@/domain/errors';

describe('validation-helpers', () => {
  describe('validateNonEmptyString', () => {
    test('devuelve el valor sin espacios extra', () => {
      expect(validateNonEmptyString('  pancho  ', 'nombre')).toBe('pancho');
      expect(validateNonEmptyString('pancho', 'nombre')).toBe('pancho');
    });

    test('lanza ValidationError cuando el valor está vacío', () => {
      expect(() => validateNonEmptyString('', 'nombre')).toThrow(ValidationError);
      expect(() => validateNonEmptyString('', 'nombre')).toThrow('nombre es obligatorio.');
    });

    test('lanza ValidationError cuando el valor es solo espacios', () => {
      expect(() => validateNonEmptyString('   ', 'nombre')).toThrow(ValidationError);
    });

    test('lanza ValidationError cuando el valor es null o undefined', () => {
      expect(() => validateNonEmptyString(null, 'nombre')).toThrow(ValidationError);
      expect(() => validateNonEmptyString(undefined, 'nombre')).toThrow(ValidationError);
    });
  });

  describe('validatePositiveInteger', () => {
    test('acepta enteros positivos', () => {
      expect(() => validatePositiveInteger(1, 'cantidad')).not.toThrow();
      expect(() => validatePositiveInteger(100, 'cantidad')).not.toThrow();
      expect(() => validatePositiveInteger(Number.MAX_SAFE_INTEGER, 'cantidad')).not.toThrow();
    });

    test('rechaza cero', () => {
      expect(() => validatePositiveInteger(0, 'cantidad')).toThrow(ValidationError);
      expect(() => validatePositiveInteger(0, 'cantidad')).toThrow(
        'cantidad debe ser un número entero positivo.'
      );
    });

    test('rechaza números negativos', () => {
      expect(() => validatePositiveInteger(-5, 'cantidad')).toThrow(ValidationError);
    });

    test('rechaza decimales', () => {
      expect(() => validatePositiveInteger(1.5, 'cantidad')).toThrow(ValidationError);
    });

    test('rechaza NaN e Infinity', () => {
      expect(() => validatePositiveInteger(NaN, 'cantidad')).toThrow(ValidationError);
      expect(() => validatePositiveInteger(Infinity, 'cantidad')).toThrow(ValidationError);
    });

    test('usa el mensaje personalizado si se proporciona', () => {
      expect(() =>
        validatePositiveInteger(0, 'cantidad', 'Cantidad inválida.')
      ).toThrow('Cantidad inválida.');
    });
  });

  describe('validateMinLength', () => {
    test('acepta strings con longitud suficiente', () => {
      expect(() => validateMinLength('abcdef', 3, 'nombre')).not.toThrow();
      expect(() => validateMinLength('abc', 3, 'nombre')).not.toThrow();
    });

    test('rechaza strings más cortos que el mínimo', () => {
      expect(() => validateMinLength('ab', 3, 'nombre')).toThrow(ValidationError);
      expect(() => validateMinLength('ab', 3, 'nombre')).toThrow(
        'nombre debe tener al menos 3 caracteres.'
      );
    });

    test('rechaza valores null, undefined o vacíos', () => {
      expect(() => validateMinLength(null, 1, 'nombre')).toThrow(ValidationError);
      expect(() => validateMinLength(undefined, 1, 'nombre')).toThrow(ValidationError);
      expect(() => validateMinLength('', 1, 'nombre')).toThrow(ValidationError);
    });
  });

  describe('validateBranchOwnership', () => {
    test('no lanza error cuando la sucursal coincide', () => {
      const entity = { id: 1, name: 'Pancho', branchId: 10 };

      expect(() => validateBranchOwnership(entity, 10, 'Producto')).not.toThrow();
    });

    test('lanza ValidationError cuando la sucursal no coincide', () => {
      const entity = { id: 1, name: 'Pancho', branchId: 10 };

      expect(() => validateBranchOwnership(entity, 20, 'Producto')).toThrow(ValidationError);
      expect(() => validateBranchOwnership(entity, 20, 'Producto')).toThrow(
        'Producto Pancho no pertenece a la sucursal.'
      );
    });

    test('omite el nombre cuando no está disponible', () => {
      const entity = { id: 1, branchId: 10 };

      expect(() => validateBranchOwnership(entity, 20, 'Producto')).toThrow(
        'Producto no pertenece a la sucursal.'
      );
    });
  });

  describe('validateNonNegativeMoney', () => {
    test('devuelve 0 para valores vacíos o nulos', () => {
      expect(validateNonNegativeMoney(undefined, 'monto')).toBe(0);
      expect(validateNonNegativeMoney(null, 'monto')).toBe(0);
      expect(validateNonNegativeMoney('', 'monto')).toBe(0);
    });

    test('acepta números enteros y decimales', () => {
      expect(validateNonNegativeMoney(0, 'monto')).toBe(0);
      expect(validateNonNegativeMoney(100, 'monto')).toBe(100);
      expect(validateNonNegativeMoney(1.4, 'monto')).toBe(1);
      expect(validateNonNegativeMoney(1.5, 'monto')).toBe(2);
    });

    test('acepta strings numéricos y los redondea', () => {
      expect(validateNonNegativeMoney('0', 'monto')).toBe(0);
      expect(validateNonNegativeMoney('100', 'monto')).toBe(100);
      expect(validateNonNegativeMoney('1.6', 'monto')).toBe(2);
      expect(validateNonNegativeMoney('  50  ', 'monto')).toBe(50);
    });

    test('rechaza números negativos', () => {
      expect(() => validateNonNegativeMoney(-10, 'monto')).toThrow(ValidationError);
      expect(() => validateNonNegativeMoney('-5', 'monto')).toThrow(ValidationError);
    });

    test('rechaza valores no numéricos', () => {
      expect(() => validateNonNegativeMoney('abc', 'monto')).toThrow(ValidationError);
      expect(() => validateNonNegativeMoney(NaN, 'monto')).toThrow(ValidationError);
    });
  });
});
