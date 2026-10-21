import { Suspense } from 'react';
import { resolveKioskBranchId } from '@/lib/kiosk-branch';
import { buildPantallaSnapshot } from '@/lib/pantalla-snapshot';
import { PantallaClient } from '@/components/pantalla/pantalla-client';
import { PantallaError } from '@/components/pantalla/pantalla-error';
import { PantallaSkeleton } from '@/components/pantalla/pantalla-skeleton';
import { logError } from '@/lib/logger';
import { routes } from '@/config/routes';
import type { PantallaSnapshot } from '@/lib/pantalla-playlist';

interface PantallaPageProps {
  searchParams: Promise<{ branchId?: string }>;
}

/**
 * Componente asíncrono que carga el snapshot inicial de la pantalla
 * (sucursal + catálogo + videos). Al estar envuelto en Suspense, el skeleton
 * se muestra mientras se resuelven los datos.
 */
async function PantallaScreen({ branchId }: { branchId: number }) {
  let snapshot: PantallaSnapshot | null = null;

  try {
    snapshot = await buildPantallaSnapshot(branchId);
  } catch (error) {
    logError('Error al cargar el snapshot de la pantalla', error);
  }

  if (!snapshot) {
    return <PantallaError />;
  }

  return <PantallaClient key={branchId} initialSnapshot={snapshot} />;
}

export default async function PantallaPage({
  searchParams,
}: PantallaPageProps) {
  const params = await searchParams;
  const branchId = await resolveKioskBranchId(params, routes.pantalla);

  if (branchId === null) {
    return <PantallaError />;
  }

  return (
    <Suspense fallback={<PantallaSkeleton />}>
      <PantallaScreen branchId={branchId} />
    </Suspense>
  );
}

// Fuerza renderizado dinámico para evitar que `next build` consulte la base
// de datos durante la generación estática, igual que las páginas públicas
// críticas (`/pedido`, `/pedido/[id]/chat`).
export const dynamic = 'force-dynamic';
