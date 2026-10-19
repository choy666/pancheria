'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildPantallaPlaylist,
  type PantallaScene,
  type PantallaSettings,
  type PantallaSnapshot,
} from '@/lib/pantalla-playlist';
import { PUBLIC_PANTALLA_API } from '@/config/api';
import { getPantallaRefetchIntervalMs } from '@/config/pantalla';
import { getBranchTimezone } from '@/config/branch';
import { useVisibilityPolling } from '@/hooks/use-visibility-polling';
import { useClockInterval } from '@/hooks/use-clock-interval';
import { PantallaVideoScene } from './pantalla-video-scene';
import { PantallaProductScene } from './pantalla-product-scene';
import { PantallaBranchScene } from './pantalla-branch-scene';
import { PantallaQrScene } from './pantalla-qr-scene';
import { cn } from '@/lib/utils';

interface PantallaClientProps {
  initialSnapshot: PantallaSnapshot;
}

/**
 * Duración de una escena según la configuración de la sucursal
 * (`snapshot.settings`: fila de `pantalla_settings` o defaults de entorno).
 * Las escenas de video no tienen duración fija: la dicta el propio video
 * (onEnded) más el watchdog interno de la escena para streams rotos.
 */
function sceneDurationMs(
  scene: PantallaScene,
  settings: PantallaSettings
): number | null {
  switch (scene.kind) {
    case 'product':
      return settings.productoMs;
    case 'branch':
      return settings.sucursalMs;
    case 'qr':
      return settings.qrMs;
    case 'video':
      return null;
  }
}

/**
 * Orquestador de la pantalla publicitaria: mantiene el snapshot (SSR +
 * polling a `/api/public/pantalla`), construye la playlist intercalada y
 * rota las escenas sin interacción. La posición se direcciona por `key` de
 * escena: si un refetch deja la escena vigente en la lista, se conserva (un
 * video en reproducción no se reinicia); si desapareció, se retoma desde el
 * inicio del ciclo.
 */
export function PantallaClient({ initialSnapshot }: PantallaClientProps) {
  const [snapshot, setSnapshot] = useState<PantallaSnapshot>(initialSnapshot);

  const playlist = useMemo(() => buildPantallaPlaylist(snapshot), [snapshot]);

  const [sceneKey, setSceneKey] = useState<string>(playlist[0].key);
  const index = playlist.findIndex((s) => s.key === sceneKey);
  const sceneIndex = index === -1 ? 0 : index;
  const scene = playlist[sceneIndex];

  const playlistRef = useRef(playlist);
  useEffect(() => {
    playlistRef.current = playlist;
    if (index === -1) {
      // La escena vigente salió de la playlist (video desactivado, producto
      // sin stock): retomar desde el inicio del ciclo. Se difiere con
      // microtask para no encadenar setState sincrónico en el efecto.
      queueMicrotask(() => setSceneKey(playlist[0].key));
    }
  }, [playlist, index]);

  const advance = useCallback(() => {
    setSceneKey((key) => {
      const list = playlistRef.current;
      if (list.length === 0) return key;
      const i = list.findIndex((s) => s.key === key);
      return list[(Math.max(i, 0) + 1) % list.length].key;
    });
  }, []);

  const timedMs = sceneDurationMs(scene, snapshot.settings);
  useEffect(() => {
    if (timedMs === null) return;
    const id = setTimeout(advance, timedMs);
    return () => clearTimeout(id);
  }, [scene.key, timedMs, advance]);

  const branchId = snapshot.branch.id;
  const refetch = useCallback(async () => {
    try {
      const response = await fetch(
        `${PUBLIC_PANTALLA_API}?branchId=${branchId}`
      );
      if (!response.ok) return;
      const data = (await response.json()) as PantallaSnapshot;
      setSnapshot(data);
    } catch {
      // Refresco silencioso: la TV sigue rotando el último snapshot válido.
    }
  }, [branchId]);

  useVisibilityPolling(
    () => {
      void refetch();
    },
    getPantallaRefetchIntervalMs(),
    true,
    true
  );

  return (
    <div
      data-testid="pantalla-screen"
      className="relative flex h-dvh flex-col overflow-hidden bg-background"
    >
      <PantallaChrome snapshot={snapshot} />

      <main className="relative min-h-0 flex-1">
        <div
          key={scene.key}
          className="absolute inset-0 animate-in fade-in slide-in-from-bottom-4 duration-700"
        >
          <SceneContent scene={scene} snapshot={snapshot} onDone={advance} />
        </div>
      </main>

      {timedMs !== null && (
        <div className="absolute inset-x-0 bottom-0 z-20 h-1.5 bg-white/10">
          <div
            key={scene.key}
            data-testid="pantalla-progress"
            className="h-full origin-left bg-brand-mustard"
            style={{
              animation: `pantalla-scene-progress ${timedMs}ms linear forwards`,
            }}
          />
        </div>
      )}
    </div>
  );
}

function SceneContent({
  scene,
  snapshot,
  onDone,
}: {
  scene: PantallaScene;
  snapshot: PantallaSnapshot;
  onDone: () => void;
}) {
  switch (scene.kind) {
    case 'video':
      return (
        <PantallaVideoScene
          video={scene.video}
          onDone={onDone}
          maxDurationMs={snapshot.settings.videoMaxMs}
        />
      );
    case 'product':
      return <PantallaProductScene product={scene.product} />;
    case 'branch':
      return <PantallaBranchScene snapshot={snapshot} />;
    case 'qr':
      return <PantallaQrScene branch={snapshot.branch} />;
  }
}

/**
 * Chrome persistente de la pantalla: marca a la izquierda; a la derecha el
 * estado de la sucursal y un reloj en la timezone de la sucursal. Flota
 * sobre las escenas con un gradiente para mantener legibilidad.
 */
function PantallaChrome({ snapshot }: { snapshot: PantallaSnapshot }) {
  const { branch, isOpen } = snapshot;
  // El reloj se renderiza solo tras la hidratación: el instante SSR del
  // servidor y el del cliente nunca coinciden.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);
  const now = useClockInterval(30_000);
  const clock = mounted
    ? new Intl.DateTimeFormat('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: getBranchTimezone(),
      }).format(now)
    : null;

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 bg-gradient-to-b from-black/70 to-transparent p-4 md:p-6">
      <p className="font-heading text-2xl tracking-wide md:text-3xl">
        <span className="text-brand-red">Pan</span>
        <span className="text-brand-mustard">chería</span>
      </p>

      <div className="flex flex-col items-end gap-1 text-right">
        <p className="text-sm font-medium text-white/80 md:text-base">
          {branch.name}
        </p>
        <p
          data-testid="pantalla-status"
          className={cn(
            'flex items-center gap-2 text-xs md:text-sm',
            isOpen ? 'text-green-400' : 'text-amber-400'
          )}
        >
          <span
            className={cn(
              'inline-block size-2 rounded-full',
              isOpen ? 'bg-green-500' : 'bg-amber-500'
            )}
          />
          {isOpen ? 'Abierto' : 'Cerrado'}
        </p>
        {clock && (
          <p
            data-testid="pantalla-clock"
            className="font-mono text-xl font-semibold text-white md:text-2xl"
          >
            {clock}
          </p>
        )}
      </div>
    </header>
  );
}
