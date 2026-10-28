import { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import * as catalogService from '@/application/services/catalogService';
import * as brandService from '@/application/services/brandService';
import * as branchService from '@/application/services/branchService';
import {
  listPublicBranches,
  getDefaultBranchId,
  parseBranchId,
} from '@/lib/branch-resolver';
import { PedidoClient } from '@/components/pedido/pedido-client';
import { PedidoSkeleton } from '@/components/pedido/pedido-skeleton';
import { PedidoError } from '@/components/pedido/pedido-error';
import { BrandAnnouncement } from '@/components/publico/brand-announcement';
import { PublicFooter } from '@/components/publico/public-footer';
import { PublicHeader } from '@/components/publico/public-header';
import { logError } from '@/lib/logger';
import { routes } from '@/config/routes';
import { getCatalogPageSize } from '@/config/catalog';
import { getPublicBaseUrl } from '@/lib/public-url';
import { getBrandDisplayName, getBrandLogoPath } from '@/lib/brand-helpers';
import { buildBranchRestaurantJsonLd, serializeJsonLd } from '@/lib/structured-data';
import type { Branch, BrandSettings } from '@/domain/types';

interface PedidoPageProps {
  searchParams: Promise<{ branchId?: string }>;
}

type CatalogResult = Awaited<
  ReturnType<typeof catalogService.listPublicCatalogWithAvailability>
>;

interface PedidoCatalogProps {
  branchId: number;
  brand: BrandSettings;
}

/**
 * Componente asíncrono que carga el catálogo y sucursales. Al estar envuelto
 * en Suspense, el esqueleto se muestra mientras se resuelven los datos.
 */
async function PedidoCatalog({ branchId, brand }: PedidoCatalogProps) {
  let catalog: CatalogResult | null = null;
  let branches: Branch[] = [];
  let hasError = false;

  const pageSize = getCatalogPageSize();

  try {
    [catalog, branches] = await Promise.all([
      catalogService.listPublicCatalogWithAvailability(branchId, {
        limit: pageSize,
        offset: 0,
      }),
      listPublicBranches(),
    ]);

    if (!catalog || !branches.some((b) => b.id === branchId)) {
      hasError = true;
    }
  } catch (error) {
    logError('Error al cargar el catálogo público', error);
    hasError = true;
  }

  if (hasError || !catalog) {
    return <PedidoError />;
  }

  return (
    <PedidoClient
      key={branchId}
      branches={branches}
      activeBranch={catalog.branch}
      initialProducts={catalog.products}
      initialTotal={catalog.total}
      pageSize={pageSize}
      termsUrl={brand.termsUrl}
      privacyUrl={brand.privacyUrl}
    />
  );
}

export async function generateMetadata({
  searchParams,
}: PedidoPageProps): Promise<Metadata> {
  const params = await searchParams;
  const branchId = parseBranchId(params.branchId) ?? (await getDefaultBranchId());
  const [brand, found] = await Promise.all([
    brandService.getBrand(),
    branchId ? branchService.getBranchById(branchId) : undefined,
  ]);
  const branch = found?.isActive ? found : undefined;
  const baseUrl = getPublicBaseUrl();
  const displayName = getBrandDisplayName(brand, branch?.name);
  const title = `Pedí online en ${branch?.name ?? displayName}`;
  const description =
    brand.tagline ??
    `Armá tu pedido${branch ? ` en ${branch.name}` : ''} y coordinalo por el chat.`;
  const url = `${baseUrl}${routes.pedido}${branchId ? `?branchId=${branchId}` : ''}`;
  const logo = getBrandLogoPath(brand.logoUpdatedAt);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: displayName,
      type: 'website',
      locale: 'es_AR',
      ...(logo ? { images: [{ url: `${baseUrl}${logo}`, alt: displayName }] } : {}),
    },
  };
}

export default async function PedidoPage({ searchParams }: PedidoPageProps) {
  const params = await searchParams;
  let branchId: number | null = null;
  let resolvedFromDefault = false;

  if (params.branchId) {
    const parsed = parseBranchId(params.branchId);
    if (parsed === null) {
      redirect(routes.pedido);
    }
    branchId = parsed;
  } else {
    branchId = await getDefaultBranchId();
    resolvedFromDefault = true;
  }

  if (branchId === null) {
    return <PedidoError />;
  }

  if (resolvedFromDefault) {
    redirect(`${routes.pedido}?branchId=${branchId}`);
  }

  const [brand, found] = await Promise.all([
    brandService.getBrand(),
    branchService.getBranchById(branchId),
  ]);
  const branch = found?.isActive ? found : undefined;

  return (
    <>
      <PublicHeader
        brand={brand}
        branchId={branchId}
        branchName={branch?.name}
      />
      <main className="flex-1 space-y-5 p-4 md:p-6 lg:p-8">
        {brand.announcementEnabled && brand.announcementText && (
          <BrandAnnouncement
            text={brand.announcementText}
            variant={brand.announcementVariant}
          />
        )}
        <Suspense fallback={<PedidoSkeleton />}>
          <PedidoCatalog branchId={branchId} brand={brand} />
        </Suspense>
      </main>
      <PublicFooter brand={brand} branch={branch} />
      {branch && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(
              buildBranchRestaurantJsonLd({
                baseUrl: getPublicBaseUrl(),
                brand,
                branch,
              })
            ),
          }}
        />
      )}
    </>
  );
}

// Fuerza renderizado dinámico para evitar que `next build` consulte la base
// de datos durante la generación estática. Esto protege a producción de
// lecturas accidentales en build y asegura que el catálogo siempre se resuelva
// en el contexto de la sucursal activa.
export const dynamic = 'force-dynamic';
