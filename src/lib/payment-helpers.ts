import { addMoney, formatMoney, moneyToNumber, parseMoney } from '@/lib/money';
import type { PaymentMethod, PaymentPart } from '@/domain/types';

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
  if (Math.round(paid) !== Math.round(total)) {
    return {
      valid: false,
      error: `La suma de los pagos (${formatMoney(
        paid
      )}) no coincide con el total (${formatMoney(total)}).`,
    };
  }

  return { valid: true };
}
