import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { revalidateSessionUser } from '@/lib/auth';
import { routes } from '@/config/routes';
import * as userService from '@/application/services/userService';
import { listBranchesForRequest } from '@/lib/server-cache';
import { Button } from '@/components/ui/button';
import { UserList } from '@/components/usuarios/user-list';
import { ServerPagination } from '@/components/ui/server-pagination';
import { parsePaginationParams } from '@/lib/pagination';

interface UsuariosPageProps {
  searchParams: Promise<{ page?: string; limit?: string }>;
}

export default async function UsuariosPage({ searchParams }: UsuariosPageProps) {
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

  const params = await searchParams;
  const pagination = parsePaginationParams(
    new URLSearchParams({ page: params.page ?? '', limit: params.limit ?? '' })
  );

  const [users, branches] = await Promise.all([
    userService.listUsers(undefined, pagination),
    listBranchesForRequest(),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 data-tour="users-header" className="text-2xl font-semibold tracking-tight">Usuarios</h1>
        {/* El alta vive en ruta dedicada (patrón /productos). */}
        <Link href={routes.usuariosNuevo} className="w-full sm:w-auto">
          <Button data-tour="users-new" className="w-full sm:w-auto">
            Nuevo usuario
          </Button>
        </Link>
      </div>

      <UserList
        users={users.items}
        branches={branches}
      />

      <ServerPagination
        page={users.page}
        limit={users.limit}
        total={users.total}
      />
    </div>
  );
}
