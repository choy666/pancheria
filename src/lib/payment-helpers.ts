import { addMoney, formatMoney, moneyToNumber, parseMoney } from '@/lib/money';
import { equal } from 'dinero.js';
import type { PaymentMethod, PaymentPart } from '@/domain/types';

/**
 * Catálogo centralizado de medios de pago. Debe mantenerse alineado con
 * `paymentMethodEnum` del esquema y con el tipo `PaymentMethod` del dominio.
 */
export const PAYMENT_METHODS = [
  'cash',
  'transfer',
] as const satisfies readonly PaymentMethod[];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
};

/**
 * Parsea un monto ingresado por el operador con una regla única es-AR:
 * '.' es siempre separador de miles y ',' es siempre separador decimal
 * (máx. una coma; los decimales se redondean según `decimals`).
 * Devuelve null si el texto no es un número válido.
 */
export function parseMoneyAmount(
  raw: string,
  decimals = 0
): number | null {
  const value = raw.replace(/\s/g, '');
  if (!value) return null;

  const normalized = value.replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;

  const factor = 10 ** decimals;
  return Math.max(0, Math.round(parsed * factor) / factor);
}

export function parsePaymentAmount(raw: string): number | null {
  return parseMoneyAmount(raw, 0);
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
  const result = Object.fromEntries(
    PAYMENT_METHODS.map((method) => [method, 0])
  ) as Record<PaymentMethod, number>;
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
