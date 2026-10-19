'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { PantallaSettings } from '@/lib/pantalla-playlist';
import type { PantallaConfigState } from '@/app/(panel)/pantalla-config/actions';

interface PantallaSettingsFormProps {
  settings: PantallaSettings;
  updateAction: (
    _prevState: PantallaConfigState,
    formData: FormData
  ) => Promise<PantallaConfigState>;
}

const initialState: PantallaConfigState = null;

function msToSeconds(ms: number): number {
  return Math.round(ms / 1000);
}

/**
 * Formulario de configuración general de la pantalla publicitaria: modo de
 * la playlist, duración de cada tipo de escena (en segundos; el servidor
 * las persiste en ms) y escenas fijas habilitadas. La edición de los ítems
 * de la playlist vive en `PantallaPlaylistEditor`.
 */
export function PantallaSettingsForm({
  settings,
  updateAction,
}: PantallaSettingsFormProps) {
  const [state, formAction, isPending] = useActionState(
    updateAction,
    initialState
  );

  return (
    <form action={formAction} data-testid="pantalla-settings-form">
      <Card>
        <CardHeader>
          <CardTitle>Configuración</CardTitle>
          <CardDescription>
            Modo de la playlist y duración de las escenas. Los cambios se
            aplican solos en la próxima actualización de la TV (cada ~2
            minutos), sin redeploy.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Modo de la playlist</legend>
            <Label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/8 p-4 font-normal">
              <input
                type="radio"
                name="playlistMode"
                value="auto"
                defaultChecked={settings.playlistMode === 'auto'}
                className="mt-0.5 h-4 w-4 accent-primary"
                data-testid="pantalla-mode-auto"
              />
              <span>
                <span className="block font-medium">Automática</span>
                <span className="block text-sm text-muted-foreground">
                  Rota todos los productos con stock y los videos activos,
                  intercalados (el comportamiento de siempre).
                </span>
              </span>
            </Label>
            <Label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/8 p-4 font-normal">
              <input
                type="radio"
                name="playlistMode"
                value="custom"
                defaultChecked={settings.playlistMode === 'custom'}
                className="mt-0.5 h-4 w-4 accent-primary"
                data-testid="pantalla-mode-custom"
              />
              <span>
                <span className="block font-medium">Personalizada</span>
                <span className="block text-sm text-muted-foreground">
                  Solo los ítems de la playlist de abajo, en el orden elegido.
                  Los productos sin stock se omiten automáticamente.
                </span>
              </span>
            </Label>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">
              Duración de las escenas (segundos)
            </legend>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="productoSegundos">Producto</Label>
                <Input
                  id="productoSegundos"
                  name="productoSegundos"
                  type="number"
                  min={1}
                  max={600}
                  step={1}
                  required
                  defaultValue={msToSeconds(settings.productoMs)}
                  data-testid="pantalla-producto-segundos"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sucursalSegundos">Sucursal</Label>
                <Input
                  id="sucursalSegundos"
                  name="sucursalSegundos"
                  type="number"
                  min={1}
                  max={600}
                  step={1}
                  required
                  defaultValue={msToSeconds(settings.sucursalMs)}
                  data-testid="pantalla-sucursal-segundos"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qrSegundos">QR de pedidos</Label>
                <Input
                  id="qrSegundos"
                  name="qrSegundos"
                  type="number"
                  min={1}
                  max={600}
                  step={1}
                  required
                  defaultValue={msToSeconds(settings.qrMs)}
                  data-testid="pantalla-qr-segundos"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="videoMaxSegundos">Tope de video</Label>
                <Input
                  id="videoMaxSegundos"
                  name="videoMaxSegundos"
                  type="number"
                  min={1}
                  max={600}
                  step={1}
                  required
                  defaultValue={msToSeconds(settings.videoMaxMs)}
                  data-testid="pantalla-video-max-segundos"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              El video dura lo que dura el archivo; el tope es una red de
              seguridad por si el stream se cuelga. Las duraciones van de 1 a
              600 segundos.
            </p>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="maxProductos">
                Máximo de productos por ciclo (modo automático)
              </Label>
              <Input
                id="maxProductos"
                name="maxProductos"
                type="number"
                min={1}
                max={200}
                step={1}
                required
                defaultValue={settings.maxProductos}
                data-testid="pantalla-max-productos"
              />
            </div>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Escenas fijas</legend>
            <Label
              htmlFor="showBranchScene"
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/8 p-4 font-normal"
            >
              <input
                id="showBranchScene"
                name="showBranchScene"
                type="checkbox"
                defaultChecked={settings.showBranchScene}
                className="h-5 w-5 accent-primary"
                data-testid="pantalla-show-branch"
              />
              <span>
                <span className="block font-medium">Sucursal</span>
                <span className="block text-sm text-muted-foreground">
                  Escena con horarios, estado abierto/cerrado y datos de
                  contacto al final del ciclo.
                </span>
              </span>
            </Label>
            <Label
              htmlFor="showQrScene"
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/8 p-4 font-normal"
            >
              <input
                id="showQrScene"
                name="showQrScene"
                type="checkbox"
                defaultChecked={settings.showQrScene}
                className="h-5 w-5 accent-primary"
                data-testid="pantalla-show-qr"
              />
              <span>
                <span className="block font-medium">QR de pedidos</span>
                <span className="block text-sm text-muted-foreground">
                  Escena final con el código QR que lleva al pedido online de
                  esta sucursal.
                </span>
              </span>
            </Label>
            <p className="text-xs text-muted-foreground">
              Si ambas quedan desactivadas y la playlist está vacía, la
              pantalla muestra la escena de sucursal como respaldo.
            </p>
          </fieldset>

          {state?.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}
          {state?.success && (
            <p
              className="text-sm text-green-600"
              role="status"
              data-testid="pantalla-settings-success"
            >
              {state.success}
            </p>
          )}
        </CardContent>

        <CardFooter>
          <Button
            type="submit"
            disabled={isPending}
            data-testid="pantalla-settings-save"
            className="w-full sm:w-auto"
          >
            {isPending ? 'Guardando...' : 'Guardar configuración'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
