'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { formatNumber } from '@/lib/money';

interface MoneyAmountInputProps {
  id: string;
  /** Monto actual en pesos enteros. */
  amount: number;
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
export function MoneyAmountInput({
  id,
  amount,
  onRawChange,
  onKeyDown,
  disabled,
  placeholder = '0',
  className,
  testId,
  ariaLabel,
}: MoneyAmountInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const display = draft ?? (amount > 0 ? formatNumber(amount) : '');

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        $
      </span>
      <Input
        id={id}
        data-testid={testId}
        type="text"
        inputMode="decimal"
        value={display}
        aria-label={ariaLabel}
        onFocus={() => setDraft(amount > 0 ? formatNumber(amount) : '')}
        onChange={(event) => {
          setDraft(event.target.value);
          onRawChange(event.target.value);
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        className={className ?? 'pl-7'}
      />
    </div>
  );
}
