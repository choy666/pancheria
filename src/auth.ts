import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { verifyCredentials } from '@/application/services/authService';
import { LoginAttemptsExceededError } from '@/domain/errors';
import {
  createLoginIpLimiter,
  getClientIp,
} from '@/lib/rate-limit';
import {
  getLoginIpRateLimitMaxAttempts,
  getLoginIpRateLimitWindowMs,
} from '@/config/rate-limit';

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

const loginIpLimiter = createLoginIpLimiter(
  getLoginIpRateLimitWindowMs(),
  getLoginIpRateLimitMaxAttempts()
);

/**
 * Resuelve la IP del request para el límite por IP. Si no hay una fuente
 * confiable (`'unknown'` en dev/test, `RateLimitConfigError` en producción
 * sin proxy confiable), devuelve `null`: el limiter por IP se omite pero el
 * bloqueo por usuario sigue protegiendo, y ningún cliente termina agrupado
 * en la clave compartida 'unknown'.
 */
function resolveLoginIp(request: Request | undefined): string | null {
  if (!request) return null;
  try {
    const ip = getClientIp(request);
    return ip === 'unknown' ? null : ip;
  } catch {
    return null;
  }
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
      async authorize(credentials, request) {
        const { username, password } = credentials as {
          username: string;
          password: string;
        };

        if (!username || !password) {
          return null;
        }

        // Segundo límite por IP (además del por usuario): frena el password
        // spraying que rota usernames. El chequeo es preventivo, antes de
        // verificar credenciales.
        const ip = resolveLoginIp(request);
        if (await loginIpLimiter.isBlocked(ip)) {
          throw new TooManyAttemptsSignin();
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
          // Solo los intentos fallidos acumulan contra el límite por IP:
          // logins exitosos detrás de una IP compartida (NAT/oficina) no
          // deben consumir la cuota.
          await loginIpLimiter.recordFailure(ip);
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
