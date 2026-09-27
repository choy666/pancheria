import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { revalidateSessionUser } from '@/lib/auth';
import { routes } from '@/config/routes';
import { BranchForm } from '@/components/sucursales/branch-form';
import {
  createBranch,
  updateBranchAction,
} from '@/app/(panel)/sucursales/actions';

export default async function NuevaSucursalPage() {
  const session = await auth();

  // El rol puede quedar viejo en el JWT: se revalida contra la base antes
  // de decidir el acceso (un admin degradado no debe ver esta página).
  if (
    !session?.user ||
    !(await revalidateSessionUser(session)) ||
    session.user.role !== 'admin'
  ) {
    redirect(routes.home);
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">
        Nueva sucursal
      </h1>
      <div data-tour="branch-form">
        <BranchForm
          createBranchAction={createBranch}
          updateBranchAction={updateBranchAction}
        />
      </div>
    </div>
  );
}
