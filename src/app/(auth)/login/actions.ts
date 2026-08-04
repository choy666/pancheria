'use server';

import { signIn } from '@/auth';
import { CredentialsSignin } from 'next-auth';
import { unstable_rethrow } from 'next/navigation';

export type LoginFormState = { error: string } | null;

export async function login(
  _prevState: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  try {
    await signIn('credentials', {
      username,
      password,
      redirectTo: '/',
    });

    return null;
  } catch (error) {
    unstable_rethrow(error);

    if (error instanceof CredentialsSignin) {
      return { error: 'Usuario o contraseña incorrectos.' };
    }

    throw error;
  }
}
