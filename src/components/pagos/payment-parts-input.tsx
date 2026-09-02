'use client';

import { useMemo, useState } from 'react';
import { Banknote, Landmark } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DEFAULT_DENOMINATIONS } from '@/config/payments';
import { formatMoney, formatNumber } from '@/lib/money';
import { parsePaymentAmount } from '@/lib/payment-helpers';
import type { PaymentMethod, PaymentPart } from '@/domain/types';

interface PaymentPartsInputProps {
  total: number;
  payments: PaymentPart[];
  onChange: (payments: PaymentPart[]) => void;
  disabled?: boolean;
}

const METHODS: {
  method: PaymentMethod;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { method: 'cash', label: 'Efectivo', icon: Banknote },
  { method: 'transfer', label: 'Transferencia', icon: Landmark },
];

const COMMON_BILLS = [1000, 2000, 5000, 10000, 20000, 50000];

function roundAmount(value: number): number {
  return Math.max(0, Math.round(value));
}

function getOtherMethod(method: PaymentMethod): PaymentMethod {
  return method === 'cash' ? 'transfer' : 'cash';
}

export function PaymentPartsInput({
  total,
  payments,
  onChange,
  disabled,
}: PaymentPartsInputProps) {
  const totalRounded = roundAmount(total);
  const [cashDelivered, setCashDelivered] = useState<number | null>(null);

  const byMethod = useMemo(() => {
    const map = new Map<PaymentMethod, number>();
    for (const payment of payments) {
      map.set(payment.method, roundAmount(payment.amount));
    }
    return map;
  }, [payments]);

  const paid = useMemo(() => {
    return payments.reduce((sum, payment) => sum + roundAmount(payment.amount), 0);
  }, [payments]);

  const remaining = totalRounded - paid;

  function isOnly(method: PaymentMethod) {
    return payments.length === 1 && payments[0].method === method;
  }

  const isMixed = payments.length === 2;

  function emitPayments(next: PaymentPart[]) {
    onChange(next.filter((p) => p.amount > 0));
  }

  function updatePayment(method: PaymentMethod, raw: string) {
    setCashDelivered(null);

    const parsed = parsePaymentAmount(raw);
    if (parsed === null) return;

    const otherMethod = getOtherMethod(method);
    const otherAmount = byMethod.get(otherMethod) ?? 0;
    const next: PaymentPart[] = [];

    if (parsed === 0) {
      // Se borró este método; conservar el otro si existe.
      if (otherAmount > 0) {
        next.push({ method: otherMethod, amount: otherAmount });
      }
      emitPayments(next);
      return;
    }

    if (otherAmount === 0) {
      // Solo este método o parcial.
      next.push({ method, amount: Math.min(parsed, totalRounded) });
      emitPayments(next);
      return;
    }

    if (otherAmount === totalRounded) {
      // El otro método cubría todo; al editar el nuevo método se divide el pago.
      const methodAmount = Math.min(parsed, totalRounded);
      next.push({ method, amount: methodAmount });
      const remainingForOther = totalRounded - methodAmount;
      if (remainingForOther > 0) {
        next.push({ method: otherMethod, amount: remainingForOther });
      }
      emitPayments(next);
      return;
    }

    // Ambos métodos ya tienen valores; ajustar el editado sin superar el total.
    const maxForMethod = totalRounded - otherAmount;
    const methodAmount = Math.min(parsed, maxForMethod);
    next.push({ method, amount: methodAmount });
    next.push({ method: otherMethod, amount: otherAmount });
    emitPayments(next);
  }

  function setFull(method: PaymentMethod) {
    setCashDelivered(null);
    emitPayments([{ method, amount: totalRounded }]);
  }

  function addToMethod(method: PaymentMethod, addend: number) {
    setCashDelivered(null);
    const otherMethod = getOtherMethod(method);
    const otherPaid = byMethod.get(otherMethod) ?? 0;
    const current = byMethod.get(method) ?? 0;
    const nextAmount = Math.min(current + addend, totalRounded - otherPaid);

    const next: PaymentPart[] = [];
    for (const config of METHODS) {
      const amount =
        config.method === method ? nextAmount : byMethod.get(config.method) ?? 0;
      if (amount > 0) {
        next.push({ method: config.method, amount });
      }
    }

    emitPayments(next);
  }

  function completeMethod(method: PaymentMethod) {
    addToMethod(method, Math.max(0, remaining));
  }

  function completeWithOther(method: PaymentMethod) {
    setCashDelivered(null);
    const otherMethod = getOtherMethod(method);
    const current = byMethod.get(method) ?? 0;

    if (current > 0 && current < totalRounded) {
      emitPayments([
        { method, amount: current },
        { method: otherMethod, amount: totalRounded - current },
      ]);
      return;
    }

    // Si no hay monto o sobra, ajustar al total exacto en este método.
    emitPayments([{ method, amount: totalRounded }]);
  }

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
    method: PaymentMethod
  ) {
    const key = event.key;

    if (key === 'Enter') {
      event.preventDefault();
      completeWithOther(method);
      return;
    }

    if (key === 'Escape') {
      event.preventDefault();
      setFull('cash');
      event.currentTarget.blur();
      return;
    }

    if (
      key === 'Backspace' ||
      key === 'Tab' ||
      key === 'ArrowLeft' ||
      key === 'ArrowRight' ||
      key === 'Home' ||
      key === 'End' ||
      key === 'Delete'
    ) {
      return;
    }

    if (/^[0-9.,]$/.test(key)) {
      return;
    }

    event.preventDefault();
  }

  function payWithBill(method: PaymentMethod, bill: number) {
    const otherMethod = getOtherMethod(method);
    const otherPaid = byMethod.get(otherMethod) ?? 0;

    if (method === 'cash') {
      const currentCash = cashDelivered ?? (byMethod.get('cash') ?? 0);
      const nextDelivered = currentCash + bill;
      setCashDelivered(nextDelivered);

      const cashPayment = Math.min(nextDelivered, totalRounded - otherPaid);
      const next: PaymentPart[] = [];
      if (cashPayment > 0) {
        next.push({ method: 'cash', amount: cashPayment });
      }
      if (otherPaid > 0) {
        next.push({ method: otherMethod, amount: otherPaid });
      }
      emitPayments(next);
      return;
    }

    const paymentAmount = Math.min(bill, totalRounded - otherPaid);
    const next: PaymentPart[] = [];
    for (const config of METHODS) {
      const amount =
        config.method === method
          ? paymentAmount
          : byMethod.get(config.method) ?? 0;
      if (amount > 0) {
        next.push({ method: config.method, amount });
      }
    }

    emitPayments(next);
  }

  function clearPayments() {
    setCashDelivered(null);
    emitPayments([]);
  }

  const remainingText =
    remaining > 0
      ? `Faltan: ${formatMoney(remaining)}`
      : remaining < 0
        ? `Sobran: ${formatMoney(Math.abs(remaining))}`
        : 'Pago completo';

  const remainingVariant =
    remaining === 0 ? 'default' : remaining < 0 ? 'destructive' : 'secondary';

  return (
    <div data-tour="payment-parts-input" className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {METHODS.map(({ method, label, icon: Icon }) => {
          const active = isOnly(method);
          return (
            <Button
              key={method}
              type="button"
              variant={active ? 'default' : 'outline'}
              size="sm"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => setFull(method)}
              data-testid={`payment-${method}-full`}
              className="gap-2"
            >
              <Icon className="h-4 w-4" />
              Todo {label.toLowerCase()}
            </Button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {METHODS.map(({ method, label }) => {
          const amount = byMethod.get(method) ?? 0;
          const canComplete = remaining > 0;
          const canCompleteOther = amount > 0 && amount < totalRounded;
          const otherMethod = getOtherMethod(method);
          const otherLabel = METHODS.find((m) => m.method === otherMethod)?.label ?? '';

          return (
            <div key={method} className="space-y-1">
              <Label htmlFor={`payment-${method}`}>{label}</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  id={`payment-${method}`}
                  data-testid={`payment-${method}-input`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9.,]*"
                  value={amount > 0 ? String(amount) : ''}
                  onChange={(e) => updatePayment(method, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, method)}
                  disabled={disabled}
                  placeholder="0"
                  className="pl-7"
                />
              </div>

              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Denominaciones</span>
                <div className="flex flex-wrap gap-1.5">
                  {DEFAULT_DENOMINATIONS.map((denomination) => (
                    <Button
                      key={denomination}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={disabled}
                      data-testid={`payment-${method}-denom-${denomination}`}
                      onClick={() => addToMethod(method, denomination)}
                      className="h-7 px-1.5 text-xs"
                    >
                      +{formatNumber(denomination)}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled || !canComplete}
                  data-testid={`payment-${method}-complete-rest`}
                  onClick={() => completeMethod(method)}
                  className="h-7 px-1.5 text-xs"
                >
                  Completar resto
                </Button>

                {canCompleteOther && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    data-testid={`payment-${method}-complete-other`}
                    onClick={() => completeWithOther(method)}
                    className="h-7 px-1.5 text-xs"
                  >
                    Completar con {otherLabel.toLowerCase()}
                  </Button>
                )}
              </div>

              {method === 'cash' && (
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Billetes</span>
                  <div className="flex flex-wrap gap-1.5">
                    {COMMON_BILLS.map((bill) => (
                      <Button
                        key={bill}
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={disabled}
                        data-testid={`payment-cash-bill-${bill}`}
                        onClick={() => payWithBill(method, bill)}
                        className="h-7 px-1.5 text-xs"
                      >
                        {formatNumber(bill)}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isMixed && (
          <Badge variant="default" data-testid="payment-mixed-badge">
            Mixto
          </Badge>
        )}
        <Badge
          variant={remainingVariant}
          data-testid="payment-remaining-badge"
          className="text-base"
        >
          {remainingText}
        </Badge>
        {cashDelivered !== null && cashDelivered > (byMethod.get('cash') ?? 0) && (
          <Badge
            variant="outline"
            data-testid="payment-change-badge"
            className="text-base"
          >
            Vuelto: {formatMoney(cashDelivered - (byMethod.get('cash') ?? 0))}
          </Badge>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          data-testid="payment-clear"
          onClick={clearPayments}
          className="h-7 px-2 text-xs"
        >
          Limpiar pago
        </Button>
      </div>
    </div>
  );
}
