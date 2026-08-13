'use client';

import { useActionState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type BranchState } from '@/app/(panel)/sucursales/actions';

interface Branch {
  id: number;
  name: string;
}

interface BranchFormProps {
  branch?: Branch;
  onCancel?: () => void;
  createBranchAction: (
    _prevState: BranchState,
    formData: FormData
  ) => Promise<BranchState>;
  updateBranchAction: (
    _prevState: BranchState,
    formData: FormData
  ) => Promise<BranchState>;
}

const initialState: BranchState = null;

export function BranchForm({
  branch,
  onCancel,
  createBranchAction,
  updateBranchAction,
}: BranchFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const hasSubmittedRef = useRef(false);
  const action = branch ? updateBranchAction : createBranchAction;
  const [state, formAction, isPending] = useActionState(action, initialState);

  useEffect(() => {
    if (
      hasSubmittedRef.current &&
      !isPending &&
      state === null &&
      formRef.current
    ) {
      hasSubmittedRef.current = false;
      formRef.current.reset();
      if (branch) {
        onCancel?.();
      }
    }
  }, [state, isPending, branch, onCancel]);

  const handleSubmit = useCallback(() => {
    hasSubmittedRef.current = true;
  }, []);

  const isEditing = !!branch;

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={handleSubmit}
      className="max-w-md space-y-3"
    >
      {isEditing && <input type="hidden" name="id" value={branch.id} />}

      <div className="space-y-2">
        <Label htmlFor="name">Nombre de la sucursal</Label>
        <Input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={branch?.name}
          placeholder="Ej: Sucursal Centro"
        />
      </div>

      {state?.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending
            ? isEditing
              ? 'Guardando...'
              : 'Creando...'
            : isEditing
            ? 'Guardar cambios'
            : 'Crear sucursal'}
        </Button>

        {isEditing && (
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
