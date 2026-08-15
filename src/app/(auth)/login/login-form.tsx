'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { login, type LoginFormState } from './actions';

const initialState: LoginFormState = null;

interface LoginFormProps {
  errorQuery?: string;
}

const NO_BRANCH_MESSAGE =
  'El usuario no tiene una sucursal asignada. Contactá al administrador.';

export function LoginForm({ errorQuery }: LoginFormProps = {}) {
  const [state, formAction, isPending] = useActionState(login, initialState);
  const queryError =
    errorQuery === 'no_branch' ? NO_BRANCH_MESSAGE : undefined;
  const displayedError = state?.error ?? queryError;

  return (
    <div className='flex min-h-full items-center justify-center p-4'>
      <Card className='w-full max-w-sm rounded-2xl'>
        <CardHeader className='space-y-1'>
          <CardTitle className='text-2xl font-semibold tracking-tight'>Iniciar sesión</CardTitle>
          <CardDescription className='text-base'>
            Sistema de gestión de la panchería
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className='space-y-5'>
            {displayedError && (
              <p
                className='rounded-lg bg-destructive/15 p-3 text-base text-destructive'
                role='alert'
                aria-live='polite'
              >
                {displayedError}
              </p>
            )}
            <div className='space-y-2'>
              <Label htmlFor='username'>Usuario</Label>
              <Input
                id='username'
                name='username'
                type='text'
                required
                autoComplete='username'
                placeholder='Ingresá tu usuario'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='password'>Contraseña</Label>
              <Input
                id='password'
                name='password'
                type='password'
                required
                autoComplete='current-password'
                placeholder='••••••••'
              />
            </div>
            <Button type='submit' className='w-full' disabled={isPending}>
              {isPending ? 'Ingresando...' : 'Ingresar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
