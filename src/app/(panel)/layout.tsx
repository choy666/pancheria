import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { PanelHeader } from '@/components/panel/panel-header';
import { BranchRequiredFallback } from '@/components/panel/branch-required-fallback';
import { TourProvider } from '@/components/tour/tour-context';
import { auth, signOut } from '@/auth';
import * as branchService from '@/application/services/branchService';
import { getCurrentBranchId } from '@/lib/auth';
import { routes } from '@/config/routes';
import { ForbiddenError } from '@/domain/errors';
import { setActiveBranchAction } from '@/app/(panel)/actions';

export default async function PanelLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect(routes.login);
  }

  async function signOutAction() {
    'use server';
    await signOut({ redirectTo: routes.login });
  }

  let currentBranchId: number;
  let branchName: string | undefined;
  let branches:
    | Awaited<ReturnType<typeof branchService.listBranches>>
    | undefined;

  try {
    currentBranchId = await getCurrentBranchId(session);
    const branch = await branchService.getBranchById(currentBranchId);
    branchName = branch?.name ?? session.user.branchName ?? undefined;

    branches =
      session.user.role === 'admin' ? await branchService.listBranches() : undefined;
  } catch (error) {
    if (
      error instanceof ForbiddenError &&
      error.message === 'El usuario no tiene una sucursal asignada.'
    ) {
      return (
        <BranchRequiredFallback
          role={session.user.role}
          signOutAction={signOutAction}
        />
      );
    }

    throw error;
  }

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
