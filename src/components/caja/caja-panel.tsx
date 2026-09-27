'use client';

import { Badge } from '@/components/ui/badge';
import { useCashRegister } from '@/hooks/useCashRegister';
import { Skeleton } from '@/components/ui/skeleton';
import { CashRegisterSummary } from '@/components/caja/cash-register-summary';
import { formatLastUpdated } from '@/lib/date';
import { resolveDisplayedCashRegisterAlert } from '@/lib/cash-register-helpers';
import { CashRegisterAlertBanner } from '@/components/caja/cash-register-alert';
import { CashRegisterShiftBadge } from '@/components/caja/cash-register-shift-badge';
import {
  CashRegisterCloseControls,
  CashRegisterOpenControls,
} from '@/components/caja/cash-register-controls';

interface CajaPanelProps {
  branchName?: string | null;
  role?: 'admin' | 'operator';
  userName?: string | null;
}

export function CajaPanel({ branchName, role = 'operator', userName }: CajaPanelProps) {
  const { cashRegister, loading, error, lastUpdated, open, close } =
    useCashRegister();

  if (loading) {
    return (
      <div data-tour="caja-panel" className="space-y-5">
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!cashRegister) {
    return (
      <div data-tour="caja-panel" className="space-y-5">
        <CashRegisterOpenControls
          error={error}
          onOpen={open}
          dataTour="caja-action"
        />
      </div>
    );
  }

  // El aviso llega calculado desde el servidor; el fallback cubre payloads
  // que todavía no lo incluyen.
  const alerta = resolveDisplayedCashRegisterAlert(
    cashRegister.alertaCaja,
    cashRegister.openedAt
  );

  return (
    <div data-tour="caja-panel" className="space-y-5">
      {error && (
        <div className="rounded-lg bg-destructive/15 p-4 text-base text-destructive">
          {error}
        </div>
      )}

      <CashRegisterAlertBanner alerta={alerta} openedAt={cashRegister.openedAt} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Caja #{cashRegister.id}</h2>
          <Badge variant="default">Abierta</Badge>
          <CashRegisterShiftBadge estadoTurno={cashRegister.estadoTurno} />
        </div>
        <CashRegisterCloseControls
          cashRegister={cashRegister}
          role={role}
          userName={userName}
          onClose={close}
          size="lg"
          dataTour="caja-action"
        />
      </div>

      <CashRegisterSummary cashRegister={cashRegister} branchName={branchName} now={new Date()} />

      <p className="text-xs text-muted-foreground">
        Última actualización: {formatLastUpdated(lastUpdated)}
      </p>
    </div>
  );
}
