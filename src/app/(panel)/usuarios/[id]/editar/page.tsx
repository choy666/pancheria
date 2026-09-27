import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { revalidateSessionUser } from '@/lib/auth';
import { routes } from '@/config/routes';
import { listBranchesForRequest } from '@/lib/server-cache';
import * as userService from '@/application/services/userService';
import { UserForm } from '@/components/usuarios/user-form';
import {
  createUser,
  updateUserAction,
} from '@/app/(panel)/usuarios/actions';

interface PageParams {
  params: Promise<{ id: string }>;
}

export default async function EditarUsuarioPage({ params }: PageParams) {
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
  const userId = Number(id);
  // `Number('abc')` produce NaN: se trata como ruta inexistente en vez de
  // dejar que la consulta falle contra la base.
  if (!Number.isInteger(userId)) {
    notFound();
  }

  const userRecord = await userService.findById(userId);
  // El administrador inicial no es editable: el listado no ofrece la acción
  // y `updateUser`/`deleteUser` la rechazan; la ruta tampoco la expone.
  if (!userRecord || userRecord.role === 'admin') {
    notFound();
  }

  const branches = await listBranchesForRequest();

  // Al cliente solo viajan los campos que el formulario usa: nunca el
  // `passwordHash` ni el resto de la fila.
  const user = {
    id: userRecord.id,
    username: userRecord.username,
    role: userRecord.role,
    branchId: userRecord.branchId,
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">
        Editar usuario
      </h1>
      <div data-tour="user-form">
        <UserForm
          branches={branches}
          user={user}
          createUser={createUser}
          updateUserAction={updateUserAction}
        />
      </div>
    </div>
  );
}
