'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  getProductImageAllowedMimeTypes,
  getProductImageMaxSizeBytes,
} from '@/config/product-images';
import { formatMoney } from '@/lib/money';
import type { ProductImageValue } from '@/lib/product-image-upload-client';
import { ProductImageFallback } from './product-card-image';

interface ProductImageUploaderProps {
  value?: ProductImageValue;
  onChange: (value: ProductImageValue) => void;
  error: string | null;
  onErrorChange: (error: string | null) => void;
  productName: string;
  productPrice: number;
}

interface PreviewIssue {
  url: string;
  message: string;
}

const CATALOG_IMAGE_RATIO = 16 / 9;
const RATIO_TOLERANCE = 0.1;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

function previewUrlOf(value: ProductImageValue): string | null {
  switch (value.source) {
    case 'upload':
      return value.previewUrl;
    case 'stored':
      return value.imageUrl;
    default:
      return null;
  }
}

export function ProductImageUploader({
  value = { source: 'none' },
  onChange,
  error,
  onErrorChange,
  productName,
  productPrice,
}: ProductImageUploaderProps) {
  const [previewIssue, setPreviewIssue] = useState<PreviewIssue | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  const previewUrl = previewUrlOf(value);
  const issueMessage =
    previewIssue && previewIssue.url === previewUrl ? previewIssue.message : null;
  const allowedTypes = getProductImageAllowedMimeTypes();
  const maxBytes = getProductImageMaxSizeBytes();

  function clearFileInput() {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    if (!selected) return;

    const fileError = validateFile(selected);
    if (fileError) {
      onErrorChange(fileError);
      clearFileInput();
      return;
    }

    onErrorChange(null);
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }

    const nextPreviewUrl = URL.createObjectURL(selected);
    previewUrlRef.current = nextPreviewUrl;
    onChange({ source: 'upload', file: selected, previewUrl: nextPreviewUrl });
  }

  function handleRemove() {
    if (value.source === 'upload' && value.previewUrl) {
      URL.revokeObjectURL(value.previewUrl);
    }
    previewUrlRef.current = null;
    onErrorChange(null);
    onChange({ source: 'none' });
    clearFileInput();
  }

  function handlePreviewError(url: string) {
    if (value.source === 'upload') {
      onErrorChange('No se pudo leer el archivo seleccionado. Elegí otra imagen.');
      return;
    }
    setPreviewIssue({
      url,
      message: 'No se pudo cargar la imagen guardada. Podés reemplazarla o quitarla.',
    });
  }

  function handlePreviewLoad(event: React.SyntheticEvent<HTMLImageElement>, url: string) {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (
      naturalHeight > 0 &&
      Math.abs(naturalWidth / naturalHeight - CATALOG_IMAGE_RATIO) > RATIO_TOLERANCE
    ) {
      setPreviewIssue({
        url,
        message: 'La proporción no es 16:9: en el catálogo la imagen se verá con franjas.',
      });
    }
  }

  return (
    <div data-tour="product-image-uploader" className="space-y-4">
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
        {error && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-destructive/15 p-3 text-sm text-destructive"
          >
            <p>{error}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onErrorChange(null)}
            >
              Descartar
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="overflow-hidden rounded-2xl border border-white/8 bg-card">
          <div className="relative aspect-video w-full overflow-hidden bg-linear-to-br from-brand-red to-brand-mustard">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Vista previa de la imagen"
                className="absolute inset-0 h-full w-full object-contain"
                onLoad={(event) => handlePreviewLoad(event, previewUrl)}
                onError={() => handlePreviewError(previewUrl)}
              />
            ) : (
              <ProductImageFallback productName={productName} />
            )}
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="font-heading text-xl leading-tight">
                {productName.trim() || 'Sin nombre'}
              </p>
              <p className="font-heading text-2xl text-brand-red">
                {formatMoney(productPrice)}
              </p>
            </div>
            {previewUrl && (
              <Button type="button" variant="outline" size="sm" onClick={handleRemove}>
                Quitar imagen
              </Button>
            )}
          </div>
        </div>
        {issueMessage && (
          <p role="status" className="text-sm text-muted-foreground">
            {issueMessage}
          </p>
        )}
        <p className="text-xs text-muted-foreground">Así se verá en el catálogo.</p>
      </div>
    </div>
  );
}
