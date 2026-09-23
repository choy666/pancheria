import { auth } from '@/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import * as branchService from '@/application/services/branchService';
import { routes } from '@/config/routes';
import { UnauthorizedError, ForbiddenError, BranchRemovedError } from '@/domain/errors';
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

  // El JWT no se revalida contra la base en cada request: si la sucursal
  // fue eliminada (borrado físico en cascada), el usuario quedaría
  // autenticado con un branchId huérfano y las escrituras llegarían a la
  // FK. Rechazar acá cubre todas las rutas y server actions autenticadas.
  const ownBranch = await branchService.getBranchById(
    Number(session.user.branchId)
  );
  if (!ownBranch) {
    throw new BranchRemovedError();
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

  // Se valida el branchId ya resuelto (después del fallback del admin):
  // la cookie huérfana ya cayó a la sucursal de sesión, que puede estar
  // igualmente eliminada.
  const resolved = Number(s.user.branchId);
  const branch = await branchService.getBranchById(resolved);
  if (!branch) {
    throw new BranchRemovedError();
  }

  return resolved;
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

  const resolved = Number(s.user.branchId);
  const branch = await branchService.getBranchById(resolved);
  if (!branch) {
    // Sesión viva con sucursal eliminada: no redirigir a login porque el
    // middleware vería la sesión válida y produciría un loop
    // login → panel → login. La página intermedia cierra la sesión
    // server-side y de ahí manda al login con el mensaje correspondiente.
    redirect(routes.sesionFinalizada);
  }

  return resolved;
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireAuth();

  if (session.user.role !== 'admin') {
    throw new ForbiddenError('Se requieren permisos de administrador.');
  }

  return session;
}
