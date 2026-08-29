'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getCastReceiverAppId,
  getCastSenderSdkUrl,
} from '@/config/videos';

type CastApiAvailableCallback = (isAvailable: boolean) => void;

interface CastWindow extends Window {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cast?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chrome?: any;
  __onGCastApiAvailable?: CastApiAvailableCallback;
  __pancheriaCastCallbacks?: CastApiAvailableCallback[];
}

interface UseCastResult {
  isAvailable: boolean;
  isCasting: boolean;
  error: string | null;
  playMedia: (src: string, mimeType?: string) => Promise<void>;
}

function getCastWindow(): CastWindow | null {
  if (typeof window === 'undefined') return null;
  return window as unknown as CastWindow;
}

function getCastCallbacks(win: CastWindow): CastApiAvailableCallback[] {
  if (!win.__pancheriaCastCallbacks) {
    win.__pancheriaCastCallbacks = [];
  }
  return win.__pancheriaCastCallbacks;
}

function notifyCastCallbacks(win: CastWindow, isAvailable: boolean) {
  for (const callback of getCastCallbacks(win)) {
    try {
      callback(isAvailable);
    } catch {
      // Ignorar errores de callbacks externos.
    }
  }
}

function globalCastApiHandler(isAvailable: boolean) {
  const win = getCastWindow();
  if (!win) return;
  notifyCastCallbacks(win, isAvailable);
}

function ensureGlobalCastApiHandler(win: CastWindow) {
  if (win.__onGCastApiAvailable === globalCastApiHandler) return;

  const prevHandler = win.__onGCastApiAvailable;
  win.__onGCastApiAvailable = (isAvailable) => {
    if (typeof prevHandler === 'function') {
      try {
        prevHandler(isAvailable);
      } catch {
        // Ignorar errores de handlers previos.
      }
    }
    globalCastApiHandler(isAvailable);
  };
}

function isCastScriptInDom(url: string): boolean {
  return Array.from(document.scripts).some((script) => script.src === url);
}

function insertCastScript(url: string, onError: () => void) {
  const script = document.createElement('script');
  script.src = url;
  script.async = true;
  script.onerror = onError;
  document.head.appendChild(script);
}

export function useCast(): UseCastResult {
  const isMountedRef = useRef(true);
  const [isAvailable, setIsAvailable] = useState(false);
  const [isCasting, setIsCasting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initContext = useCallback((win: CastWindow) => {
    if (!win.cast?.framework) {
      return;
    }

    try {
      const context = win.cast.framework.CastContext.getInstance();
      const autoJoinPolicy =
        win.chrome?.cast?.AutoJoinPolicy?.ORIGIN_SCOPED ?? 'origin_scoped';

      context.setOptions({
        receiverApplicationId: getCastReceiverAppId(),
        autoJoinPolicy,
      });

      const handleCastStateChanged = (event: { castState: string }) => {
        if (!isMountedRef.current) return;
        setIsAvailable(
          event.castState !== win.cast.framework.CastState.NO_DEVICES_AVAILABLE
        );
      };

      const handleSessionStateChanged = (event: { sessionState: string }) => {
        if (!isMountedRef.current) return;
        const activeSessionStates = [
          win.cast.framework.SessionState.SESSION_STARTED,
          win.cast.framework.SessionState.SESSION_RESUMED,
        ];
        setIsCasting(activeSessionStates.includes(event.sessionState));
      };

      context.addEventListener(
        win.cast.framework.CastContextEventType.CAST_STATE_CHANGED,
        handleCastStateChanged
      );

      context.addEventListener(
        win.cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
        handleSessionStateChanged
      );

      const castState = context.getCastState();
      setIsAvailable(
        castState !== win.cast.framework.CastState.NO_DEVICES_AVAILABLE
      );
      setError(null);
    } catch {
      if (isMountedRef.current) {
        setError('No se pudo inicializar el contexto de Google Cast.');
      }
    }
  }, []);

  const onApiAvailable: CastApiAvailableCallback = useCallback(
    (available) => {
      if (!isMountedRef.current) return;
      if (available) {
        const win = getCastWindow();
        if (win) initContext(win);
      } else {
        setError('Google Cast no está disponible en este dispositivo.');
      }
    },
    [initContext]
  );

  useEffect(() => {
    isMountedRef.current = true;
    const win = getCastWindow();
    if (!win) return;

    const load = () => {
      if (win.cast?.framework) {
        initContext(win);
        return;
      }

      ensureGlobalCastApiHandler(win);

      const callbacks = getCastCallbacks(win);
      if (!callbacks.includes(onApiAvailable)) {
        callbacks.push(onApiAvailable);
      }

      const sdkUrl = getCastSenderSdkUrl();
      if (isCastScriptInDom(sdkUrl)) {
        return;
      }

      insertCastScript(sdkUrl, () => {
        if (!isMountedRef.current) return;
        setError('No se pudo cargar el SDK de Google Cast.');
      });
    };

    queueMicrotask(() => void load());

    return () => {
      isMountedRef.current = false;
      const win = getCastWindow();
      if (!win) return;
      const callbacks = getCastCallbacks(win);
      const index = callbacks.indexOf(onApiAvailable);
      if (index >= 0) callbacks.splice(index, 1);
    };
  }, [initContext, onApiAvailable]);

  const playMedia = useCallback(
    async (src: string, mimeType = 'video/mp4') => {
      const win = getCastWindow();
      if (!win?.cast?.framework) {
        setError('El SDK de Google Cast no está cargado.');
        return;
      }

      try {
        const context = win.cast.framework.CastContext.getInstance();
        const session = context.getCurrentSession();

        if (!session) {
          try {
            await context.requestSession();
          } catch {
            setError('No se pudo conectar con un dispositivo Cast.');
            return;
          }
        }

        const currentSession = context.getCurrentSession();
        if (!currentSession) {
          setError('No hay una sesión Cast activa.');
          return;
        }

        if (!win.chrome?.cast?.media) {
          setError('El API de medios de Cast no está disponible.');
          return;
        }

        const mediaInfo = new win.chrome.cast.media.MediaInfo(src, mimeType);
        const request = new win.chrome.cast.media.LoadRequest(mediaInfo);

        try {
          await currentSession.loadMedia(request);
          setError(null);
        } catch {
          setError('No se pudo reproducir el video en el dispositivo Cast.');
        }
      } catch {
        setError('No se pudo interactuar con Google Cast.');
      }
    },
    []
  );

  return {
    isAvailable,
    isCasting,
    error,
    playMedia,
  };
}
