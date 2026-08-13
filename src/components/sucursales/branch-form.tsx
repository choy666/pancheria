'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createBranch,
  type BranchState,
} from '@/app/(panel)/sucursales/actions';

const initialState: BranchState = null;

export function BranchForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(
    createBranch,
    initialState
  );

  useEffect(() => {
    if (!isPending && state === null && formRef.current) {
      formRef.current.reset();
    }
  }, [state, isPending]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="max-w-md space-y-3"
    >
      <div className="space-y-2">
        <Label htmlFor="name">Nombre de la sucursal</Label>
        <Input
          id="name"
          name="name"
          type="text"
          required
          placeholder="Ej: Sucursal Centro"
        />
      </div>

      {state?.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Creando...' : 'Crear sucursal'}
      </Button>
    </form>
  );
}
