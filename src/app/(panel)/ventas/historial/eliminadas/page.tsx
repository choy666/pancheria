import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CajaHistory } from '@/components/caja/caja-history';
import { auth } from '@/auth';
import * as branchService from '@/application/services/branchService';
import { routes } from '@/config/routes';

export default async function CajasEliminadasPage() {
  const session = await auth();

  if (session?.user?.role !== 'admin') {
    redirect(routes.ventasHistorial);
  }

  const branches = await branchService.listBranches();

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Cajas eliminadas</h1>
        <Link href={routes.ventasHistorial} className="w-full sm:w-auto">
          <Button variant="outline" className="w-full sm:w-auto">Volver al historial</Button>
        </Link>
      </div>
      <CajaHistory
        detailRoute={routes.ventasHistorial}
        deletedOnly
        showAutoColumn={false}
        isAdmin
        branches={branches}
      />
    </div>
  );
}
