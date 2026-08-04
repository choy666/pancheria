import { auth } from '@/auth';
import { UnauthorizedError } from '@/domain/errors';

export async function requireAuth() {
  const session = await auth();

  if (!session?.user) {
    throw new UnauthorizedError('Se requiere iniciar sesión.');
  }

  return session;
}
