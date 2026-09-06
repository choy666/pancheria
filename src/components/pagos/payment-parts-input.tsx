'use client';

import { useMemo, useState } from 'react';
import { Banknote, Landmark } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MoneyAmountInput } from '@/components/pagos/money-amount-input';
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

function roundAmount(value: number): number {
  return Math.max(0, Math.round(value));
}

function getOtherMethod(method: PaymentMethod): PaymentMethod {
  return method === 'cash' ? 'transfer' : 'cash';
}

/**
 * Sección de cobro del terminal de ventas y del panel de pedidos.
 *
 * Cada método tiene un monto "cobrado" (lo que se registra en la venta) y,
 * solo para efectivo, un monto "recibido" (lo que entrega el cliente) que se
 * usa para calcular el vuelto. Editar un método nunca modifica el otro: el
 * reparto del pago mixto es explícito con "Completar resto" o
 * "Completar con {otro}".
 */
export function PaymentPartsInput({
  total,
  payments,
  onChange,
  disabled,
}: PaymentPartsInputProps) {
  const totalRounded = roundAmount(total);
  const [cashReceived, setCashReceived] = useState<number | null>(null);

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
  const cashPart = byMethod.get('cash') ?? 0;

  // El efectivo recibido deja de tener sentido cuando cambia la venta (total
  // distinto, p. ej. al confirmar y volver a 0) o cuando ya no se cobra en
  // efectivo. Se resetea durante el render siguiendo el patrón de React de
  // "adjust state when props change" para no mostrar vueltos de ventas
  // anteriores.
  const [prevSnapshot, setPrevSnapshot] = useState({
    total: totalRounded,
    cash: cashPart,
  });
  if (prevSnapshot.total !== totalRounded || prevSnapshot.cash !== cashPart) {
    const shouldReset = prevSnapshot.total !== totalRounded || cashPart === 0;
    setPrevSnapshot({ total: totalRounded, cash: cashPart });
    if (shouldReset && cashReceived !== null) {
      setCashReceived(null);
    }
  }

  function isOnly(method: PaymentMethod) {
    return payments.length === 1 && payments[0].method === method;
  }

  const isMixed = payments.length === 2;

  function emitPayments(next: PaymentPart[]) {
    onChange(next.filter((p) => p.amount > 0));
  }

  function updatePayment(method: PaymentMethod, raw: string) {
    const parsed = parsePaymentAmount(raw);
    if (parsed === null) return;

    const otherMethod = getOtherMethod(method);
    const otherAmount = byMethod.get(otherMethod) ?? 0;

    // El monto editado se clampa a lo que falta cubrir; el otro método no se
    // toca: el reparto entre medios de pago siempre es explícito.
    const amount = Math.min(parsed, Math.max(0, totalRounded - otherAmount));

    const next: PaymentPart[] = [];
    if (amount > 0) {
      next.push({ method, amount });
    }
    if (otherAmount > 0) {
      next.push({ method: otherMethod, amount: otherAmount });
    }
    emitPayments(next);
  }

  function setFull(method: PaymentMethod) {
    emitPayments([{ method, amount: totalRounded }]);
  }

  function addToMethod(method: PaymentMethod, addend: number) {
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
    const otherMethod = getOtherMethod(method);
    const current = byMethod.get(method) ?? 0;

    if (current > 0 && current < totalRounded) {
      emitPayments([
        { method, amount: current },
        { method: otherMethod, amount: totalRounded - current },
      ]);
      return;
    }

    // Si no hay monto o ya cubre todo, dejar el total exacto en este método.
    emitPayments([{ method, amount: totalRounded }]);
  }

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
    method: PaymentMethod
  ) {
    const key = event.key;

    if (key === 'Enter') {
      event.preventDefault();
      completeMethod(method);
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

  function applyCashReceived(received: number) {
    const transferPaid = byMethod.get('transfer') ?? 0;
    const cashAmount = Math.min(
      received,
      Math.max(0, totalRounded - transferPaid)
    );

    setCashReceived(received);

    const next: PaymentPart[] = [];
    if (cashAmount > 0) {
      next.push({ method: 'cash', amount: cashAmount });
    }
    if (transferPaid > 0) {
      next.push({ method: 'transfer', amount: transferPaid });
    }
    emitPayments(next);
  }

  function updateCashReceived(raw: string) {
    if (raw.trim() === '') {
      setCashReceived(null);
      return;
    }

    const parsed = parsePaymentAmount(raw);
    if (parsed === null) return;

    applyCashReceived(parsed);
  }

  function addCashBill(bill: number) {
    applyCashReceived((cashReceived ?? 0) + bill);
  }

  function clearPayments() {
    setCashReceived(null);
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
            <div key={method} className="space-y-2">
              <div className="space-y-1">
                <Label htmlFor={`payment-${method}`}>{label} cobrado</Label>
                <MoneyAmountInput
                  id={`payment-${method}`}
                  testId={`payment-${method}-input`}
                  amount={amount}
                  onRawChange={(raw) => updatePayment(method, raw)}
                  onKeyDown={(e) => handleKeyDown(e, method)}
                  disabled={disabled}
                  ariaLabel={`Monto cobrado en ${label.toLowerCase()}`}
                />
              </div>

              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">
                  Sumar al monto
                </span>
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
                      className="min-h-11 min-w-11 px-1.5 text-xs"
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
                  className="min-h-11 min-w-11 px-1.5 text-xs"
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
                    className="min-h-11 min-w-11 px-1.5 text-xs"
                  >
                    Completar con {otherLabel.toLowerCase()}
                  </Button>
                )}
              </div>

              {method === 'cash' && (
                <div className="space-y-1">
                  <Label htmlFor="payment-cash-received">
                    Efectivo recibido
                  </Label>
                  <MoneyAmountInput
                    id="payment-cash-received"
                    testId="payment-cash-received-input"
                    amount={cashReceived ?? 0}
                    onRawChange={updateCashReceived}
                    disabled={disabled}
                    ariaLabel="Efectivo recibido para calcular el vuelto"
                  />
                  <span className="text-xs text-muted-foreground">
                    Billetes recibidos
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {DEFAULT_DENOMINATIONS.map((bill) => (
                      <Button
                        key={bill}
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={disabled}
                        data-testid={`payment-cash-bill-${bill}`}
                        onClick={() => addCashBill(bill)}
                        className="min-h-11 min-w-11 px-1.5 text-xs"
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

      {cashReceived !== null && (
        <div
          className="flex flex-wrap items-center gap-2"
          data-testid="payment-received-line"
        >
          <span className="text-sm text-muted-foreground">
            Recibido en efectivo: {formatMoney(cashReceived)}
          </span>
          {cashReceived > cashPart && (
            <Badge
              variant="outline"
              data-testid="payment-change-badge"
              className="text-base"
            >
              Vuelto: {formatMoney(cashReceived - cashPart)}
            </Badge>
          )}
          {cashReceived < cashPart && (
            <Badge
              variant="secondary"
              data-testid="payment-missing-badge"
              className="text-base"
            >
              Falta recibir: {formatMoney(cashPart - cashReceived)}
            </Badge>
          )}
        </div>
      )}

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
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          data-testid="payment-clear"
          onClick={clearPayments}
          className="min-h-11 min-w-11 px-2 text-xs"
        >
          Limpiar pago
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Enter completa el resto con ese medio · Esc pasa todo a efectivo.
      </p>
    </div>
  );
}
