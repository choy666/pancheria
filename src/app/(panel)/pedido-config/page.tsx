import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { auth } from '@/auth';
import { routes } from '@/config/routes';
import * as brandService from '@/application/services/brandService';
import * as branchService from '@/application/services/branchService';
import { getCurrentBranchIdOrRedirect } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { BrandLogoCard } from '@/components/pedido-config/brand-logo-card';
import { BrandSettingsForm } from '@/components/pedido-config/brand-settings-form';
import {
  removeBrandLogoAction,
  updateBrandLogoAction,
  updateBrandSettingsAction,
} from '@/app/(panel)/pedido-config/actions';

/**
 * Identidad de la página de pedido: nombre, logo, pie legal, ayuda y aviso.
 * La marca es única para todas las sucursales; la vista previa muestra cómo
 * la ve el cliente con los datos de la sucursal activa. Solo admin.
 */
export default async function PedidoConfigPage() {
  const session = await auth();

  if (session?.user?.role !== 'admin') {
    redirect(routes.home);
  }

  const branchId = await getCurrentBranchIdOrRedirect(session);
  const [brand, branch] = await Promise.all([
    brandService.getBrand(),
    branchService.getBranchById(branchId),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Página de pedido</h1>
          <p className="text-sm text-muted-foreground">
            Cómo se ve la marca en /pedido, el seguimiento, el chat y las
            pantallas. Los contactos, horarios y mapa se editan por sucursal.
          </p>
        </div>
        <Link
          href={`${routes.pedido}?branchId=${branchId}`}
          target="_blank"
          rel="noopener"
          className="w-full sm:w-auto"
        >
          <Button variant="outline" className="w-full sm:w-auto">
            <ExternalLink aria-hidden />
            Ver página de pedido
          </Button>
        </Link>
      </div>

      <BrandLogoCard
        logoUpdatedAt={brand.logoUpdatedAt}
        uploadAction={updateBrandLogoAction}
        removeAction={removeBrandLogoAction}
      />

      <BrandSettingsForm
        brand={brand}
        branch={branch ?? null}
        updateAction={updateBrandSettingsAction}
      />
    </div>
  );
}
