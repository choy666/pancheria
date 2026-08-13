'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  createUser,
  updateUserAction,
  type UserState,
} from '@/app/(panel)/usuarios/actions';

const initialState: UserState = null;

interface User {
  id: number;
  username: string;
  role: 'admin' | 'operator';
  branchId: number;
}

interface UserFormProps {
  branches: { id: number; name: string }[];
  user?: User;
  onCancel?: () => void;
}

export function UserForm({ branches, user, onCancel }: UserFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [branchId, setBranchId] = useState(user ? String(user.branchId) : '');
  const isEditing = !!user;
  const action = isEditing ? updateUserAction : createUser;
  const [state, formAction, isPending] = useActionState(action, initialState);

  useEffect(() => {
    if (!isPending && state === null && formRef.current) {
      const resetBranchId = isEditing ? String(user!.branchId) : '';
      setTimeout(() => {
        formRef.current?.reset();
        setBranchId(resetBranchId);
        onCancel?.();
      }, 0);
    }
  }, [isPending, isEditing, onCancel, state, user]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="max-w-2xl space-y-4"
    >
      {isEditing && <input type="hidden" name="id" value={user.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="username">Nombre de usuario</Label>
          <Input
            id="username"
            name="username"
            type="text"
            required
            defaultValue={user?.username ?? ''}
            placeholder="Ej: juan.perez"
          />
        </div>

        {!isEditing && (
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={4}
              placeholder="Mínimo 4 caracteres"
            />
          </div>
        )}

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="branchId">Sucursal</Label>
          <Select
            value={branchId}
            onValueChange={(value) => setBranchId(value ?? '')}
            required
          >
            <SelectTrigger id="branchId">
              <SelectValue placeholder="Seleccionar sucursal" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id.toString()}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" name="branchId" value={branchId} />
        </div>
      </div>

      {state?.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending || !branchId}>
          {isPending
            ? isEditing
              ? 'Guardando...'
              : 'Creando...'
            : isEditing
              ? 'Guardar cambios'
              : 'Crear usuario'}
        </Button>
        {isEditing && onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
