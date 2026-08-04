import Link from 'next/link';
import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { auth, signOut } from '@/auth';

export default async function PanelLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <nav className="flex gap-2">
          <Link href="/">
            <Button variant="ghost">Panel</Button>
          </Link>
          <Link href="/ventas">
            <Button variant="ghost">Ventas</Button>
          </Link>
          <Link href="/ventas/historial">
            <Button variant="ghost">Historial</Button>
          </Link>
          <Link href="/productos">
            <Button variant="ghost">Productos</Button>
          </Link>
          <Link href="/stock">
            <Button variant="ghost">Stock</Button>
          </Link>
          <Link href="/cierre">
            <Button variant="ghost">Cierre</Button>
          </Link>
        </nav>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            {session?.user?.name}
          </span>
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/login' });
            }}
          >
            <Button type="submit" variant="outline" size="sm">
              Cerrar sesión
            </Button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
