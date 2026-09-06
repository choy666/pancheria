import { addMoney, formatMoney, moneyToNumber, parseMoney } from '@/lib/money';
import { equal } from 'dinero.js';
import type { PaymentMethod, PaymentPart } from '@/domain/types';

/**
 * Parsea un monto ingresado por el operador con una regla única es-AR:
 * '.' es siempre separador de miles y ',' es siempre separador decimal
 * (máx. una coma; los decimales se redondean a pesos enteros).
 * Devuelve null si el texto no es un número válido.
 */
export function parsePaymentAmount(raw: string): number | null {
  const value = raw.replace(/\s/g, '');
  if (!value) return null;

  const normalized = value.replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
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
