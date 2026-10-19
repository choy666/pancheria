import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MonitorPlay } from 'lucide-react';
import { auth } from '@/auth';
import { routes } from '@/config/routes';
import * as pantallaService from '@/application/services/pantallaService';
import { getCurrentBranchIdOrRedirect } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { PantallaSettingsForm } from '@/components/pantalla-config/pantalla-settings-form';
import { PantallaPlaylistEditor } from '@/components/pantalla-config/pantalla-items-editor';
import {
  savePantallaPlaylistAction,
  updatePantallaSettingsAction,
} from '@/app/(panel)/pantalla-config/actions';

/**
 * Configuración de la pantalla publicitaria `/pantalla` de la sucursal
 * activa. Solo admin (mismo criterio que `/videos` y `/sucursales`):
 * el operador solo opera caja/pedidos, la vidriera la decide el dueño.
 */
export default async function PantallaConfigPage() {
  const session = await auth();

  if (session?.user?.role !== 'admin') {
    redirect(routes.home);
  }

  const branchId = await getCurrentBranchIdOrRedirect(session);

  const [settings, items, candidates] = await Promise.all([
    pantallaService.getSettings(branchId),
    pantallaService.listPlaylist(branchId),
    pantallaService.listCandidates(branchId),
  ]);

  return (
    <div data-tour="pantalla-config-page" className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Pantalla publicitaria
          </h1>
          <p className="text-sm text-muted-foreground">
            Qué se muestra, en qué orden y cuánto dura cada escena en la TV de
            esta sucursal.
          </p>
        </div>
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
    </div>
  );
}
