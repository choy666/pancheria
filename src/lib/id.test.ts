import { decodeRouteParam, parseId } from './id';
import { ValidationError } from '@/domain/errors';

describe('parseId', () => {
  test('convierte un string numérico a número', () => {
    expect(parseId('42')).toBe(42);
  });

  test('acepta un número positivo', () => {
    expect(parseId(42)).toBe(42);
  });

  test('rechaza cero', () => {
    expect(parseId('0')).toBeNull();
  });

  test('rechaza números negativos', () => {
    expect(parseId('-5')).toBeNull();
  });

  test('rechaza valores no numéricos', () => {
    expect(parseId('abc')).toBeNull();
  });

  test('rechaza decimales', () => {
    expect(parseId('3.14')).toBeNull();
  });

  test('rechaza valores nulos o indefinidos', () => {
    expect(parseId(null)).toBeNull();
    expect(parseId(undefined)).toBeNull();
  });
});

describe('decodeRouteParam', () => {
  test('decodifica un segmento escapado', () => {
    expect(decodeRouteParam('chat%2F10%2Fabc.jpg')).toBe('chat/10/abc.jpg');
  });

  test('rechaza escapes inválidos con un error de validación', () => {
    expect(() => decodeRouteParam('%E0%A4%A')).toThrow(ValidationError);
  });
});
