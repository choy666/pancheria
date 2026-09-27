'use client';

import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { UserActions } from '@/components/usuarios/user-actions';
import { routes } from '@/config/routes';

interface Branch {
  id: number;
  name: string;
}

interface User {
  id: number;
  username: string;
  role: 'admin' | 'operator';
  branchId: number;
  branch?: { name: string } | null;
  createdAt: Date;
}

interface UserListProps {
  users: User[];
  branches: Branch[];
}

export function UserList({ users, branches }: UserListProps) {
  const branchNameById = new Map(
    branches.map((branch) => [branch.id, branch.name])
  );

  return (
    <div className="rounded-2xl border border-white/8 overflow-x-auto" data-tour="users-table">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Usuario</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Sucursal</TableHead>
            <TableHead className="hidden text-right lg:table-cell">
              ID
            </TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow
              key={user.id}
              data-testid="user-row"
              data-user-id={user.id}
              data-username={user.username}
            >
              <TableCell data-testid="user-username" className="font-medium">
                {user.username}
                {/* Sub-resumen solo móvil: el ID queda oculto bajo `lg`. */}
                <span className="block text-xs font-normal text-muted-foreground lg:hidden">
                  ID {user.id}
                </span>
              </TableCell>
              <TableCell>
                <Badge
                  variant={user.role === 'admin' ? 'default' : 'secondary'}
                >
                  {user.role === 'admin' ? 'Administrador' : 'Operador'}
                </Badge>
              </TableCell>
              <TableCell>
                {user.role === 'admin' ? (
                  <Badge variant="outline">Todas las sucursales</Badge>
                ) : (
                  (user.branch?.name ??
                    branchNameById.get(user.branchId) ??
                    '—')
                )}
              </TableCell>
              <TableCell className="hidden text-right font-mono lg:table-cell">
                {user.id}
              </TableCell>
              <TableCell className="text-right">
                <UserActions user={user} />
              </TableCell>
            </TableRow>
          ))}
          {users.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-center text-muted-foreground"
              >
                No hay usuarios registrados.{' '}
                <Link
                  href={routes.usuariosNuevo}
                  className="text-primary underline underline-offset-4"
                >
                  Crear el primer usuario
                </Link>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
