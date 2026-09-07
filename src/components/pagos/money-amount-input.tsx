'use client';

import { useState, forwardRef } from 'react';
import { Input } from '@/components/ui/input';
import { formatNumber } from '@/lib/money';

interface MoneyAmountInputProps {
  id: string;
  /** Monto actual. */
  amount: number;
  /** Cantidad de decimales a mostrar y parsear (0 por defecto). */
  decimals?: number;
  /** Recibe el texto crudo mientras se edita; el padre decide el parseo. */
  onRawChange: (raw: string) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  testId?: string;
  ariaLabel?: string;
}

/**
 * Input de monto con formato es-AR.
 *
 * Muestra el valor agrupado con separador de miles ("12.500") y conserva el
 * texto crudo mientras el campo está enfocado para no pelear con el caret;
 * al perder el foco vuelve a mostrar el valor formateado.
 */
export const MoneyAmountInput = forwardRef<
  HTMLInputElement,
  MoneyAmountInputProps
>(function MoneyAmountInput(
  {
    id,
    amount,
    decimals = 0,
    onRawChange,
    onKeyDown,
    disabled,
    placeholder = '',
    className,
    testId,
    ariaLabel,
  },
  ref
) {
  const [draft, setDraft] = useState<string | null>(null);
  const isEditing = draft !== null;
  const includeCents = decimals > 0;
  const display = isEditing
    ? draft
    : amount > 0
      ? formatNumber(amount, includeCents)
      : '';

  // El signo $ se muestra solo cuando el input está vacío y sin foco,
  // evitando que se superponga con el número ingresado.
  const showSymbol = !isEditing && amount === 0;

  return (
    <div className="relative">
      <span
        className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base font-semibold text-foreground ${
          showSymbol ? '' : 'hidden'
        }`}
      >
        $
      </span>
      <Input
        ref={ref}
        id={id}
        data-testid={testId}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={display}
        aria-label={ariaLabel}
        onFocus={() =>
          setDraft(amount > 0 ? formatNumber(amount, includeCents) : '')
        }
        onChange={(event) => {
          setDraft(event.target.value);
          onRawChange(event.target.value);
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        className={className ?? 'pl-11'}
      />
    </div>
  );
});
