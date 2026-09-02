import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PaymentMethod, PaymentPart } from '@/domain/types';

function roundAmount(value: number): number {
  return Math.max(0, Math.round(value));
}

function sumPayments(payments: PaymentPart[]): number {
  return payments.reduce((sum, p) => sum + roundAmount(p.amount), 0);
}

function isPaymentComplete(payments: PaymentPart[], total: number): boolean {
  return Math.round(sumPayments(payments)) === Math.round(total);
}

function distributePayments(
  payments: PaymentPart[],
  total: number
): PaymentPart[] {
  const validPayments = payments.filter((p) => p.amount > 0);
  if (validPayments.length === 0) return [{ method: 'cash', amount: total }];

  const oldTotal = sumPayments(validPayments);
  if (oldTotal === 0) {
    return validPayments.map((p, index) => ({
      ...p,
      amount: index === 0 ? total : 0,
    }));
  }

  const ratio = total / oldTotal;
  const result = validPayments.map((p) => ({
    ...p,
    amount: roundAmount(p.amount * ratio),
  }));

  const newTotal = sumPayments(result);
  const diff = total - newTotal;
  if (diff !== 0) {
    result[result.length - 1].amount = roundAmount(
      result[result.length - 1].amount + diff
    );
  }

  return result.filter((p) => p.amount > 0);
}

export interface UsePaymentPartsOptions {
  defaultMethod?: PaymentMethod;
  /** Si es `true` y los pagos ingresados no suman el total, vuelve al pago por defecto. */
  fallbackOnInvalid?: boolean;
  /** Si es `true`, al cambiar el total se redistribuyen los montos manteniendo la proporción. */
  redistributeOnTotalChange?: boolean;
}

export interface UsePaymentPartsResult {
  paymentParts: PaymentPart[];
  setPayments: (payments: PaymentPart[] | null) => void;
  rawPayments: PaymentPart[] | null;
  total: number;
  paid: number;
  remaining: number;
  isComplete: boolean;
  isMixed: boolean;
}

export function usePaymentParts(
  total: number,
  options: UsePaymentPartsOptions = {}
): UsePaymentPartsResult {
  const {
    defaultMethod = 'cash',
    fallbackOnInvalid = false,
    redistributeOnTotalChange = false,
  } = options;

  const [payments, setPaymentsState] = useState<PaymentPart[] | null>(null);
  const previousTotalRef = useRef(total);

  const totalRounded = roundAmount(total);

  const paymentParts = useMemo<PaymentPart[]>(() => {
    if (!payments || payments.length === 0) {
      return [{ method: defaultMethod, amount: totalRounded }];
    }
    if (isPaymentComplete(payments, totalRounded)) {
      return payments;
    }
    return fallbackOnInvalid
      ? [{ method: defaultMethod, amount: totalRounded }]
      : payments;
  }, [payments, totalRounded, defaultMethod, fallbackOnInvalid]);

  useEffect(() => {
    if (!redistributeOnTotalChange || !payments || payments.length === 0) {
      previousTotalRef.current = total;
      return;
    }

    if (Math.round(total) !== Math.round(previousTotalRef.current)) {
      setPaymentsState(distributePayments(payments, totalRounded));
    }

    previousTotalRef.current = total;
  }, [total, totalRounded, payments, redistributeOnTotalChange]);

  const setPayments = useCallback(
    (next: PaymentPart[] | null) => {
      setPaymentsState(next);
      previousTotalRef.current = total;
    },
    [total]
  );

  const paid = useMemo(() => sumPayments(paymentParts), [paymentParts]);
  const remaining = useMemo(
    () => totalRounded - paid,
    [totalRounded, paid]
  );
  const isComplete = useMemo(
    () => Math.round(remaining) === 0,
    [remaining]
  );
  const isMixed = useMemo(
    () => paymentParts.length === 2,
    [paymentParts]
  );

  return {
    paymentParts,
    setPayments,
    rawPayments: payments,
    total: totalRounded,
    paid,
    remaining,
    isComplete,
    isMixed,
  };
}
