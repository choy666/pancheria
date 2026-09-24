import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CajaHistory } from '@/components/caja/caja-history';
import { auth } from '@/auth';
import { revalidateSessionUser } from '@/lib/auth';
import * as branchService from '@/application/services/branchService';
import { routes } from '@/config/routes';

export default async function VentasHistorialPage() {
  const session = await auth();
  // El rol puede quedar viejo en el JWT: se revalida contra la base antes
  // de usarlo para mostrar datos de administrador.
  const isAdmin =
    !!session?.user &&
    (await revalidateSessionUser(session)) &&
    session.user.role === 'admin';
  const branches = isAdmin ? await branchService.listBranches() : undefined;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Historial de cajas
        </h1>
        <Link href={routes.ventasHistorialEliminadas} className="w-full sm:w-auto">
          <Button variant="outline" className="w-full sm:w-auto">Cajas eliminadas</Button>
        </Link>
      </div>
      <div data-tour="cash-history-table">
        <CajaHistory
          detailRoute={routes.ventasHistorial}
          statusFilter="all"
          showAutoColumn={false}
          isAdmin={isAdmin}
          branches={branches}
        />
      </div>
    </div>
  );
}
