import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { revalidateSessionUser } from '@/lib/auth';
import { routes } from '@/config/routes';
import { listBranchesForRequest } from '@/lib/server-cache';
import { UserForm } from '@/components/usuarios/user-form';
import {
  createUser,
  updateUserAction,
} from '@/app/(panel)/usuarios/actions';

export default async function NuevoUsuarioPage() {
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

  const branches = await listBranchesForRequest();

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">
        Nuevo usuario
      </h1>
      <div data-tour="user-form">
        <UserForm
          branches={branches}
          createUser={createUser}
          updateUserAction={updateUserAction}
        />
      </div>
    </div>
  );
}
