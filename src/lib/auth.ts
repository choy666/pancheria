import { auth } from '@/auth';
import { UnauthorizedError, ForbiddenError } from '@/domain/errors';

export async function requireAuth() {
  const session = await auth();

  if (!session?.user) {
    throw new UnauthorizedError('Se requiere iniciar sesión.');
  }

  if (!session.user.branchId) {
    throw new ForbiddenError('El usuario no tiene una sucursal asignada.');
  }

  return session;
}

export async function getCurrentBranchId(): Promise<number> {
  const session = await auth();

  if (!session?.user?.branchId) {
    throw new UnauthorizedError('Se requiere iniciar sesión.');
  }

  return Number(session.user.branchId);
}

export async function requireAdmin() {
  const session = await requireAuth();

  if (session.user.role !== 'admin') {
    throw new ForbiddenError('Se requieren permisos de administrador.');
  }

  return session;
}
