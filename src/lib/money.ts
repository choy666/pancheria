import {
  dinero,
  toDecimal,
  add,
  multiply,
  type Dinero,
} from 'dinero.js';

// Definición de la moneda argentina (ARS) para dinero.js.
// El paquete oficial de monedas no está disponible en el registro,
// por lo que se define la moneda localmente.
const ARS = {
  code: 'ARS',
  base: 10,
  exponent: 2,
} as const;

export type Money = Dinero<number, 'ARS'>;

export function parseMoney(amount: number): Money {
  return dinero({
    amount: Math.round(amount * 100),
    currency: ARS,
  });
}

export function moneyToNumber(money: Money): number {
  return Number(toDecimal(money));
}

export function addMoney(a: Money, b: Money): Money {
  return add(a, b);
}

export function multiplyMoney(money: Money, factor: number): Money {
  return multiply(money, { amount: Math.round(factor * 100), scale: 2 });
}


