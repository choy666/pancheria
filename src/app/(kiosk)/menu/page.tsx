import { Suspense } from 'react';
import type { Metadata } from 'next';
import * as brandService from '@/application/services/brandService';
import * as branchService from '@/application/services/branchService';
import { resolveKioskBranchId } from '@/lib/kiosk-branch';
import { getBrandDisplayName } from '@/lib/brand-helpers';
import { buildMenuSnapshot } from '@/lib/menu-snapshot';
import { MenuClient } from '@/components/menu/menu-client';
import { PantallaError } from '@/components/pantalla/pantalla-error';
import { PantallaSkeleton } from '@/components/pantalla/pantalla-skeleton';
import { logError } from '@/lib/logger';
import { routes } from '@/config/routes';
import type { MenuSnapshot } from '@/lib/menu-snapshot';

export async function generateMetadata(): Promise<Metadata> {
  const brand = await brandService.getBrand();
  return {
    title: `Menú digital - ${getBrandDisplayName(brand)}`,
    description:
      'Carta completa de la sucursal para Smart TV: productos por categoría con QR de pedidos.',
  };
}

interface MenuPageProps {
  searchParams: Promise<{ branchId?: string }>;
}

/**
 * Componente asíncrono que carga el snapshot inicial del menú digital
 * (sucursal + catálogo). Al estar envuelto en Suspense, el skeleton se
 * muestra mientras se resuelven los datos.
 */
async function MenuScreen({
  branchId,
  brandName,
}: {
  branchId: number;
  brandName: string;
}) {
  let snapshot: MenuSnapshot | null = null;

  try {
    snapshot = await buildMenuSnapshot(branchId);
  } catch (error) {
    logError('Error al cargar el snapshot del menú digital', error);
  }

  if (!snapshot) {
    return <PantallaError brandName={brandName} />;
  }

  return <MenuClient key={branchId} initialSnapshot={snapshot} />;
}

export default async function MenuPage({ searchParams }: MenuPageProps) {
  const params = await searchParams;
  const branchId = await resolveKioskBranchId(params, routes.menu);
  const brand = await brandService.getBrand();

  if (branchId === null) {
    return <PantallaError brandName={getBrandDisplayName(brand)} />;
  }

  const branch = await branchService.getBranchById(branchId);
  const brandName = getBrandDisplayName(brand, branch?.name);

  return (
    <Suspense fallback={<PantallaSkeleton brandName={brandName} />}>
      <MenuScreen branchId={branchId} brandName={brandName} />
    </Suspense>
  );
}

// Fuerza renderizado dinámico para evitar que `next build` consulte la base
// de datos durante la generación estática, igual que `/pantalla`.
export const dynamic = 'force-dynamic';
