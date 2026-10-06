'use client';

import { MapPin } from 'lucide-react';
import { buildMapEmbedUrl, buildMapViewUrl } from '@/lib/maps';

interface BranchMapProps {
  location: string;
  branchName: string;
}

/**
 * Ubicación de la sucursal en el catálogo público, visible a primera vista:
 * cuando `location` es embebible (coordenadas, URL de mapa con coordenadas o
 * URL de embed de un proveedor soportado) el `<iframe>` se renderiza de
 * inmediato con `loading="lazy"` — el navegador difiere la carga hasta que
 * el mapa se acerca al viewport, así no bloquea la página ni exige
 * interacción del cliente. Si no es embebible (short links, Waze, otros
 * orígenes), se mantiene el enlace externo clásico.
 *
 * El enlace "Abrir en el mapa" usa `buildMapViewUrl`: las URLs de embed
 * (`/maps/embed?pb=…`, `output=embed`) solo funcionan dentro de un iframe y
 * abiertas en una pestaña muestran el error "The Google Maps Embed API must
 * be used in an iframe"; la helper las traduce a la página de mapa
 * equivalente.
 */
export function BranchMap({ location, branchName }: BranchMapProps) {
  const embedUrl = buildMapEmbedUrl(location);
  const viewUrl = buildMapViewUrl(location);

  if (!embedUrl) {
    return (
      <a
        href={viewUrl ?? location}
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
    <div className="mt-2" data-testid="branch-map">
      <iframe
        src={embedUrl}
        title={`Mapa de ${branchName}`}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        // El sandbox se limita a lo que requieren los embeds de OSM/Google:
        // scripts para el mapa interactivo, mismo origen para sus recursos
        // y popups para los enlaces "abrir en pestaña" del propio mapa.
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        className="aspect-video w-full rounded-md border-0"
        data-testid="branch-map-frame"
      />
      {viewUrl && (
        <a
          href={viewUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="branch-map-link"
          className="mt-1 inline-flex items-center gap-1 text-primary hover:underline"
        >
          <MapPin className="size-4" aria-hidden="true" />
          Abrir en el mapa
        </a>
      )}
    </div>
  );
}
