'use client';

import { useCallback, useState } from 'react';
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
import { UserActions } from '@/components/usuarios/user-actions';
import { type UserState } from '@/app/(panel)/usuarios/actions';

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
  createUser: (prevState: UserState, formData: FormData) => Promise<UserState>;
  updateUserAction: (
    prevState: UserState,
    formData: FormData
  ) => Promise<UserState>;
}

export function UserList({
  users,
  branches,
  createUser,
  updateUserAction,
}: UserListProps) {
  const [editingUser, setEditingUser] = useState<User | undefined>();
  const handleCancelEdit = useCallback(() => setEditingUser(undefined), []);

  const branchNameById = new Map(
    branches.map((branch) => [branch.id, branch.name])
  );

  return (
    <div data-tour="users-table" className="space-y-5">
      <div data-tour="user-form">
        <UserForm
          key={editingUser?.id ?? 'create'}
          branches={branches}
          user={editingUser}
          onCancel={handleCancelEdit}
          createUser={createUser}
          updateUserAction={updateUserAction}
        />
      </div>

      <div className="rounded-2xl border border-white/8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Sucursal</TableHead>
              <TableHead className="text-right">ID</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.username}</TableCell>
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
                <TableCell className="text-right font-mono">
                  {user.id}
                </TableCell>
                <TableCell className="text-right">
                  <UserActions
                    user={user}
                    onEdit={() => setEditingUser(user)}
                  />
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
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
