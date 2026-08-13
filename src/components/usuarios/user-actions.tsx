'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  deleteUserAction,
  resetUserPasswordAction,
  type UserState,
} from '@/app/(panel)/usuarios/actions';

const initialState: UserState = null;

interface User {
  id: number;
  username: string;
}

interface UserActionsProps {
  user: User;
  onEdit: () => void;
}

export function UserActions({ user, onEdit }: UserActionsProps) {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState('');

  const [deleteState, deleteAction, isDeletePending] = useActionState(
    deleteUserAction,
    initialState
  );
  const [resetState, resetAction, isResetPending] = useActionState(
    resetUserPasswordAction,
    initialState
  );

  const deleteFormRef = useRef<HTMLFormElement>(null);
  const resetFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!isDeletePending && deleteState === null && deleteFormRef.current) {
      setIsDeleteOpen(false);
    }
  }, [isDeletePending, deleteState]);

  useEffect(() => {
    if (!isResetPending && resetState === null && resetFormRef.current) {
      setIsResetOpen(false);
      setResetPassword('');
    }
  }, [isResetPending, resetState]);

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button variant="ghost" size="sm" onClick={onEdit}>
        Editar
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsResetOpen(true)}
      >
        Cambiar contraseña
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={() => setIsDeleteOpen(true)}
      >
        Eliminar
      </Button>

      <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar contraseña</DialogTitle>
          </DialogHeader>
          <form ref={resetFormRef} action={resetAction} className="space-y-4">
            <input type="hidden" name="id" value={user.id} />
            <div className="space-y-2">
              <Label htmlFor={`reset-password-${user.id}`}>
                Nueva contraseña para <strong>{user.username}</strong>
              </Label>
              <Input
                id={`reset-password-${user.id}`}
                name="password"
                type="password"
                required
                minLength={4}
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="Mínimo 4 caracteres"
              />
            </div>

            {resetState?.error && (
              <p className="text-sm text-destructive" role="alert">
                {resetState.error}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsResetOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isResetPending}
              >
                {isResetPending ? 'Guardando...' : 'Guardar contraseña'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
