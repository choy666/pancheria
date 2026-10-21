import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LayoutGrid, MonitorPlay } from 'lucide-react';
import { auth } from '@/auth';
import { routes } from '@/config/routes';
import * as pantallaService from '@/application/services/pantallaService';
import * as menuService from '@/application/services/menuService';
import { getCurrentBranchIdOrRedirect } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { PantallaSettingsForm } from '@/components/pantalla-config/pantalla-settings-form';
import { PantallaPlaylistEditor } from '@/components/pantalla-config/pantalla-items-editor';
import { MenuSettingsForm } from '@/components/menu-config/menu-settings-form';
import {
  savePantallaPlaylistAction,
  updateMenuSettingsAction,
  updatePantallaSettingsAction,
} from '@/app/(panel)/pantalla-config/actions';

/**
 * Configuración de las TVs de la sucursal activa, agrupada por vista: el
 * carrusel publicitario `/pantalla` y el menú digital `/menu`. Solo admin
 * (mismo criterio que `/videos` y `/sucursales`): el operador solo opera
 * caja/pedidos, la vidriera la decide el dueño.
 */
export default async function PantallaConfigPage() {
  const session = await auth();

  if (session?.user?.role !== 'admin') {
    redirect(routes.home);
  }

  const branchId = await getCurrentBranchIdOrRedirect(session);

  const [settings, items, candidates, menuSettings, menuProducts] =
    await Promise.all([
      pantallaService.getSettings(branchId),
      pantallaService.listPlaylist(branchId),
      pantallaService.listCandidates(branchId),
      menuService.getSettings(branchId),
      menuService.listMenuProducts(branchId),
    ]);

  return (
    <div data-tour="pantalla-config-page" className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pantallas</h1>
        <p className="text-sm text-muted-foreground">
          Qué se muestra en las TVs de esta sucursal, una sección por vista:
          el carrusel publicitario y el menú digital.
        </p>
      </div>

      <section aria-labelledby="seccion-carrusel" className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2
            id="seccion-carrusel"
            className="text-lg font-semibold tracking-tight"
          >
            Carrusel publicitario{' '}
            <code className="text-sm text-muted-foreground">/pantalla</code>
          </h2>
          <Link
            href={`${routes.pantalla}?branchId=${branchId}`}
            target="_blank"
            rel="noopener"
            className="w-full sm:w-auto"
          >
            <Button
              variant="outline"
              data-testid="pantalla-open-live"
              className="w-full sm:w-auto"
            >
              <MonitorPlay aria-hidden />
              Ver pantalla
            </Button>
          </Link>
        </div>

        <PantallaSettingsForm
          settings={settings}
          updateAction={updatePantallaSettingsAction}
        />

        <PantallaPlaylistEditor
          mode={settings.playlistMode}
          items={items}
          candidates={candidates}
          saveAction={savePantallaPlaylistAction}
        />
      </section>

      <section aria-labelledby="seccion-menu" className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2
            id="seccion-menu"
            className="text-lg font-semibold tracking-tight"
          >
            Menú digital{' '}
            <code className="text-sm text-muted-foreground">/menu</code>
          </h2>
          <Link
            href={`${routes.menu}?branchId=${branchId}`}
            target="_blank"
            rel="noopener"
            className="w-full sm:w-auto"
          >
            <Button
              variant="outline"
              data-testid="menu-open-live"
              className="w-full sm:w-auto"
            >
              <LayoutGrid aria-hidden />
              Ver menú
            </Button>
          </Link>
        </div>

        <MenuSettingsForm
          settings={menuSettings}
          products={menuProducts}
          updateAction={updateMenuSettingsAction}
        />
      </section>
    </div>
  );
}
