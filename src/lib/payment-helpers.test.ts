import { parsePaymentAmount } from './payment-helpers';

describe('parsePaymentAmount', () => {
  test('acepta números enteros', () => {
    expect(parsePaymentAmount('1500')).toBe(1500);
  });

  test('usa el punto como separador de miles', () => {
    expect(parsePaymentAmount('1.500')).toBe(1500);
    expect(parsePaymentAmount('1.500.000')).toBe(1500000);
  });

  test('usa la coma como separador de miles', () => {
    expect(parsePaymentAmount('1,500')).toBe(1500);
  });

  test('acepta coma como separador decimal y redondea', () => {
    expect(parsePaymentAmount('1500,70')).toBe(1501);
    expect(parsePaymentAmount('1500,30')).toBe(1500);
  });

  test('acepta punto como separador decimal y redondea', () => {
    expect(parsePaymentAmount('1500.70')).toBe(1501);
    expect(parsePaymentAmount('1500.30')).toBe(1500);
  });

  test('detecta ambos separadores usando el más a la derecha como decimal', () => {
    expect(parsePaymentAmount('1.500,70')).toBe(1501);
    expect(parsePaymentAmount('1,500.70')).toBe(1501);
  });

  test('devuelve null para texto vacío', () => {
    expect(parsePaymentAmount('')).toBeNull();
  });

  test('ignora espacios y devuelve null para valores inválidos', () => {
    expect(parsePaymentAmount('  ')).toBeNull();
    expect(parsePaymentAmount('abc')).toBeNull();
  });

  test('nunca devuelve un valor negativo', () => {
    expect(parsePaymentAmount('-100')).toBe(0);
  });
});
