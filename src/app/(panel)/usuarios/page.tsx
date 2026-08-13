import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { routes } from '@/config/routes';
import * as userService from '@/application/services/userService';
import * as branchService from '@/application/services/branchService';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { UserForm } from '@/components/usuarios/user-form';

export default async function UsuariosPage() {
  const session = await auth();

  if (session?.user?.role !== 'admin') {
    redirect(routes.home);
  }

  const users = await userService.listUsers(session.user.branchId);
  const branches = await branchService.listBranches();

  const branchNameById = new Map(
    branches.map((branch) => [branch.id, branch.name])
  );

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Usuarios</h1>

      <UserForm branches={branches} />

      <div className="rounded-2xl border border-white/8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Sucursal</TableHead>
              <TableHead className="text-right">ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.username}</TableCell>
                <TableCell>
                  <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                    {user.role === 'admin' ? 'Administrador' : 'Operador'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {branchNameById.get(user.branchId) ?? '—'}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {user.id}
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground"
                >
                  No hay usuarios registrados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
