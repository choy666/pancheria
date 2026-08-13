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
import { createUser, type UserState } from '@/app/(panel)/usuarios/actions';

const initialState: UserState = null;

interface UserFormProps {
  branches: { id: number; name: string }[];
}

export function UserForm({ branches }: UserFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [role, setRole] = useState('operator');
  const [branchId, setBranchId] = useState('');
  const [state, formAction, isPending] = useActionState(
    createUser,
    initialState
  );

  useEffect(() => {
    if (!isPending && state === null && formRef.current) {
      formRef.current.reset();
      setRole('operator');
      setBranchId('');
    }
  }, [state, isPending]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="max-w-2xl space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="username">Nombre de usuario</Label>
          <Input
            id="username"
            name="username"
            type="text"
            required
            placeholder="Ej: juan.perez"
          />
        </div>

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

        <div className="space-y-2">
          <Label htmlFor="role">Rol</Label>
          <Select value={role} onValueChange={(value) => setRole(value ?? '')}>
            <SelectTrigger id="role">
              <SelectValue placeholder="Seleccionar rol" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="operator">Operador</SelectItem>
              <SelectItem value="admin">Administrador</SelectItem>
            </SelectContent>
          </Select>
          <input type="hidden" name="role" value={role} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="branchId">Sucursal</Label>
          <Select value={branchId} onValueChange={(value) => setBranchId(value ?? '')} required>
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

      <Button type="submit" disabled={isPending || !branchId}>
        {isPending ? 'Creando...' : 'Crear usuario'}
      </Button>
    </form>
  );
}
