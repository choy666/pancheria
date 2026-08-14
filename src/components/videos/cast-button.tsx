'use client';

import { Button } from '@/components/ui/button';
import { Cast } from 'lucide-react';
import { useCast } from '@/hooks/useCast';

interface CastButtonProps {
  src: string;
  mimeType?: string;
}

export function CastButton({ src, mimeType }: CastButtonProps) {
  const { isAvailable, isCasting, playMedia, error } = useCast();

  async function handleClick() {
    await playMedia(src, mimeType);
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={!isAvailable}
        title={
          isAvailable
            ? 'Enviar a dispositivo Cast'
            : 'No hay dispositivos Cast disponibles'
        }
      >
        <Cast className="size-4" />
        {isCasting ? 'Enviando...' : 'Enviar a Cast'}
      </Button>

      {!isAvailable && (
        <p className="text-xs text-muted-foreground">
          No se detectaron dispositivos Cast.
        </p>
      )}

      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
