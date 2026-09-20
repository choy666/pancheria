import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { routes } from '@/config/routes';
import * as userService from '@/application/services/userService';
import * as branchService from '@/application/services/branchService';
import { UserList } from '@/components/usuarios/user-list';
import { ServerPagination } from '@/components/ui/server-pagination';
import { parsePaginationParams } from '@/lib/pagination';
import { createUser, updateUserAction } from '@/app/(panel)/usuarios/actions';

interface UsuariosPageProps {
  searchParams: Promise<{ page?: string; limit?: string }>;
}

export default async function UsuariosPage({ searchParams }: UsuariosPageProps) {
  const session = await auth();

  if (session?.user?.role !== 'admin') {
    redirect(routes.home);
  }

  const params = await searchParams;
  const pagination = parsePaginationParams(
    new URLSearchParams({ page: params.page ?? '', limit: params.limit ?? '' })
  );

  const [users, branches] = await Promise.all([
    userService.listUsers(undefined, pagination),
    branchService.listBranches(),
  ]);

  return (
    <div className="space-y-5">
      <h1 data-tour="users-header" className="text-2xl font-semibold tracking-tight">Usuarios</h1>

      <UserList
        users={users.items}
        branches={branches}
        createUser={createUser}
        updateUserAction={updateUserAction}
      />

      <ServerPagination
        page={users.page}
        limit={users.limit}
        total={users.total}
      />
    </div>
  );
}
