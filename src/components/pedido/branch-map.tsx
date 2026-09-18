'use client';

import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { buildMapEmbedUrl } from '@/lib/maps';

interface BranchMapProps {
  location: string;
  branchName: string;
}

/**
 * Ubicación de la sucursal en el catálogo público. Cuando `location` es
 * embebible (coordenadas o URL de embed del proveedor configurado) se muestra
 * un `<details>` "Ver mapa": el `<iframe>` solo se monta al abrirlo, así el
 * proveedor de mapas no se carga sin interacción del cliente (performance y
 * privacidad). Si no es embebible (short links, Waze, otros orígenes), se
 * mantiene el enlace externo clásico.
 */
export function BranchMap({ location, branchName }: BranchMapProps) {
  const [open, setOpen] = useState(false);
  const embedUrl = buildMapEmbedUrl(location);

  if (!embedUrl) {
    return (
      <a
        href={location}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="branch-map-link"
        className="mt-1 inline-block text-primary hover:underline"
      >
        Ver en mapa
      </a>
    );
  }

  return (
    <details
      data-testid="branch-map-details"
      className="mt-1"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="flex cursor-pointer items-center gap-1 text-primary">
        <MapPin className="size-4" aria-hidden="true" />
        Ver mapa
      </summary>
      {open && (
        <iframe
          src={embedUrl}
          title={`Mapa de ${branchName}`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          // El sandbox se limita a lo que requieren los embeds de OSM/Google:
          // scripts para el mapa interactivo, mismo origen para sus recursos
          // y popups para los enlaces "abrir en pestaña" del propio mapa.
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          className="mt-2 aspect-video w-full rounded-md border-0"
          data-testid="branch-map-frame"
        />
      )}
      <a
        href={location}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="branch-map-link"
        className="mt-1 inline-block text-primary hover:underline"
      >
        Abrir en el mapa
      </a>
    </details>
  );
}
