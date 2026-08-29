'use client';

import { useRef, useState } from 'react';

interface VideoPlayerProps {
  src: string;
  mimeType?: string;
}

export function VideoPlayer({ src, mimeType }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <video
        ref={videoRef}
        controls
        preload="metadata"
        className="w-full rounded-2xl border border-white/8"
        style={{ maxHeight: '70vh' }}
        onError={() =>
          setError('No se pudo reproducir el video. Verificá la URL o el formato.')
        }
      >
        <source src={src} type={mimeType ?? guessMimeTypeFromUrl(src)} />
        Tu navegador no soporta la reproducción de videos.
      </video>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function guessMimeTypeFromUrl(url: string): string {
  const extension = url.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'webm':
      return 'video/webm';
    case 'ogg':
    case 'ogv':
      return 'video/ogg';
    case 'mp4':
    default:
      return 'video/mp4';
  }
}
