'use client';

import { useMemo } from 'react';
import { Banknote, Landmark } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export function PaymentPartsInput({
  total,
  payments,
  onChange,
  disabled,
}: PaymentPartsInputProps) {
  const byMethod = useMemo(() => {
    const map = new Map<PaymentMethod, number>();
    for (const payment of payments) {
      map.set(payment.method, payment.amount);
    }
    return map;
  }, [payments]);

  const paid = useMemo(() => {
    return payments.reduce((sum, payment) => sum + payment.amount, 0);
  }, [payments]);

  const remaining = total - paid;

  function isOnly(method: PaymentMethod) {
    return payments.length === 1 && payments[0].method === method;
  }

  const isMixed = payments.length === 2;

  function updatePayment(method: PaymentMethod, raw: string) {
    const value = raw === '' ? 0 : Number(raw);
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
    onChange([{ method, amount: total }]);
  }

  const remainingText =
    remaining > 0
      ? `Faltan: $${remaining.toFixed(2)}`
      : remaining < 0
        ? `Sobran: $${Math.abs(remaining).toFixed(2)}`
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
          return (
            <div key={method} className="space-y-1">
              <Label htmlFor={`payment-${method}`}>{label}</Label>
              <Input
                id={`payment-${method}`}
                data-testid={`payment-${method}-input`}
                type="number"
                min={0}
                step={0.01}
                value={amount > 0 ? amount.toFixed(2) : ''}
                onChange={(e) => updatePayment(method, e.target.value)}
                disabled={disabled}
                placeholder="0.00"
              />
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
