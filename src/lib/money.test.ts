import {
  addMoney,
  moneyToNumber,
  moneyToString,
  multiplyMoney,
  parseMoney,
  sumMoney,
} from './money';

describe('money', () => {
  it('parsea un monto decimal a dinero', () => {
    const money = parseMoney(1500.5);
    expect(moneyToNumber(money)).toBe(1500.5);
  });

  it('suma dos montos', () => {
    const a = parseMoney(10);
    const b = parseMoney(20.5);
    expect(moneyToNumber(addMoney(a, b))).toBe(30.5);
  });

  it('multiplica por un factor', () => {
    const money = parseMoney(15);
    expect(moneyToNumber(multiplyMoney(money, 3))).toBe(45);
  });

  it('suma una lista de montos', () => {
    const monies = [parseMoney(1), parseMoney(2), parseMoney(3)];
    expect(moneyToNumber(sumMoney(monies))).toBe(6);
  });

  it('convierte un dinero a cadena con dos decimales', () => {
    const money = parseMoney(1500.5);
    expect(moneyToString(money)).toBe('1500.50');
  });

  it('convierte cero a cadena', () => {
    const money = parseMoney(0);
    expect(moneyToString(money)).toBe('0.00');
  });

  it('redondea un monto con más de dos decimales', () => {
    const money = parseMoney(10.999);
    expect(moneyToNumber(money)).toBe(11);
    expect(moneyToString(money)).toBe('11.00');
  });

  it('redondea hacia abajo cuando corresponde', () => {
    const money = parseMoney(10.994);
    expect(moneyToNumber(money)).toBe(10.99);
    expect(moneyToString(money)).toBe('10.99');
  });
});
