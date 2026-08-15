import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CashRegisterSummary } from '@/components/caja/cash-register-summary';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import * as branchService from '@/application/services/branchService';
import { auth } from '@/auth';
import { getCurrentBranchIdOrRedirect } from '@/lib/auth';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CashRegisterDetailPage({ params }: Props) {
  const session = await auth();
  const branchId = await getCurrentBranchIdOrRedirect(session);

  const { id } = await params;
  const cashRegister = await cashRegisterService.getCashRegisterById(
    branchId,
    Number(id)
  );

  if (!cashRegister) {
    notFound();
  }

  const isOpen = cashRegister.status === 'open';
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
        <Link href="/ventas/historial" className="w-full sm:w-auto">
          <Button variant="outline" className="w-full sm:w-auto">
            Volver al historial
          </Button>
        </Link>
      </div>

      <CashRegisterSummary
        cashRegister={cashRegister}
        branchName={branchName}
        isOpen={isOpen}
      />
    </div>
  );
}
