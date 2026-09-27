'use client';

import { addHours, intervalToDuration } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { useClockInterval } from '@/hooks/use-clock-interval';
import {
  getAutoCloseHours,
  getCajaClockIntervalMs,
} from '@/config/caja';
import type { CashRegister, CloseCashRegisterInput } from '@/config/caja';
import { safeFormatDuration, formatTime } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import { resolveDisplayedCashRegisterAlert } from '@/lib/cash-register-helpers';
import { CashRegisterAlertBanner } from '@/components/caja/cash-register-alert';
import { CashRegisterShiftBadge } from '@/components/caja/cash-register-shift-badge';
import {
  CashRegisterCloseControls,
  CashRegisterOpenControls,
} from '@/components/caja/cash-register-controls';

interface CajaStatusProps {
  cashRegister: CashRegister | null;
  onOpen: (initialAmount?: number) => Promise<void>;
  onClose: (input: CloseCashRegisterInput) => Promise<void>;
  loading: boolean;
  error: string | null;
  role?: 'admin' | 'operator';
  userName?: string | null;
}

export function CajaStatus({
  cashRegister,
  onOpen,
  onClose,
  loading,
  error,
  role = 'operator',
  userName,
}: CajaStatusProps) {
  const now = useClockInterval(getCajaClockIntervalMs());

  if (!cashRegister || cashRegister.status === 'closed') {
    return (
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-lg">Estado de la caja</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CashRegisterOpenControls
            error={error}
            loading={loading}
            onOpen={onOpen}
          />
        </CardContent>
      </Card>
    );
  }

  const openedAt = new Date(cashRegister.openedAt);
  const autoCloseHours = cashRegister.autoCloseHours ?? getAutoCloseHours();
  const autoCloseAt = autoCloseHours > 0 ? addHours(openedAt, autoCloseHours) : null;
  const current = now;

  const elapsed = intervalToDuration({ start: openedAt, end: current });
  const remaining =
    autoCloseAt && autoCloseAt > current
      ? intervalToDuration({ start: current, end: autoCloseAt })
      : null;

  const openedAtTime = formatTime(openedAt);
  const alerta = resolveDisplayedCashRegisterAlert(
    cashRegister.alertaCaja,
    cashRegister.openedAt,
    now
  );

  return (
    <Card className="border-primary/30">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-lg">Estado de la caja</CardTitle>
          <p data-testid="cash-register-opened-by" className="text-sm text-muted-foreground">
            Abierta por {cashRegister.openedBy}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="default">Abierta</Badge>
          <CashRegisterShiftBadge estadoTurno={cashRegister.estadoTurno} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <CashRegisterAlertBanner alerta={alerta} openedAt={cashRegister.openedAt} />

        <p className="text-base">
          Caja abierta desde{' '}
          <span className="font-mono font-medium">{openedAtTime}</span> (hace{' '}
          {safeFormatDuration(elapsed)})
        </p>
        {cashRegister.initialAmount > 0 && (
          <p className="text-base">
            Monto inicial:{' '}
            <span className="font-mono font-medium">
              {formatMoney(cashRegister.initialAmount)}
            </span>
          </p>
        )}
        {autoCloseHours > 0 && (
          <p className="text-base text-muted-foreground">
            Se cierra automáticamente en{' '}
            <span className="font-mono text-foreground">
              {safeFormatDuration(remaining)}
            </span>
          </p>
        )}
        <CashRegisterCloseControls
          cashRegister={cashRegister}
          role={role}
          userName={userName}
          loading={loading}
          onClose={onClose}
        />
      </CardContent>
    </Card>
  );
}
