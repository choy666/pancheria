'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Menu, X } from 'lucide-react';

interface PanelHeaderProps {
  userName?: string | null;
  signOutAction: () => Promise<void>;
}

const navItems = [
  { href: '/', label: 'Panel' },
  { href: '/ventas', label: 'Ventas' },
  { href: '/ventas/historial', label: 'Historial' },
  { href: '/productos', label: 'Productos' },
  { href: '/stock', label: 'Stock' },
  { href: '/cierre', label: 'Cierre' },
];

export function PanelHeader({ userName, signOutAction }: PanelHeaderProps) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-white/8 bg-background/95 backdrop-blur-sm">
      <div className="flex min-h-16 items-center justify-between px-4 py-3">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight"
        >
          Panchería
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
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

        <div className="hidden items-center gap-4 md:flex">
          <span className="text-sm text-muted-foreground">{userName}</span>
          <form action={signOutAction}>
            <Button type="submit" variant="outline" size="sm">
              Cerrar sesión
            </Button>
          </form>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X /> : <Menu />}
        </Button>
      </div>

      {open && (
        <div className="border-t border-white/8 px-4 pb-4 md:hidden">
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
