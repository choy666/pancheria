'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { TourButton } from '@/components/tour/tour-context';
import { BranchSelector } from './branch-selector';
import { cn } from '@/lib/utils';
import { routes } from '@/config/routes';
import { Menu, X } from 'lucide-react';

interface Branch {
  id: number;
  name: string;
}

interface PanelHeaderProps {
  userName?: string | null;
  branchName?: string | null;
  role?: string | null;
  branches?: Branch[];
  activeBranchId?: number;
  setActiveBranchAction: (formData: FormData) => Promise<{ error: string } | null>;
  signOutAction: () => Promise<void>;
}

const operatorNavItems = [
  { href: routes.home, label: 'Panel' },
  { href: routes.ventas, label: 'Ventas' },
  { href: routes.ventasHistorial, label: 'Historial' },
  { href: routes.stock, label: 'Stock' },
  { href: routes.cierre, label: 'Caja' },
];

const adminNavItems = [
  { href: routes.home, label: 'Panel' },
  { href: routes.ventas, label: 'Ventas' },
  { href: routes.ventasHistorial, label: 'Historial' },
  { href: routes.productos, label: 'Productos' },
  { href: routes.stock, label: 'Stock' },
  { href: routes.cierre, label: 'Caja' },
  { href: routes.sucursales, label: 'Sucursales' },
  { href: routes.usuarios, label: 'Usuarios' },
  { href: routes.videos, label: 'Videos' },
];

export function PanelHeader({
  userName,
  branchName,
  role,
  branches,
  activeBranchId,
  setActiveBranchAction,
  signOutAction,
}: PanelHeaderProps) {
  const [open, setOpen] = useState(false);

  const isAdmin = role === 'admin';
  const navItems = isAdmin ? adminNavItems : operatorNavItems;
  const showBranchSelector = isAdmin && branches && branches.length > 1;

  return (
    <header className="sticky top-0 z-40 border-b border-white/8 bg-background/95 backdrop-blur-sm">
      <div className="flex min-h-16 items-center justify-between px-4 py-3">
        <Link
          href="/"
          className="inline-flex h-11 items-center rounded-lg px-2 text-lg font-semibold tracking-tight"
          aria-label="Inicio"
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
          {showBranchSelector && activeBranchId !== undefined && (
            <BranchSelector
              key={activeBranchId}
              branches={branches}
              activeBranchId={activeBranchId}
              setActiveBranchAction={setActiveBranchAction}
            />
          )}
          <TourButton />
          {branchName && !showBranchSelector && (
            <span data-testid="active-branch-name" className="text-sm text-muted-foreground">{branchName}</span>
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
          data-tour="mobile-menu-button"
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X /> : <Menu />}
        </Button>
      </div>

      {open && (
        <div
          data-tour="mobile-nav"
          className="max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-white/8 px-4 pb-4 lg:hidden"
        >
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
            {showBranchSelector && activeBranchId !== undefined && (
              <BranchSelector
                key={activeBranchId}
                branches={branches}
                activeBranchId={activeBranchId}
                setActiveBranchAction={setActiveBranchAction}
              />
            )}
            <TourButton
              className="w-full"
              onBeforeToggle={() => setOpen(false)}
            />
            {branchName && !showBranchSelector && (
              <span data-testid="active-branch-name" className="text-sm text-muted-foreground">{branchName}</span>
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
