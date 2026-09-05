import { addMoney, formatMoney, moneyToNumber, parseMoney } from '@/lib/money';
import { equal } from 'dinero.js';
import type { PaymentMethod, PaymentPart } from '@/domain/types';

export function parsePaymentAmount(raw: string): number | null {
  const value = raw.replace(/\s/g, '');
  if (!value) return null;

  const lastDot = value.lastIndexOf('.');
  const lastComma = value.lastIndexOf(',');

  let normalized: string;

  if (lastDot !== -1 && lastComma !== -1) {
    // Ambos separadores: el más a la derecha es el decimal.
    const decimalChar = lastDot > lastComma ? '.' : ',';
    const thousandsChar = decimalChar === '.' ? ',' : '.';
    normalized = value
      .split(thousandsChar)
      .join('')
      .replace(decimalChar, '.');
  } else if (lastDot !== -1) {
    // Si el grupo decimal tiene 1 o 2 dígitos, el punto es decimal; si no, es separador de miles.
    const decimalPart = value.slice(lastDot + 1);
    if (decimalPart.length <= 2) {
      normalized = value.replace(/\./g, (c, i) => (i === lastDot ? '.' : ''));
    } else {
      normalized = value.replace(/\./g, '');
    }
  } else if (lastComma !== -1) {
    const decimalPart = value.slice(lastComma + 1);
    if (decimalPart.length <= 2) {
      normalized = value.replace(/,/g, (c, i) => (i === lastComma ? '.' : ''));
    } else {
      normalized = value.replace(/,/g, '');
    }
  } else {
    normalized = value;
  }

  const parsed = Number(normalized);
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, Math.round(parsed));
}

export function sumPaymentParts(payments: PaymentPart[]): number {
  let total = parseMoney(0);
  for (const payment of payments) {
    total = addMoney(total, parseMoney(payment.amount));
  }
  return moneyToNumber(total);
}

export function amountByPaymentMethod(
  payments: PaymentPart[]
): Record<PaymentMethod, number> {
  const result: Record<PaymentMethod, number> = { cash: 0, transfer: 0 };
  for (const payment of payments) {
    result[payment.method] = moneyToNumber(
      addMoney(parseMoney(result[payment.method]), parseMoney(payment.amount))
    );
  }
  return result;
}

export function validatePaymentParts(
  payments: PaymentPart[],
  total: number
): { valid: boolean; error?: string } {
  if (payments.length === 0) {
    return { valid: false, error: 'Debe haber al menos un medio de pago.' };
  }

  const seenMethods = new Set<PaymentMethod>();
  for (const payment of payments) {
    if (payment.amount <= 0) {
      return { valid: false, error: 'Cada monto debe ser mayor a 0.' };
    }
    if (seenMethods.has(payment.method)) {
      return {
        valid: false,
        error: 'No puede haber más de una parte por medio de pago.',
      };
    }
    seenMethods.add(payment.method);
  }

  const paid = sumPaymentParts(payments);
  // Se compara en centavos con dinero.js para evitar errores de coma flotante.
  if (!equal(parseMoney(paid), parseMoney(total))) {
    return {
      valid: false,
      error: `La suma de los pagos (${formatMoney(
        paid
      )}) no coincide con el total (${formatMoney(total)}).`,
    };
  }

  return { valid: true };
}
