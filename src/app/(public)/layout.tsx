import { ReactNode } from 'react';
import Link from 'next/link';
import { routes } from '@/config/routes';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function PublicLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-white/8 bg-background/95 backdrop-blur-sm">
        <div className="flex min-h-16 items-center justify-between px-4 py-3">
          <Link
            href={routes.pedido}
            className="inline-flex h-11 items-center rounded-lg px-2 text-lg font-semibold tracking-tight"
            aria-label="Panchería"
          >
            Panchería
          </Link>

          <Link
            href="/login"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            Ingresar
          </Link>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
    </div>
  );
}
