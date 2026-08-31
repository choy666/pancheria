'use client';

import { useMemo } from 'react';
import { Banknote, Landmark } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DEFAULT_DENOMINATIONS } from '@/config/payments';
import { formatMoney, formatNumber } from '@/lib/money';
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

export function PaymentPartsInput({
  total,
  payments,
  onChange,
  disabled,
}: PaymentPartsInputProps) {
  const totalRounded = roundAmount(total);

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

  function updatePayment(method: PaymentMethod, raw: string) {
    const value = raw === '' ? 0 : roundAmount(Number(raw));
    if (Number.isNaN(value) || value < 0) return;

    const next: PaymentPart[] = [];
    for (const config of METHODS) {
      const amount =
        config.method === method ? value : (byMethod.get(config.method) ?? 0);
      if (amount > 0) {
        next.push({ method: config.method, amount });
      }
    }
    onChange(next);
  }

  function setFull(method: PaymentMethod) {
    onChange([{ method, amount: totalRounded }]);
  }

  function addToMethod(method: PaymentMethod, addend: number) {
    const otherPaid = paid - (byMethod.get(method) ?? 0);
    const current = byMethod.get(method) ?? 0;
    const nextAmount = Math.min(current + addend, totalRounded - otherPaid);
    const next: PaymentPart[] = [];

    for (const config of METHODS) {
      const amount =
        config.method === method ? nextAmount : (byMethod.get(config.method) ?? 0);
      if (amount > 0) {
        next.push({ method: config.method, amount });
      }
    }

    onChange(next);
  }

  function completeMethod(method: PaymentMethod) {
    addToMethod(method, Math.max(0, remaining));
  }

  const remainingText =
    remaining > 0
      ? `Faltan: ${formatMoney(remaining)}`
      : remaining < 0
        ? `Sobran: ${formatMoney(Math.abs(remaining))}`
        : 'Pago completo';

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
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  step={1}
                  min={0}
                  value={amount > 0 ? String(amount) : ''}
                  onChange={(e) => updatePayment(method, e.target.value)}
                  disabled={disabled}
                  placeholder="0"
                  className="pl-7"
                />
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
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
          variant={remaining === 0 ? 'default' : 'secondary'}
          data-testid="payment-remaining-badge"
        >
          {remainingText}
        </Badge>
      </div>
    </div>
  );
}
