import { addMoney, moneyToNumber, multiplyMoney, parseMoney, sumMoney } from './money';

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
});
