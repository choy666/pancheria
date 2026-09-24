import { redirect } from 'next/navigation';
import { auth, signOut } from '@/auth';
import { routes } from '@/config/routes';
import * as branchService from '@/application/services/branchService';
import * as userRepository from '@/repositories/userRepository';
import { SignOutClient } from './sign-out-client';

/**
 * Página intermedia para sesiones cuya sucursal o usuario fue eliminado.
 * Cierra la sesión server-side y redirige al login con el motivo: ir
 * directo a /login con la sesión viva haría que el middleware rebote a /
 * y el panel vuelva a expulsar — un loop.
 */
export const dynamic = 'force-dynamic';

export default async function SesionFinalizadaPage() {
  const session = await auth();

  if (!session?.user) {
    redirect(routes.login);
  }

  // La asignación vigente sale de la base (el JWT puede estar viejo): si el
  // usuario existe y su sucursal actual existe, llegó por accidente y vuelve
  // al panel sin perder la sesión.
  const userId = Number(session.user.id);
  const dbUser = Number.isFinite(userId)
    ? await userRepository.findByIdWithBranch(userId)
    : undefined;

  let errorQuery = 'user_removed';
  if (dbUser) {
    const branch = dbUser.branchId
      ? await branchService.getBranchById(dbUser.branchId)
      : null;
    if (branch) {
      redirect(routes.home);
    }
    errorQuery = 'branch_removed';
  }

  async function cerrarSesion() {
    'use server';
    await signOut({ redirectTo: `${routes.login}?error=${errorQuery}` });
  }

  return <SignOutClient action={cerrarSesion} errorQuery={errorQuery} />;
}
