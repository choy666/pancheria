'use client';

import { useEffect, useRef, useState } from 'react';
import { getPantallaVideoMaxMs } from '@/config/pantalla';
import type { PantallaVideo } from '@/lib/pantalla-playlist';

interface PantallaVideoSceneProps {
  video: PantallaVideo;
  /** Avanza la playlist: se llama al terminar, al fallar o al agotar el watchdog. */
  onDone: () => void;
}

/**
 * Escena de video: reproduce el archivo a pantalla completa en silencio
 * (`muted` habilita autoplay en cualquier navegador/kiosk) y avanza al
 * terminar. Un watchdog cubre streams rotos que nunca disparan `ended` ni
 * `error`: sin metadata en `PANTALLA_VIDEO_MAX_MS` se salta la escena, y con
 * metadata conocida se acota a duración + 5 s.
 */
export function PantallaVideoScene({ video, onDone }: PantallaVideoSceneProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [durationSec, setDurationSec] = useState<number | null>(null);

  useEffect(() => {
    const watchdogMs =
      durationSec !== null && Number.isFinite(durationSec)
        ? durationSec * 1000 + 5_000
        : getPantallaVideoMaxMs();
    const id = setTimeout(onDone, watchdogMs);
    return () => clearTimeout(id);
  }, [durationSec, onDone]);

  useEffect(() => {
    // autoplay + muted deberían bastar; el play() explícito cubre kiosks que
    // ignoran el atributo. Si el navegador bloquea la reproducción, la escena
    // se salta en vez de quedar congelada en el primer frame.
    videoRef.current?.play().catch(() => onDone());
  }, [onDone]);

  return (
    <div
      data-testid="pantalla-scene-video"
      className="relative flex h-full w-full items-center justify-center bg-black"
    >
      <video
        ref={videoRef}
        src={video.fileUrl}
        muted
        playsInline
        autoPlay
        preload="auto"
        className="h-full w-full object-contain"
        onLoadedMetadata={(event) => setDurationSec(event.currentTarget.duration)}
        onEnded={onDone}
        onError={onDone}
        aria-label={video.title}
      />
    </div>
  );
}
