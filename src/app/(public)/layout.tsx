import { ReactNode } from 'react';
import Link from 'next/link';
import { routes } from '@/config/routes';

export default function PublicLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-white/8 bg-background/95 backdrop-blur-sm">
        <div className="flex min-h-16 items-center px-4 py-3">
          <Link
            href={routes.pedido}
            className="inline-flex h-11 items-center rounded-lg px-2 text-lg font-semibold tracking-tight"
            aria-label="Panchería"
          >
            Panchería
          </Link>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>

      <footer className="border-t border-white/8 px-4 py-4">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <p>Pedidos online</p>
          <Link
            href={routes.login}
            className="hover:text-foreground"
            aria-label="Acceso para el personal"
          >
            Acceso para el personal
          </Link>
        </div>
      </footer>
    </div>
  );
}
