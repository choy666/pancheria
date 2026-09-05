'use client';

import { useEffect, useRef } from 'react';

/**
 * Inicia un intervalo que ejecuta `callback` mientras la pestaña está visible.
 * Pausa el intervalo cuando la pestaña se oculta y lo reanuda (con una
 * llamada inmediata) al volver a ser visible.
 *
 * @param callback - Función a ejecutar en cada ciclo y al volver a visible.
 * @param intervalMs - Tiempo entre llamadas en milisegundos.
 * @param enabled - Si es `false` no inicia el intervalo ni escucha eventos.
 * @param immediate - Si es `true` llama a `callback` inmediatamente al montar
 *   cuando la pestaña ya está visible. Por defecto `true`.
 * @param onResume - Función opcional que se ejecuta cuando la pestaña vuelve
 *   a ser visible, justo antes de `callback`. Útil para resetear estado
 *   interno (p. ej. backoff de reintentos) al reanudar el polling.
 */
export function useVisibilityPolling(
  callback: () => void,
  intervalMs: number,
  enabled: boolean = true,
  immediate: boolean = true,
  onResume?: () => void
): void {
  const savedCallback = useRef(callback);
  const savedOnResume = useRef(onResume);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    savedOnResume.current = onResume;
  }, [onResume]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const isDocumentDefined = typeof document !== 'undefined';
    let intervalId: ReturnType<typeof setInterval> | null = null;

    function startInterval() {
      intervalId = setInterval(() => {
        savedCallback.current();
      }, intervalMs);
    }

    function stopInterval() {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }

    function handleVisibilityChange() {
      if (isDocumentDefined && document.hidden) {
        stopInterval();
        return;
      }

      stopInterval();
      savedOnResume.current?.();
      savedCallback.current();
      startInterval();
    }

    if (!isDocumentDefined || !document.hidden) {
      if (immediate) {
        savedCallback.current();
      }
      startInterval();
    }

    if (isDocumentDefined) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      stopInterval();
      if (isDocumentDefined) {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
    // `onResume` se lee desde una ref para no reiniciar el intervalo
    // cuando cambie la referencia de la función.
  }, [enabled, immediate, intervalMs]);
}
