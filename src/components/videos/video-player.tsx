'use client';

import { useRef } from 'react';

interface VideoPlayerProps {
  src: string;
  mimeType?: string;
}

export function VideoPlayer({ src, mimeType }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <video
      ref={videoRef}
      src={src}
      controls
      preload="metadata"
      className="w-full rounded-2xl border border-white/8"
      style={{ maxHeight: '70vh' }}
    >
      {mimeType && (
        <source src={src} type={mimeType} />
      )}
      Tu navegador no soporta la reproducción de videos.
    </video>
  );
}
