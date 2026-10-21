'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PUBLIC_MENU_API } from '@/config/api';
import { getPantallaRefetchIntervalMs } from '@/config/pantalla';
import { useVisibilityPolling } from '@/hooks/use-visibility-polling';
import { PantallaChrome } from '@/components/pantalla/pantalla-chrome';
import { buildMenuPages } from '@/lib/menu-pages';
import { MenuBoard } from './menu-board';
import { MenuQrStrip } from './menu-qr-strip';
import type { MenuSnapshot } from '@/lib/menu-snapshot';

interface MenuClientProps {
  initialSnapshot: MenuSnapshot;
}

/**
 * Orquestador del menú digital `/menu`: mantiene el snapshot (SSR + polling
 * a `/api/public/menu`), reparte el catálogo en páginas por categoría y las
 * rota solo cuando el contenido supera una pantalla. La barra de progreso
 * inferior indica el tiempo de cada página, como en las escenas de
 * `/pantalla`.
 */
export function MenuClient({ initialSnapshot }: MenuClientProps) {
  const [snapshot, setSnapshot] = useState<MenuSnapshot>(initialSnapshot);

  // La configuración llega dentro del snapshot (fila `menu_settings` de la
  // sucursal o los defaults de entorno si todavía no se personalizó): un
  // cambio en el panel se aplica solo en el próximo poll.
  const settings = snapshot.settings;
  const hiddenProductIds = useMemo(
    () => new Set(settings.hiddenProductIds),
    [settings.hiddenProductIds]
  );
  const featuredProductIds = useMemo(
    () => new Set(settings.featuredProductIds),
    [settings.featuredProductIds]
  );
  const pages = useMemo(
    () =>
      buildMenuPages(snapshot.products, {
        filasPagina: settings.filasPagina,
        columnas: settings.gridColumns,
        ocultos: hiddenProductIds,
        destacados: featuredProductIds,
        orden: settings.sortOrder,
      }),
    [
      snapshot.products,
      settings.filasPagina,
      settings.gridColumns,
      settings.sortOrder,
      hiddenProductIds,
      featuredProductIds,
    ]
  );

  const [pageIndex, setPageIndex] = useState(0);
  const safeIndex = Math.min(pageIndex, pages.length - 1);
  const page = pages[safeIndex];

  // Un refetch puede reducir la cantidad de páginas (productos agotados o
  // dados de baja): si el índice quedó fuera de rango se retoma desde la
  // primera, diferido a microtask para no encadenar setState en el efecto.
  useEffect(() => {
    if (pageIndex > pages.length - 1) {
      queueMicrotask(() => setPageIndex(0));
    }
  }, [pageIndex, pages.length]);

  const paginaMs = settings.paginaMs;
  const rotating = pages.length > 1;
  useEffect(() => {
    if (!rotating) return;
    const id = setTimeout(
      () => setPageIndex((index) => (index + 1) % pages.length),
      paginaMs
    );
    return () => clearTimeout(id);
  }, [safeIndex, rotating, paginaMs, pages.length]);

  const branchId = snapshot.branch.id;
  const refetch = useCallback(async () => {
    try {
      const response = await fetch(`${PUBLIC_MENU_API}?branchId=${branchId}`);
      if (!response.ok) return;
      const data = (await response.json()) as MenuSnapshot;
      setSnapshot(data);
    } catch {
      // Refresco silencioso: la TV sigue mostrando el último snapshot válido.
    }
  }, [branchId]);

  // Misma cadencia de refresco que `/pantalla` (NEXT_PUBLIC_PANTALLA_REFETCH_INTERVAL_MS).
  useVisibilityPolling(
    () => {
      void refetch();
    },
    getPantallaRefetchIntervalMs(),
    true,
    true
  );

  const isEmpty = page.groups.length === 0;

  return (
    <div
      data-testid="menu-screen"
      className="relative flex h-dvh flex-col overflow-hidden bg-background"
    >
      <PantallaChrome
        branch={snapshot.branch}
        isOpen={snapshot.isOpen}
        closedHint="Podés mirar la carta y pedir desde el QR."
      />

      <main className="relative min-h-0 flex-1 pt-24 md:pt-28">
        {/* Halos de marca sobre el fondo oscuro, el mismo lenguaje visual
            que las escenas de /pantalla */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-40 top-1/4 size-[32rem] rounded-full bg-brand-red/15 blur-[140px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-32 bottom-0 size-[26rem] rounded-full bg-brand-mustard/10 blur-[140px]"
        />

        {isEmpty ? (
          <MenuEmptyState message={snapshot.message} />
        ) : (
          <div
            key={safeIndex}
            className="h-full animate-in fade-in slide-in-from-bottom-4 duration-700"
          >
            <MenuBoard
              page={page}
              columnas={settings.gridColumns}
              fontScale={settings.fontScale}
              cardStyle={settings.cardStyle}
              showDescriptions={settings.showDescriptions}
              destacados={featuredProductIds}
            />
          </div>
        )}
      </main>

      {settings.showQrStrip && (
        <MenuQrStrip branch={snapshot.branch} text={settings.qrStripText} />
      )}

      {rotating && (
        <div className="absolute inset-x-0 bottom-0 z-20 h-1.5 bg-white/10">
          <div
            key={safeIndex}
            data-testid="menu-progress"
            className="h-full origin-left bg-brand-mustard"
            style={{
              animation: `pantalla-scene-progress ${paginaMs}ms linear forwards`,
            }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Catálogo sin productos vendibles (o todos agotados): la TV no queda en
 * negro — muestra el estado operativo de la sucursal y el QR sigue abajo.
 */
function MenuEmptyState({ message }: { message: string }) {
  return (
    <div
      data-testid="menu-empty"
      className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center"
    >
      <p className="font-heading text-4xl tracking-wide text-white md:text-6xl">
        Menú no disponible por ahora
      </p>
      <p className="max-w-2xl text-lg text-white/70 md:text-2xl">{message}</p>
    </div>
  );
}
