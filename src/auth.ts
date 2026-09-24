import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { verifyCredentials } from '@/application/services/authService';
import { LoginAttemptsExceededError } from '@/domain/errors';

/**
 * Error de login por lockout: Auth.js propaga un `CredentialsSignin` lanzado
 * en `authorize` hasta la server action (en vez de redirigir a
 * `?error=Configuration`), y `code` permite distinguirlo de credenciales
 * incorrectas. Si llegara por redirect (cliente), viaja como
 * `?error=CredentialsSignin&code=too_many_attempts`.
 */
export class TooManyAttemptsSignin extends CredentialsSignin {
  override code = 'too_many_attempts';
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        username: { label: 'Usuario', type: 'text' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        const { username, password } = credentials as {
          username: string;
          password: string;
        };

        if (!username || !password) {
          return null;
        }

        let user;
        try {
          user = await verifyCredentials(username, password);
        } catch (error) {
          // Sin esta conversión el lockout terminaba como redirect a
          // `?error=Configuration` (la acción de login solo maneja
          // `CredentialsSignin`; los errores ajenos a Auth.js se
          // transforman en Configuration).
          if (error instanceof LoginAttemptsExceededError) {
            throw new TooManyAttemptsSignin();
          }
          throw error;
        }

        if (!user) {
          return null;
        }

        return {
          id: user.id.toString(),
          name: user.username,
          role: user.role,
          branchId: user.branchId,
          branchName: user.branchName,
        };
      },
    }),
  ],
});
