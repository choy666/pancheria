'use client';

import Link from 'next/link';
import { useMemo, type ReactNode } from 'react';
import { addHours, intervalToDuration } from 'date-fns';
import {
  AlertCircle,
  Banknote,
  ClipboardList,
  Package,
  ShoppingCart,
  Store,
  Users,
  UserCircle,
  Video,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboard } from '@/hooks/useDashboard';
import { routes } from '@/config/routes';
import { getAutoCloseHours } from '@/config/caja';
import { safeFormatDuration } from '@/lib/date';
import { cn } from '@/lib/utils';
import type { OrderStatus } from '@/domain/types';

interface DashboardClientProps {
  branchName?: string | null;
  role: 'admin' | 'operator';
  userName?: string | null;
}

const statusLabels: Record<OrderStatus, string> = {
  pending: 'Pendiente',
  in_process: 'En proceso',
  paid: 'Pagado',
  finished: 'Finalizado',
  cancelled: 'Cancelado',
};

const statusVariantClasses: Record<
  OrderStatus,
  string
> = {
  pending:
    'border-amber-500/30 bg-amber-500/10 text-amber-400',
  in_process:
    'border-blue-500/30 bg-blue-500/10 text-blue-400',
  paid:
    'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  finished:
    'border-muted/30 bg-muted/20 text-muted-foreground',
  cancelled:
    'border-destructive/30 bg-destructive/10 text-destructive',
};

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-3/4 max-w-md" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
      </div>
    </div>
  );
}

function CajaCard({ data }: { data: NonNullable<ReturnType<typeof useDashboard>['data']> }) {
  const cashRegister = data.cashRegister;

  if (cashRegister.status === 'closed') {
    return (
      <Card data-tour="dashboard-caja" data-testid="dashboard-caja-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Banknote className="h-5 w-5" />
            Caja
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="destructive">Cerrada</Badge>
          </div>
          <p className="text-base text-muted-foreground">
            No hay una caja abierta. Abrí una caja para comenzar a vender.
          </p>
          <Link href={routes.cierre}>
            <Button className="w-full sm:w-auto">Abrir caja</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const openedAt = new Date(cashRegister.openedAt);
  const now = new Date();
  const autoCloseAt = addHours(openedAt, getAutoCloseHours());
  const remaining = intervalToDuration({ start: now, end: autoCloseAt });

  return (
    <Card data-tour="dashboard-caja" data-testid="dashboard-caja-card">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Banknote className="h-5 w-5" />
          Caja
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="default">Abierta</Badge>
          <span className="text-sm text-muted-foreground">
            #{cashRegister.id}
          </span>
        </div>
        <p className="font-mono text-2xl font-bold text-primary">
          ${cashRegister.total.toFixed(2)}
        </p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <p className="rounded-lg bg-muted/30 p-2">
            Efectivo:{' '}
            <span className="font-mono font-medium">
              ${cashRegister.cashTotal.toFixed(2)}
            </span>
          </p>
          <p className="rounded-lg bg-muted/30 p-2">
            Transferencia:{' '}
            <span className="font-mono font-medium">
              ${cashRegister.transferTotal.toFixed(2)}
            </span>
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Ventas: <span className="font-mono font-semibold">{cashRegister.totalSales}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Cierre automático en:{' '}
          <span className="font-mono">{safeFormatDuration(remaining)}</span>
        </p>
        <Link href={routes.cierre}>
          <Button variant="outline" className="w-full sm:w-auto">
            Ver caja
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function PedidosCard({ data }: { data: NonNullable<ReturnType<typeof useDashboard>['data']> }) {
  return (
    <Card data-tour="dashboard-pedidos" data-testid="dashboard-pedidos-card">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          Pedidos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(statusLabels) as OrderStatus[]).map((status) => (
            <Badge
              key={status}
              variant="outline"
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1',
                statusVariantClasses[status]
              )}
            >
              <span className="font-mono font-bold">
                {data.orderCounts[status]}
              </span>
              <span className="text-xs">{statusLabels[status]}</span>
            </Badge>
          ))}
        </div>
        <Link href={routes.pedidos}>
          <Button variant="outline" className="w-full sm:w-auto">
            Ver pedidos
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function StockCard({ data }: { data: NonNullable<ReturnType<typeof useDashboard>['data']> }) {
  const hasLowStock = data.lowStockCount > 0;

  return (
    <Card data-tour="dashboard-stock" data-testid="dashboard-stock-card">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Package className="h-5 w-5" />
          Stock
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasLowStock ? (
          <div className="flex items-start gap-2 text-base text-destructive">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>
              Hay{' '}
              <span className="font-mono font-semibold">
                {data.lowStockCount}
              </span>{' '}
              insumo(s) con stock bajo.
            </p>
          </div>
        ) : (
          <p className="text-base text-muted-foreground">
            No hay alertas de stock bajo.
          </p>
        )}
        <Link href={routes.stock}>
          <Button variant="outline" className="w-full sm:w-auto">
            Ver stock
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

interface ActionItem {
  href: string;
  label: string;
  description: string;
  testId: string;
  tour: string;
  icon: ReactNode;
  adminOnly?: boolean;
}

function DashboardActions({ isAdmin }: { isAdmin: boolean }) {
  const actions: ActionItem[] = useMemo(
    () => [
      {
        href: routes.ventas,
        label: 'Ventas',
        description: 'Terminal de ventas rápidas.',
        testId: 'dashboard-action-ventas',
        tour: 'dashboard-ventas',
        icon: <ShoppingCart className="h-5 w-5" />,
      },
      {
        href: routes.productos,
        label: 'Productos',
        description: 'Administrar productos y promos.',
        testId: 'dashboard-action-productos',
        tour: 'dashboard-productos',
        icon: <Package className="h-5 w-5" />,
        adminOnly: true,
      },
      {
        href: routes.stock,
        label: 'Stock',
        description: 'Ajustar y consultar inventario.',
        testId: 'dashboard-action-stock',
        tour: 'dashboard-stock',
        icon: <Package className="h-5 w-5" />,
      },
      {
        href: routes.cierre,
        label: 'Caja y cierre',
        description: 'Abrir, cerrar y controlar caja.',
        testId: 'dashboard-action-caja',
        tour: 'dashboard-caja',
        icon: <Banknote className="h-5 w-5" />,
      },
      {
        href: routes.pedidos,
        label: 'Pedidos',
        description: 'Confirmar y gestionar pedidos.',
        testId: 'dashboard-action-pedidos',
        tour: 'dashboard-pedidos',
        icon: <ClipboardList className="h-5 w-5" />,
      },
      {
        href: routes.sucursales,
        label: 'Sucursales',
        description: 'Administrar sucursales.',
        testId: 'dashboard-action-sucursales',
        tour: 'dashboard-sucursales',
        icon: <Store className="h-5 w-5" />,
        adminOnly: true,
      },
      {
        href: routes.usuarios,
        label: 'Usuarios',
        description: 'Administrar operadores.',
        testId: 'dashboard-action-usuarios',
        tour: 'dashboard-usuarios',
        icon: <Users className="h-5 w-5" />,
        adminOnly: true,
      },
      {
        href: routes.videos,
        label: 'Videos',
        description: 'Gestionar contenido audiovisual.',
        testId: 'dashboard-action-videos',
        tour: 'dashboard-videos',
        icon: <Video className="h-5 w-5" />,
        adminOnly: true,
      },
      {
        href: routes.pedido,
        label: 'Catálogo',
        description: 'Ver el catálogo público.',
        testId: 'dashboard-action-catalogo',
        tour: 'dashboard-catalogo',
        icon: <ShoppingCart className="h-5 w-5" />,
      },
      {
        href: routes.perfil,
        label: 'Mi perfil',
        description: 'Cambiar contraseña.',
        testId: 'dashboard-action-perfil',
        tour: 'dashboard-perfil',
        icon: <UserCircle className="h-5 w-5" />,
      },
    ],
    []
  );

  const visibleActions = actions.filter(
    (action) => !action.adminOnly || isAdmin
  );

  return (
    <div data-tour="dashboard-actions" className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">Accesos rápidos</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {visibleActions.map((action) => (
          <Card
            key={action.href}
            data-tour={action.tour}
            data-testid={action.testId}
            className="hover:border-primary/30 transition-colors"
          >
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                {action.icon}
                {action.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-base leading-relaxed text-muted-foreground">
                {action.description}
              </p>
              <Link href={action.href} className="mt-5 inline-block">
                <Button variant="outline" className="w-full sm:w-auto">
                  Ir
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function DashboardClient({
  branchName,
  role,
  userName,
}: DashboardClientProps) {
  const { data, loading, error, refresh } = useDashboard();
  const isAdmin = role === 'admin';

  if (loading && !data) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-8">
      <div data-tour="dashboard-header">
        <h1 className="text-2xl font-semibold tracking-tight">
          Panel de control
        </h1>
        <p className="text-base text-muted-foreground">
          Resumen operativo de {branchName ? ` ${branchName}` : 'la sucursal'}.
          {userName && (
            <>
              {' '}
              Sesión iniciada como <span className="text-foreground">{userName}</span>.
            </>
          )}
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/15 p-4 text-base text-destructive">
          {error}
        </div>
      )}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <CajaCard data={data} />
            <PedidosCard data={data} />
            <StockCard data={data} />
          </div>

          <DashboardActions isAdmin={isAdmin} />

          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void refresh()}
              disabled={loading}
              data-testid="dashboard-refresh"
            >
              Actualizar
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
