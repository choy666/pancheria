import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { SalesHistory } from '@/components/ventas/sales-history';
import { formatDateTime } from '@/lib/date';
import { CashRegisterDetailActions } from '@/components/caja/cash-register-detail-actions';
import { CashRegisterSummary } from '@/components/caja/cash-register-summary';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import * as branchService from '@/application/services/branchService';
import { auth } from '@/auth';
import { getCurrentBranchId } from '@/lib/auth';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}

export default async function CashRegisterSalesDetailPage({
  params,
  searchParams,
}: Props) {
  const session = await auth();
  const branchId = await getCurrentBranchId(session);

  const { id } = await params;
  const { from } = await searchParams;
  const cashRegister = await cashRegisterService.getCashRegisterById(
    branchId,
    Number(id),
    true
  );

  if (!cashRegister) {
    notFound();
  }

  const isOpen = cashRegister.status === 'open' && !cashRegister.deletedAt;
  const fromTrash = from === 'trash';

  const summary = await cashRegisterService.parseCashRegisterSummary(
    branchId,
    cashRegister,
    isOpen
  );

  const branchName =
    session?.user?.role === 'admin'
      ? (await branchService.getBranchById(cashRegister.branchId))?.name
      : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            Caja #{cashRegister.id}
          </h1>
          {isOpen ? (
            <Badge variant="default">Abierta</Badge>
          ) : (
            <Badge variant="secondary">Cerrada</Badge>
          )}
        </div>
        <CashRegisterDetailActions
          cashRegister={{
            id: cashRegister.id,
            status: cashRegister.status,
            deletedAt: cashRegister.deletedAt
              ? cashRegister.deletedAt.toISOString()
              : null,
          }}
          fromTrash={fromTrash}
          isAdmin={session?.user?.role === 'admin'}
        />
      </div>

      {cashRegister.deletedAt && (
        <div className="rounded-lg bg-destructive/15 p-4 text-base text-destructive">
          Esta caja fue eliminada el {formatDateTime(cashRegister.deletedAt)}.
        </div>
      )}

      <CashRegisterSummary
        cashRegister={{ ...cashRegister, ...summary }}
        branchName={branchName}
        isOpen={isOpen}
      />

      <div className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Ventas de la caja</h2>
        <SalesHistory
          cashRegisterId={cashRegister.id}
          allowCancel={!cashRegister.deletedAt}
        />
      </div>
    </div>
  );
}
