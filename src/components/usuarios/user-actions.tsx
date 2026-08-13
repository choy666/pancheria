'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { deleteUserAction, type UserState } from '@/app/(panel)/usuarios/actions';

const initialState: UserState = null;

interface User {
  id: number;
  username: string;
  role: 'admin' | 'operator';
}

interface UserActionsProps {
  user: User;
  onEdit: () => void;
}

export function UserActions({ user, onEdit }: UserActionsProps) {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const [deleteState, deleteAction, isDeletePending] = useActionState(
    deleteUserAction,
    initialState
  );

  const deleteFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!isDeletePending && deleteState === null && deleteFormRef.current) {
      setIsDeleteOpen(false);
    }
  }, [isDeletePending, deleteState]);

  if (user.role === 'admin') {
    return null;
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button variant="ghost" size="sm" onClick={onEdit}>
        Editar
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={() => setIsDeleteOpen(true)}
      >
        Eliminar
      </Button>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">
              Confirmar eliminación
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2 text-sm text-muted-foreground">
            <p>
              ¿Eliminar al usuario <strong>{user.username}</strong>? Esta
              acción no se puede deshacer.
            </p>

            <form
              ref={deleteFormRef}
              action={deleteAction}
              className="space-y-4"
            >
              <input type="hidden" name="id" value={user.id} />

              {deleteState?.error && (
                <p className="text-sm text-destructive" role="alert">
                  {deleteState.error}
                </p>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDeleteOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={isDeletePending}
                >
                  {isDeletePending ? 'Eliminando...' : 'Eliminar'}
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
