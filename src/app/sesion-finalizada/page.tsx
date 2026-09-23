import { redirect } from 'next/navigation';
import { auth, signOut } from '@/auth';
import { routes } from '@/config/routes';
import * as branchService from '@/application/services/branchService';
import { SignOutClient } from './sign-out-client';

/**
 * Página intermedia para sesiones cuya sucursal fue eliminada (E4).
 * Cierra la sesión server-side y redirige al login con el motivo: ir
 * directo a /login con la sesión viva haría que el middleware rebote a /
 * y el panel vuelva a expulsar — un loop.
 */
export const dynamic = 'force-dynamic';

export default async function SesionFinalizadaPage() {
  const session = await auth();

  if (!session?.user) {
    redirect(`${routes.login}?error=branch_removed`);
  }

  // Solo cerrar si la sucursal realmente desapareció: un usuario válido
  // que llegue por accidente vuelve al panel sin perder su sesión.
  const branch = session.user.branchId
    ? await branchService.getBranchById(Number(session.user.branchId))
    : null;
  if (branch) {
    redirect(routes.home);
  }

  async function cerrarSesion() {
    'use server';
    await signOut({ redirectTo: `${routes.login}?error=branch_removed` });
  }

  return <SignOutClient action={cerrarSesion} />;
}
