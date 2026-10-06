'use client';

import { useState } from 'react';
import { MapPin } from 'lucide-react';

interface BranchLocationPreviewProps {
  /** URL embebible ya validada por `describeLocationInput`/`buildMapEmbedUrl`. */
  embedUrl: string;
}

/**
 * Preview del mapa embebido tal como se verá en el catálogo público `/pedido`
 * (allí se muestra siempre visible). El `<iframe>` solo se monta al abrir el
 * `<details>`: en el formulario conviene diferir la carga para no pedir al
 * proveedor de mapas en cada tecleo del input y evitar layout shift.
 *
 * `embedUrl` solo proviene de orígenes de `getMapsFrameOrigins()`, así que el
 * iframe queda cubierto por la CSP vigente (`frame-src`).
 */
export function BranchLocationPreview({
  embedUrl,
}: BranchLocationPreviewProps) {
  const [open, setOpen] = useState(false);

  return (
    <details
      data-testid="branch-location-preview-details"
      className="rounded-md border border-white/8 p-2"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="flex cursor-pointer items-center gap-1 text-sm text-primary">
        <MapPin className="size-4" aria-hidden="true" />
        Ver preview
      </summary>
      {open && (
        <iframe
          src={embedUrl}
          title="Preview del mapa de la sucursal"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          // Mismo sandbox que `branch-map.tsx`: scripts para el mapa
          // interactivo, mismo origen para sus recursos y popups para los
          // enlaces "abrir en pestaña" del propio mapa.
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          className="mt-2 aspect-video w-full rounded-md border-0"
          data-testid="branch-location-preview"
        />
      )}
      <p className="mt-1 text-xs text-muted-foreground">
        Así se verá el mapa embebido en el catálogo público.
      </p>
    </details>
  );
}
