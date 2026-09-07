'use client';

import { useMemo, useRef } from 'react';
import { Banknote, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MoneyAmountInput } from '@/components/pagos/money-amount-input';
import { formatMoney } from '@/lib/money';
import {
  amountByPaymentMethod,
  parsePaymentAmount,
} from '@/lib/payment-helpers';
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
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { method: 'cash', label: 'Efectivo', shortLabel: 'efectivo', icon: Banknote },
  {
    method: 'transfer',
    label: 'Transferencia',
    shortLabel: 'transferencia',
    icon: Landmark,
  },
];

function roundAmount(value: number): number {
  return Math.max(0, Math.round(value));
}

/**
 * Sección de cobro del terminal de ventas y del panel de pedidos.
 *
 * Muestra dos inputs claros (efectivo y transferencia) para que el operador
 * ingrese libremente los montos. Incluye atajos para completar el total en
 * un solo medio de pago. El pago puede ser todo en uno de los medios, mixto
 * o cualquier combinación que sume el total.
 */
export function PaymentPartsInput({
  total,
  payments,
  onChange,
  disabled,
}: PaymentPartsInputProps) {
  const totalRounded = roundAmount(total);
  const byMethod = useMemo(() => amountByPaymentMethod(payments), [payments]);
  const paid = byMethod.cash + byMethod.transfer;
  const remaining = totalRounded - paid;

  const inputRefs = useRef<Record<PaymentMethod, HTMLInputElement | null>>({
    cash: null,
    transfer: null,
  });

  const remainingText =
    remaining > 0
      ? `Faltan ${formatMoney(remaining)}`
      : remaining < 0
        ? `Sobran ${formatMoney(Math.abs(remaining))}`
        : 'Pago completo';

  const remainingClass =
    remaining === 0 ? 'text-muted-foreground' : 'text-amber-500';

  function updatePayment(method: PaymentMethod, raw: string) {
    const parsed = raw.trim() === '' ? 0 : parsePaymentAmount(raw);
    if (parsed === null) return;

    const next: PaymentPart[] = [];
    for (const config of METHODS) {
      const amount =
        config.method === method ? parsed : byMethod[config.method];
      next.push({ method: config.method, amount });
    }
    onChange(next);
  }

  function setAll(method: PaymentMethod) {
    const next: PaymentPart[] = METHODS.map((config) => ({
      method: config.method,
      amount: config.method === method ? totalRounded : 0,
    }));
    onChange(next);

    window.setTimeout(() => {
      inputRefs.current[method]?.focus();
    }, 0);
  }

  return (
    <div data-tour="payment-parts-input" className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {METHODS.map(({ method, label, shortLabel, icon: Icon }) => (
          <div
            key={method}
            className="space-y-2 rounded-lg border border-border p-3"
          >
            <Label
              htmlFor={`payment-${method}`}
              className="flex items-center gap-2 text-sm font-medium"
            >
              <Icon className="h-4 w-4 text-primary" />
              {label}
            </Label>
            <MoneyAmountInput
              ref={(el) => {
                inputRefs.current[method] = el;
              }}
              id={`payment-${method}`}
              testId={`payment-${method}-input`}
              amount={byMethod[method]}
              onRawChange={(raw) => updatePayment(method, raw)}
              disabled={disabled}
              ariaLabel={`Monto en ${shortLabel}`}
              className="pl-11 bg-background font-mono text-base font-semibold"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-testid={`payment-${method}-full`}
              disabled={disabled}
              onClick={() => setAll(method)}
              className="h-7 w-full text-xs"
            >
              Todo en {shortLabel}
            </Button>
          </div>
        ))}
      </div>

      <p
        data-testid="payment-remaining-message"
        className={`text-sm ${remainingClass}`}
      >
        {remainingText}
      </p>
    </div>
  );
}
