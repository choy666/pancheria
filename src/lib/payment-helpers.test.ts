import {
  parsePaymentAmount,
  sumPaymentParts,
  validatePaymentParts,
} from './payment-helpers';

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

describe('sumPaymentParts', () => {
  test('suma pagos enteros sin errores de coma flotante', () => {
    const payments = [
      { method: 'cash' as const, amount: 333 },
      { method: 'transfer' as const, amount: 667 },
    ];
    expect(sumPaymentParts(payments)).toBe(1000);
  });
});

describe('validatePaymentParts', () => {
  test('acepta un pago exacto', () => {
    const result = validatePaymentParts(
      [{ method: 'cash', amount: 1500 }],
      1500
    );
    expect(result).toEqual({ valid: true });
  });

  test('acepta un pago mixto exacto', () => {
    const result = validatePaymentParts(
      [
        { method: 'cash', amount: 700 },
        { method: 'transfer', amount: 800 },
      ],
      1500
    );
    expect(result).toEqual({ valid: true });
  });

  test('rechaza la lista vacía', () => {
    const result = validatePaymentParts([], 1500);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Debe haber al menos un medio de pago.');
  });

  test('rechaza montos menores o iguales a cero', () => {
    const result = validatePaymentParts(
      [{ method: 'cash', amount: 0 }],
      1500
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Cada monto debe ser mayor a 0.');
  });

  test('rechaza métodos de pago duplicados', () => {
    const result = validatePaymentParts(
      [
        { method: 'cash', amount: 700 },
        { method: 'cash', amount: 800 },
      ],
      1500
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBe('No puede haber más de una parte por medio de pago.');
  });

  test('rechaza cuando la suma no coincide con el total', () => {
    const result = validatePaymentParts(
      [{ method: 'cash', amount: 1000 }],
      1500
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain('no coincide con el total');
  });

  test('compara en centavos para evitar errores de coma flotante', () => {
    const result = validatePaymentParts(
      [{ method: 'cash', amount: 1000.3 }],
      1000.3
    );
    expect(result).toEqual({ valid: true });
  });

  test('rechaza diferencias de centavos', () => {
    const result = validatePaymentParts(
      [{ method: 'cash', amount: 1000.3 }],
      1000.4
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain('no coincide con el total');
  });
});
