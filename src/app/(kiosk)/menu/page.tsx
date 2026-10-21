import { Suspense } from 'react';
import type { Metadata } from 'next';
import { resolveKioskBranchId } from '@/lib/kiosk-branch';
import { buildMenuSnapshot } from '@/lib/menu-snapshot';
import { MenuClient } from '@/components/menu/menu-client';
import { PantallaError } from '@/components/pantalla/pantalla-error';
import { PantallaSkeleton } from '@/components/pantalla/pantalla-skeleton';
import { logError } from '@/lib/logger';
import { routes } from '@/config/routes';
import type { MenuSnapshot } from '@/lib/menu-snapshot';

export const metadata: Metadata = {
  title: 'Menú digital - Panchería',
  description:
    'Carta completa de la sucursal para Smart TV: productos por categoría con QR de pedidos.',
};

interface MenuPageProps {
  searchParams: Promise<{ branchId?: string }>;
}

/**
 * Componente asíncrono que carga el snapshot inicial del menú digital
 * (sucursal + catálogo). Al estar envuelto en Suspense, el skeleton se
 * muestra mientras se resuelven los datos.
 */
async function MenuScreen({ branchId }: { branchId: number }) {
  let snapshot: MenuSnapshot | null = null;

  try {
    snapshot = await buildMenuSnapshot(branchId);
  } catch (error) {
    logError('Error al cargar el snapshot del menú digital', error);
  }

  if (!snapshot) {
    return <PantallaError />;
  }

  return <MenuClient key={branchId} initialSnapshot={snapshot} />;
}

export default async function MenuPage({ searchParams }: MenuPageProps) {
  const params = await searchParams;
  const branchId = await resolveKioskBranchId(params, routes.menu);

  if (branchId === null) {
    return <PantallaError />;
  }

  return (
    <Suspense fallback={<PantallaSkeleton />}>
      <MenuScreen branchId={branchId} />
    </Suspense>
  );
}

// Fuerza renderizado dinámico para evitar que `next build` consulte la base
// de datos durante la generación estática, igual que `/pantalla`.
export const dynamic = 'force-dynamic';
