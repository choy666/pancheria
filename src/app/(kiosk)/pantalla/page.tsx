import { Suspense } from 'react';
import * as brandService from '@/application/services/brandService';
import * as branchService from '@/application/services/branchService';
import { resolveKioskBranchId } from '@/lib/kiosk-branch';
import { getBrandDisplayName } from '@/lib/brand-helpers';
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
async function PantallaScreen({
  branchId,
  brandName,
}: {
  branchId: number;
  brandName: string;
}) {
  let snapshot: PantallaSnapshot | null = null;

  try {
    snapshot = await buildPantallaSnapshot(branchId);
  } catch (error) {
    logError('Error al cargar el snapshot de la pantalla', error);
  }

  if (!snapshot) {
    return <PantallaError brandName={brandName} />;
  }

  return <PantallaClient key={branchId} initialSnapshot={snapshot} />;
}

export default async function PantallaPage({
  searchParams,
}: PantallaPageProps) {
  const params = await searchParams;
  const branchId = await resolveKioskBranchId(params, routes.pantalla);
  const brand = await brandService.getBrand();

  if (branchId === null) {
    return <PantallaError brandName={getBrandDisplayName(brand)} />;
  }

  const branch = await branchService.getBranchById(branchId);
  const brandName = getBrandDisplayName(brand, branch?.name);

  return (
    <Suspense fallback={<PantallaSkeleton brandName={brandName} />}>
      <PantallaScreen branchId={branchId} brandName={brandName} />
    </Suspense>
  );
}

// Fuerza renderizado dinámico para evitar que `next build` consulte la base
// de datos durante la generación estática, igual que las páginas públicas
// críticas (`/pedido`, `/pedido/[id]/chat`).
export const dynamic = 'force-dynamic';
