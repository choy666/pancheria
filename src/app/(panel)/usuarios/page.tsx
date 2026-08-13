import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { routes } from '@/config/routes';
import * as userService from '@/application/services/userService';
import * as branchService from '@/application/services/branchService';
import { UserList } from '@/components/usuarios/user-list';

export default async function UsuariosPage() {
  const session = await auth();

  if (session?.user?.role !== 'admin') {
    redirect(routes.home);
  }

  const users = await userService.listUsers();
  const branches = await branchService.listBranches();

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Usuarios</h1>

      <UserList users={users} branches={branches} />
    </div>
  );
}
