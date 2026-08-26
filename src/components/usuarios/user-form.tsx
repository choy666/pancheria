'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type UserState } from '@/app/(panel)/usuarios/actions';

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
  createUser: (prevState: UserState, formData: FormData) => Promise<UserState>;
  updateUserAction: (
    prevState: UserState,
    formData: FormData
  ) => Promise<UserState>;
}

export function UserForm({
  branches,
  user,
  onCancel,
  createUser,
  updateUserAction,
}: UserFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const wasPendingRef = useRef(false);
  const [showPassword, setShowPassword] = useState(false);
  const [branchId, setBranchId] = useState(user ? String(user.branchId) : '');
  const isEditing = !!user;
  const action = isEditing ? updateUserAction : createUser;
  const [state, formAction, isPending] = useActionState(action, initialState);

  useEffect(() => {
    if (
      wasPendingRef.current &&
      !isPending &&
      state === null &&
      formRef.current
    ) {
      const resetBranchId = isEditing ? String(user!.branchId) : '';
      setTimeout(() => {
        formRef.current?.reset();
        setBranchId(resetBranchId);
        onCancel?.();
        router.refresh();
      }, 0);
    }
    wasPendingRef.current = isPending;
  }, [isPending, isEditing, onCancel, state, user, router]);

  return (
    <form
      ref={formRef}
      action={formAction}
      autoComplete="off"
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
            autoComplete="off"
            required
            defaultValue={user?.username ?? ''}
            placeholder="Ej: juan.perez"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required={!isEditing}
              minLength={6}
              placeholder={
                isEditing
                  ? 'Dejar en blanco para mantener la actual'
                  : 'Mínimo 6 caracteres'
              }
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            La contraseña debe tener al menos 6 caracteres. En edición, dejala en
            blanco para conservar la actual.
          </p>
        </div>

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
