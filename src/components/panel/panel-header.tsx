'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { TourButton } from '@/components/tour/tour-context';
import { cn } from '@/lib/utils';
import { routes } from '@/config/routes';
import { Menu, X } from 'lucide-react';

interface PanelHeaderProps {
  userName?: string | null;
  branchName?: string | null;
  role?: string | null;
  signOutAction: () => Promise<void>;
}

const baseNavItems = [
  { href: routes.home, label: 'Panel' },
  { href: routes.ventas, label: 'Ventas' },
  { href: routes.ventasHistorial, label: 'Historial' },
  { href: routes.productos, label: 'Productos' },
  { href: routes.stock, label: 'Stock' },
  { href: routes.cierre, label: 'Caja' },
];

export function PanelHeader({
  userName,
  branchName,
  role,
  signOutAction,
}: PanelHeaderProps) {
  const [open, setOpen] = useState(false);

  const isAdmin = role === 'admin';

  const navItems = isAdmin
    ? [
        ...baseNavItems,
        { href: routes.sucursales, label: 'Sucursales' },
        { href: routes.usuarios, label: 'Usuarios' },
      ]
    : baseNavItems;

  return (
    <header className="sticky top-0 z-40 border-b border-white/8 bg-background/95 backdrop-blur-sm">
      <div className="flex min-h-16 items-center justify-between px-4 py-3">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight"
        >
          Panchería
        </Link>

        <nav data-tour="main-nav" className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'sm' })
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          <TourButton />
          {branchName && (
            <span className="text-sm text-muted-foreground">{branchName}</span>
          )}
          {userName && (
            <span className="text-sm text-muted-foreground">{userName}</span>
          )}
          <form action={signOutAction}>
            <Button type="submit" variant="outline" size="sm">
              Cerrar sesión
            </Button>
          </form>
        </div>

        <Button
          variant="ghost"
          size="icon-lg"
          className="lg:hidden"
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X /> : <Menu />}
        </Button>
      </div>

      {open && (
        <div className="max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-white/8 px-4 pb-4 lg:hidden">
          <nav className="flex flex-col gap-1 pt-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'sm' }),
                  'w-full justify-start'
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 flex flex-col gap-3 border-t border-white/8 pt-4">
            <TourButton className="w-full" />
            {branchName && (
              <span className="text-sm text-muted-foreground">{branchName}</span>
            )}
            {userName && (
              <span className="text-sm text-muted-foreground">{userName}</span>
            )}
            <form action={signOutAction}>
              <Button
                type="submit"
                variant="outline"
                className="w-full"
                size="sm"
              >
                Cerrar sesión
              </Button>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
