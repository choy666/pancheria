import { auth } from '@/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import * as branchService from '@/application/services/branchService';
import { routes } from '@/config/routes';
import { UnauthorizedError, ForbiddenError } from '@/domain/errors';
import type { Session } from 'next-auth';

const NO_BRANCH_ERROR_QUERY = 'no_branch';

export const ACTIVE_BRANCH_COOKIE = 'activeBranchId';

export async function requireAuth(): Promise<Session> {
  const session = await auth();

  if (!session?.user) {
    throw new UnauthorizedError('Se requiere iniciar sesión.');
  }

  if (!session.user.branchId) {
    throw new ForbiddenError('El usuario no tiene una sucursal asignada.');
  }

  return session;
}

export async function getCurrentBranchId(
  session?: Session | null
): Promise<number> {
  const s = session ?? (await auth());

  if (!s?.user) {
    throw new UnauthorizedError('Se requiere iniciar sesión.');
  }

  if (!s.user.branchId) {
    throw new ForbiddenError('El usuario no tiene una sucursal asignada.');
  }

  if (s.user.role === 'admin') {
    const cookieStore = await cookies();
    const activeBranchId = cookieStore.get(ACTIVE_BRANCH_COOKIE)?.value;

    if (activeBranchId) {
      const parsed = Number(activeBranchId);
      if (!Number.isNaN(parsed) && parsed > 0) {
        const branch = await branchService.getBranchById(parsed);
        if (branch) {
          return parsed;
        }
      }
    }
  }

  return Number(s.user.branchId);
}

export async function getCurrentBranchIdOrRedirect(
  session?: Session | null
): Promise<number> {
  const s = session ?? (await auth());

  if (!s?.user) {
    redirect(routes.login);
  }

  if (!s.user.branchId) {
    if (s.user.role === 'admin') {
      redirect(routes.sucursales);
    }

    redirect(`${routes.login}?error=${NO_BRANCH_ERROR_QUERY}`);
  }

  if (s.user.role === 'admin') {
    const cookieStore = await cookies();
    const activeBranchId = cookieStore.get(ACTIVE_BRANCH_COOKIE)?.value;

    if (activeBranchId) {
      const parsed = Number(activeBranchId);
      if (!Number.isNaN(parsed) && parsed > 0) {
        const branch = await branchService.getBranchById(parsed);
        if (branch) {
          return parsed;
        }
      }
    }
  }

  return Number(s.user.branchId);
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireAuth();

  if (session.user.role !== 'admin') {
    throw new ForbiddenError('Se requieren permisos de administrador.');
  }

  return session;
}
