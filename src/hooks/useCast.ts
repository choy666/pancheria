'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getCastReceiverAppId,
  getCastSenderSdkUrl,
} from '@/config/videos';

interface CastWindow extends Window {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cast?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chrome?: any;
}

interface UseCastResult {
  isAvailable: boolean;
  isCasting: boolean;
  error: string | null;
  playMedia: (src: string, mimeType?: string) => Promise<void>;
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

    const context = win.cast.framework.CastContext.getInstance();
    const autoJoinPolicy =
      win.chrome?.cast?.AutoJoinPolicy?.ORIGIN_SCOPED ?? 'origin_scoped';

    context.setOptions({
      receiverApplicationId: getCastReceiverAppId(),
      autoJoinPolicy,
    });

    context.addEventListener(
      win.cast.framework.CastContextEventType.CAST_STATE_CHANGED,
      (event: { castState: string }) => {
        if (!isMountedRef.current) return;
        setIsAvailable(
          event.castState === win.cast.framework.CastState.AVAILABLE
        );
      }
    );

    context.addEventListener(
      win.cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
      (event: { sessionState: string }) => {
        if (!isMountedRef.current) return;
        setIsCasting(
          event.sessionState === win.cast.framework.SessionState.CONNECTED
        );
      }
    );

    const castState = context.getCastState();
    setIsAvailable(castState === win.cast.framework.CastState.AVAILABLE);
  }, []);

  const loadScript = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const win = window as unknown as CastWindow;
    if (win.cast?.framework) {
      initContext(win);
      return;
    }

    const sdkUrl = getCastSenderSdkUrl();
    const existing = Array.from(document.scripts).find(
      (script) => script.src === sdkUrl
    );
    if (existing) {
      return;
    }

    const script = document.createElement('script');
    script.src = getCastSenderSdkUrl();
    script.async = true;
    script.onload = () => {
      if (!isMountedRef.current) return;
      initContext(window as unknown as CastWindow);
    };
    script.onerror = () => {
      if (!isMountedRef.current) return;
      setError('No se pudo cargar el SDK de Google Cast.');
    };
    document.head.appendChild(script);
  }, [initContext]);

  useEffect(() => {
    isMountedRef.current = true;
    queueMicrotask(() => void loadScript());

    return () => {
      isMountedRef.current = false;
    };
  }, [loadScript]);

  const playMedia = useCallback(
    async (src: string, mimeType = 'video/mp4') => {
      const win = window as unknown as CastWindow;
      if (!win.cast?.framework) {
        setError('El SDK de Google Cast no está cargado.');
        return;
      }

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

      const mediaInfo = new win.chrome.cast.media.MediaInfo(src, mimeType);
      const request = new win.chrome.cast.media.LoadRequest(mediaInfo);

      try {
        await currentSession.loadMedia(request);
        setError(null);
      } catch {
        setError('No se pudo reproducir el video en el dispositivo Cast.');
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
