'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  getProductImageAllowedMimeTypes,
  getProductImageMaxSizeBytes,
  getProductImageUrlMaxLength,
} from '@/config/product-images';
import { ImageOff } from 'lucide-react';

export type ProductImageValue =
  | { source: 'none' }
  | { source: 'upload'; file: File; previewUrl: string }
  | { source: 'url'; imageUrl: string }
  | {
      source: 'stored';
      imageUrl: string;
      imageKey: string | null;
      imageMimeType: string | null;
      imageSize: number | null;
    };

interface ProductImageUploaderProps {
  value?: ProductImageValue;
  onChange: (value: ProductImageValue) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isValidClientUrl(url: string): string | null {
  if (url.length > getProductImageUrlMaxLength()) {
    return `La URL no puede superar los ${getProductImageUrlMaxLength()} caracteres.`;
  }

  if (!url.startsWith('https://')) {
    return 'La URL debe comenzar con https://.';
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      return 'La URL debe usar el protocolo HTTPS.';
    }
  } catch {
    return 'La URL no es válida.';
  }

  return null;
}

function validateFile(file: File): string | null {
  const allowedTypes = getProductImageAllowedMimeTypes();
  if (!allowedTypes.includes(file.type)) {
    return `Tipo no permitido. Permitidos: ${allowedTypes.join(', ')}.`;
  }

  const maxBytes = getProductImageMaxSizeBytes();
  if (file.size > maxBytes) {
    return `El archivo supera el límite de ${formatSize(maxBytes)}.`;
  }

  return null;
}

export function ProductImageUploader({
  value = { source: 'none' },
  onChange,
}: ProductImageUploaderProps) {
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  const mode: 'upload' | 'url' =
    value.source === 'url' || value.source === 'stored' ? 'url' : 'upload';

  const urlInputValue =
    value.source === 'url' || value.source === 'stored'
      ? value.imageUrl
      : '';

  const urlError =
    value.source === 'url' ? isValidClientUrl(value.imageUrl) : null;

  function handleModeChange(nextMode: 'upload' | 'url') {
    setFileError(null);

    if (nextMode === 'upload') {
      onChange({ source: 'none' });
    } else {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onChange({ source: 'none' });
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setFileError(null);

    if (!selected) {
      onChange({ source: 'none' });
      return;
    }

    const error = validateFile(selected);
    if (error) {
      setFileError(error);
      onChange({ source: 'none' });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }

    const previewUrl = URL.createObjectURL(selected);
    previewUrlRef.current = previewUrl;
    onChange({ source: 'upload', file: selected, previewUrl });
  }

  function handleUrlChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextUrl = event.target.value.trim();
    onChange({ source: 'url', imageUrl: nextUrl });
  }

  function handleRemove() {
    if (value.source === 'upload' && value.previewUrl) {
      URL.revokeObjectURL(value.previewUrl);
    }
    previewUrlRef.current = null;
    onChange({ source: 'none' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  const previewUrl =
    value.source === 'upload'
      ? value.previewUrl
      : value.source === 'url' || value.source === 'stored'
      ? value.imageUrl
      : null;

  const allowedTypes = getProductImageAllowedMimeTypes();
  const maxBytes = getProductImageMaxSizeBytes();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={mode === 'upload' ? 'default' : 'outline'}
          onClick={() => handleModeChange('upload')}
        >
          Subir imagen
        </Button>
        <Button
          type="button"
          variant={mode === 'url' ? 'default' : 'outline'}
          onClick={() => handleModeChange('url')}
        >
          Usar URL
        </Button>
      </div>

      {mode === 'upload' && (
        <div className="space-y-2">
          <Label htmlFor="product-image-file">Archivo de imagen</Label>
          <Input
            id="product-image-file"
            ref={fileInputRef}
            type="file"
            accept={allowedTypes.join(',')}
            onChange={handleFileChange}
          />
          <p className="text-xs text-muted-foreground">
            Tipos permitidos: {allowedTypes.join(', ')}. Tamaño máximo:{' '}
            {formatSize(maxBytes)}.
          </p>
          {fileError && (
            <p className="text-sm text-destructive" role="alert">
              {fileError}
            </p>
          )}
        </div>
      )}

      {mode === 'url' && (
        <div className="space-y-2">
          <Label htmlFor="product-image-url">URL de la imagen</Label>
          <Input
            id="product-image-url"
            type="url"
            value={urlInputValue}
            onChange={handleUrlChange}
            placeholder="https://example.com/imagen.jpg"
          />
          <p className="text-xs text-muted-foreground">
            Debe ser una URL pública HTTPS.
          </p>
          {urlError && (
            <p className="text-sm text-destructive" role="alert">
              {urlError}
            </p>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-white/8 bg-card p-4">
        {previewUrl ? (
          <div className="space-y-3">
            <div className="relative aspect-video w-full overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Vista previa de la imagen"
                className="h-full w-full object-contain"
                onError={() => {
                  if (value.source === 'url') {
                    onChange({ source: 'none' });
                  }
                }}
              />
            </div>
            {value.source === 'stored' && value.imageSize && (
              <p className="text-xs text-muted-foreground">
                {formatSize(value.imageSize)} · {value.imageMimeType ?? 'desconocido'}
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRemove}
            >
              Quitar imagen
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
            <ImageOff className="h-10 w-10" />
            <p className="text-sm">Sin imagen ilustrativa</p>
          </div>
        )}
      </div>
    </div>
  );
}
