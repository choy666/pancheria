'use client';

import { useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  getGeolocationErrorMessage,
  isGeolocationPositionError,
  useGeolocationSupport,
} from '@/lib/geolocation';
import {
  buildMapCoordinatesUrl,
  buildMapViewUrl,
  describeLocationInput,
  tryBuildLocationUrl,
} from '@/lib/maps';

type GeoStatus = 'idle' | 'requesting' | 'granted' | 'error';

interface DeliveryLocationFieldProps {
  /**
   * Valor del campo: la URL canónica tras obtener el GPS o el texto que el
   * cliente pegó/tipeó (enlace de mapa o coordenadas `lat,lng`).
   */
  value: string;
  onChange: (value: string) => void;
}

/**
 * Captura obligatoria del pin de entrega en el checkout `delivery`. El GPS
 * es el camino principal; el campo manual queda siempre disponible como
 * fallback (permiso denegado o navegador sin geolocalización).
 */
export function DeliveryLocationField({
  value,
  onChange,
}: DeliveryLocationFieldProps) {
  const isGeolocationSupported = useGeolocationSupport();
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle');
  const [geoError, setGeoError] = useState<string | null>(null);
  // Los errores del campo manual solo se muestran tras el blur (touched).
  const [touched, setTouched] = useState(false);

  const normalized = value.trim() ? tryBuildLocationUrl(value) : null;
  const viewUrl = normalized ? buildMapViewUrl(normalized) : null;
  const inputDescription = describeLocationInput(value);
  const showInvalid = touched && inputDescription.status === 'invalid';

  async function handleRequestLocation() {
    if (
      geoStatus === 'requesting' ||
      typeof navigator === 'undefined' ||
      !navigator.geolocation
    ) {
      return;
    }

    setGeoStatus('requesting');
    setGeoError(null);

    try {
      // Mismas opciones que el botón de ubicación del chat del pedido.
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10_000,
            maximumAge: 60_000,
          });
        }
      );

      const { latitude, longitude } = position.coords;
      onChange(buildMapCoordinatesUrl(latitude, longitude));
      setGeoStatus('granted');
    } catch (err) {
      setGeoStatus('error');
      setGeoError(
        isGeolocationPositionError(err)
          ? getGeolocationErrorMessage(err)
          : 'No se pudo obtener la ubicación.'
      );
    }
  }

  function handleManualChange(text: string) {
    onChange(text);
    // El cliente corrige el pin obtenido por GPS: el estado vuelve a manual.
    if (geoStatus === 'granted') {
      setGeoStatus('idle');
    }
  }

  return (
    <div className="space-y-2" data-testid="delivery-location-field">
      <Label htmlFor="deliveryLocation">Ubicación de entrega</Label>
      <p className="text-xs text-muted-foreground">
        El pin marca el punto exacto donde se entrega el pedido: es lo que usa
        el repartidor para llegar. Si pedís para otra dirección, pegá el
        enlace del mapa o las coordenadas.
      </p>

      {isGeolocationSupported && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleRequestLocation()}
          disabled={geoStatus === 'requesting'}
          data-testid="checkout-delivery-location-button"
        >
          {geoStatus === 'requesting' ? (
            <>
              <Loader2
                className="size-4 animate-spin"
                aria-hidden="true"
                data-testid="delivery-location-spinner"
              />
              Obteniendo ubicación…
            </>
          ) : (
            <>
              <MapPin className="size-4" aria-hidden="true" />
              Usar mi ubicación actual para la entrega
            </>
          )}
        </Button>
      )}

      {geoStatus === 'error' && geoError && (
        <p
          role="alert"
          className="text-sm text-destructive"
          data-testid="delivery-location-geo-error"
        >
          {geoError}
        </p>
      )}

      {geoStatus === 'granted' && (
        <p
          role="status"
          className="inline-flex items-center gap-1 rounded-md bg-emerald-600/15 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400"
          data-testid="delivery-location-granted"
        >
          <MapPin className="size-3" aria-hidden="true" />
          Ubicación obtenida
        </p>
      )}

      <Input
        id="deliveryLocation"
        value={value}
        onChange={(e) => handleManualChange(e.target.value)}
        onBlur={() => setTouched(true)}
        placeholder="o pegá un enlace de mapa / coordenadas"
        aria-invalid={showInvalid || undefined}
        data-testid="delivery-location-input"
      />

      {showInvalid && (
        <p
          role="alert"
          className="text-sm text-destructive"
          data-testid="delivery-location-input-error"
        >
          El enlace o las coordenadas no son válidos.
        </p>
      )}

      {viewUrl && (
        <a
          href={viewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          data-testid="delivery-location-map-link"
        >
          <MapPin className="size-3" aria-hidden="true" />
          Ver en mapa
        </a>
      )}
    </div>
  );
}
