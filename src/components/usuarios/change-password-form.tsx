'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  changePassword,
  type ChangePasswordState,
} from '@/app/(panel)/perfil/actions';

const initialState: ChangePasswordState = null;

export function ChangePasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const wasPendingRef = useRef(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [state, formAction, isPending] = useActionState(
    changePassword,
    initialState
  );

  const mismatch =
    confirmPassword.length > 0 && newPassword !== confirmPassword;

  useEffect(() => {
    if (
      wasPendingRef.current &&
      !isPending &&
      state?.success &&
      formRef.current
    ) {
      formRef.current.reset();
      setNewPassword('');
      setConfirmPassword('');
    }

    wasPendingRef.current = isPending;
  }, [isPending, state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      autoComplete="off"
      className="max-w-xl space-y-5"
    >
      {state?.error && (
        <p className="text-sm text-destructive" role="alert" aria-live="polite">
          {state.error}
        </p>
      )}

      {state?.success && (
        <p
          className="text-sm text-emerald-600"
          role="status"
          aria-live="polite"
          data-testid="change-password-success"
        >
          {state.success}
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="currentPassword">Contraseña actual</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          data-testid="current-password"
          placeholder="••••••••"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="newPassword">Nueva contraseña</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          data-testid="new-password"
          placeholder="Mínimo 6 caracteres"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirmar nueva contraseña</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          data-testid="confirm-password"
          placeholder="Repetí la nueva contraseña"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          aria-invalid={mismatch}
        />
        {mismatch && (
          <p className="text-xs text-destructive" role="alert">
            Las contraseñas nuevas no coinciden.
          </p>
        )}
      </div>

      <Button
        type="submit"
        disabled={isPending || mismatch || !newPassword || !confirmPassword}
        data-testid="change-password-button"
      >
        {isPending ? 'Cambiando...' : 'Cambiar contraseña'}
      </Button>
    </form>
  );
}
