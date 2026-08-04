import { ReactNode } from 'react';
import { PanelHeader } from '@/components/panel/panel-header';
import { auth, signOut } from '@/auth';

export default async function PanelLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();

  async function signOutAction() {
    'use server';
    await signOut({ redirectTo: '/login' });
  }

  return (
    <div className="flex min-h-full flex-col">
      <PanelHeader userName={session?.user?.name} signOutAction={signOutAction} />
      <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
    </div>
  );
}
