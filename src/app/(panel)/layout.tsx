import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { PanelHeader } from '@/components/panel/panel-header';
import { TourProvider } from '@/components/tour/tour-context';
import { auth, signOut } from '@/auth';
import * as branchService from '@/application/services/branchService';
import { getCurrentBranchIdOrRedirect } from '@/lib/auth';
import { routes } from '@/config/routes';
import { setActiveBranchAction } from '@/app/(panel)/actions';

export default async function PanelLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();

  if (!session) {
    // Fallback defensivo: el proxy de NextAuth en src/proxy.ts ya debería
    // redirigir las rutas del panel antes de llegar acá. Si por alguna razón
    // no se ejecuta, esta redirección evita renderizar el panel sin sesión.
    redirect(routes.login);
  }

  async function signOutAction() {
    'use server';
    await signOut({ redirectTo: routes.login });
  }

  const currentBranchId = await getCurrentBranchIdOrRedirect(session);

  const branch = await branchService.getBranchById(currentBranchId);
  const branchName = branch?.name ?? session.user.branchName ?? undefined;

  const branches =
    session.user.role === 'admin' ? await branchService.listBranches() : undefined;

  return (
    <TourProvider
      userId={session.user.id}
      branchId={currentBranchId}
      role={session.user.role === 'admin' ? 'admin' : 'operator'}
    >
      <div className="flex min-h-full flex-col">
        <PanelHeader
          userName={session.user.name}
          branchName={branchName}
          role={session.user.role}
          branches={branches}
          activeBranchId={currentBranchId}
          setActiveBranchAction={setActiveBranchAction}
          signOutAction={signOutAction}
        />
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </TourProvider>
  );
}
