import {
  addMoney,
  moneyToNumber,
  multiplyMoney,
  parseMoney,
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

  it('redondea un monto con más de dos decimales', () => {
    const money = parseMoney(10.999);
    expect(moneyToNumber(money)).toBe(11);
  });

  it('redondea hacia abajo cuando corresponde', () => {
    const money = parseMoney(10.994);
    expect(moneyToNumber(money)).toBe(10.99);
  });
});
