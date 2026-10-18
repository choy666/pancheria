import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import {
  getDefaultBranchId,
  parseBranchId,
} from '@/lib/branch-resolver';
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
  let branchId: number | null = null;
  let resolvedFromDefault = false;

  if (params.branchId) {
    const parsed = parseBranchId(params.branchId);
    if (parsed === null) {
      redirect(routes.pantalla);
    }
    branchId = parsed;
  } else {
    branchId = await getDefaultBranchId();
    resolvedFromDefault = true;
  }

  if (branchId === null) {
    return <PantallaError />;
  }

  // URL canónica con branchId explícito, igual que /pedido: la TV puede
  // quedar fijada a una sucursal concreta y el QR apunta siempre bien.
  if (resolvedFromDefault) {
    redirect(`${routes.pantalla}?branchId=${branchId}`);
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
