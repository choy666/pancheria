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
 */
export function useVisibilityPolling(
  callback: () => void,
  intervalMs: number,
  enabled: boolean = true,
  immediate: boolean = true
): void {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

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
  }, [enabled, immediate, intervalMs]);
}
