import { useSyncExternalStore } from 'react';

/**
 * El constructor `GeolocationPositionError` no es confiable para `instanceof`
 * (jsdom no lo define y en algunos navegadores el prototipo no coincide), así
 * que la detección es por forma: un error de geolocalización trae `code`
 * numérico 1–3 (PERMISSION_DENIED / POSITION_UNAVAILABLE / TIMEOUT).
 */
export function isGeolocationPositionError(
  error: unknown
): error is GeolocationPositionError {
  const code = (error as { code?: unknown })?.code;
  return typeof code === 'number' && code >= 1 && code <= 3;
}

/**
 * Traduce un `GeolocationPositionError` a un mensaje para el usuario.
 * Compartida entre el chat del pedido y el checkout: ambos piden la
 * ubicación del cliente para envíos a domicilio.
 */
export function getGeolocationErrorMessage(
  error: GeolocationPositionError
): string {
  // Códigos literales: con la detección por forma no se garantiza que las
  // constantes `PERMISSION_DENIED`/`TIMEOUT` existan en el objeto.
  switch (error.code) {
    case 1: // PERMISSION_DENIED
      return 'No se concedió permiso para acceder a la ubicación.';
    case 2: // POSITION_UNAVAILABLE
      return 'La ubicación no está disponible en este momento.';
    case 3: // TIMEOUT
      return 'Se agotó el tiempo para obtener la ubicación.';
    default:
      return 'No se pudo obtener la ubicación.';
  }
}

// `navigator.geolocation` solo existe en el cliente: leerla durante el render
// diverge del HTML SSR y provocaba hydration mismatch en los botones de
// ubicación. `useSyncExternalStore` con snapshot de servidor = false mantiene
// el primer render del cliente idéntico al del servidor.
function subscribeToNothing() {
  return () => {};
}

function getGeolocationSnapshot(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

function getGeolocationServerSnapshot(): boolean {
  return false;
}

/** `true` cuando el navegador expone `navigator.geolocation` (solo cliente). */
export function useGeolocationSupport(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    getGeolocationSnapshot,
    getGeolocationServerSnapshot
  );
}
