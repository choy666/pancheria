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

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(login, initialState);

  return (
    <div className='flex min-h-full items-center justify-center p-4'>
      <Card className='w-full max-w-sm'>
        <CardHeader>
          <CardTitle>Iniciar sesión</CardTitle>
          <CardDescription>Sistema de gestión de la panchería</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className='space-y-4'>
            {state?.error && (
              <p
                className='text-sm text-red-600'
                role='alert'
                aria-live='polite'
              >
                {state.error}
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
