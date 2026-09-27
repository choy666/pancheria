import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { revalidateSessionUser } from '@/lib/auth';
import { routes } from '@/config/routes';
import { getDefaultBranchName } from '@/config/branch';
import * as branchService from '@/application/services/branchService';
import { BranchForm } from '@/components/sucursales/branch-form';
import {
  createBranch,
  updateBranchAction,
} from '@/app/(panel)/sucursales/actions';

interface PageParams {
  params: Promise<{ id: string }>;
}

export default async function EditarSucursalPage({ params }: PageParams) {
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

  const { id } = await params;
  const branchId = Number(id);
  // `Number('abc')` produce NaN: se trata como ruta inexistente en vez de
  // dejar que la consulta falle contra la base.
  if (!Number.isInteger(branchId)) {
    notFound();
  }

  const branch = await branchService.getBranchById(branchId);
  if (!branch) {
    notFound();
  }

  // Igualdad exacta, igual que `getDefaultBranchId` (`findByName`,
  // case-sensitive): si el nombre coincide, renombrarla dejaría /pedido
  // sin sucursal canónica y el formulario lo advierte.
  const isDefaultBranch = branch.name === getDefaultBranchName();

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">
        Editar sucursal
      </h1>
      <div data-tour="branch-form">
        <BranchForm
          branch={branch}
          isDefaultBranch={isDefaultBranch}
          createBranchAction={createBranch}
          updateBranchAction={updateBranchAction}
        />
      </div>
    </div>
  );
}
