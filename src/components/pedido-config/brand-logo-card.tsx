'use client';

import { useEffect, useState, useTransition } from 'react';
import type { ChangeEvent } from 'react';
import Image from 'next/image';
import { Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { BRAND_LOGO_MAX_BYTES } from '@/config/brand';
import { getBrandLogoPath } from '@/lib/brand-helpers';
import { normalizeBrandLogoFile } from '@/lib/brand-logo-normalize';
import type { BrandConfigState } from '@/app/(panel)/pedido-config/actions';

type LogoAction = (
  prevState: BrandConfigState,
  formData: FormData
) => Promise<BrandConfigState>;

interface BrandLogoCardProps {
  logoUpdatedAt: Date | null;
  uploadAction: LogoAction;
  removeAction: LogoAction;
}

interface PendingLogo {
  file: File;
  url: string;
}

export function BrandLogoCard({
  logoUpdatedAt,
  uploadAction,
  removeAction,
}: BrandLogoCardProps) {
  const [pending, setPending] = useState<PendingLogo | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [message, setMessage] = useState<BrandConfigState>(null);
  const [isUploading, startUpload] = useTransition();
  const [isRemoving, startRemove] = useTransition();

  useEffect(() => {
    return () => {
      if (pending) URL.revokeObjectURL(pending.url);
    };
  }, [pending]);

  const currentSrc = getBrandLogoPath(logoUpdatedAt);
  const shownSrc = pending?.url ?? currentSrc;
  const isBusy = isPreparing || isUploading || isRemoving;

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setInputError(null);
    setMessage(null);
    setIsPreparing(true);
    try {
      const normalized = await normalizeBrandLogoFile(file);
      setPending({ file: normalized, url: URL.createObjectURL(normalized) });
    } catch (error) {
      setInputError(
        error instanceof Error ? error.message : 'No se pudo preparar la imagen.'
      );
    } finally {
      setIsPreparing(false);
    }
  }

  function handleUpload() {
    if (!pending) return;
    const formData = new FormData();
    formData.set('logo', pending.file);
    startUpload(async () => {
      const result = await uploadAction(null, formData);
      setMessage(result);
      if (result?.success) setPending(null);
    });
  }

  function handleRemove() {
    startRemove(async () => {
      setMessage(await removeAction(null, new FormData()));
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logo</CardTitle>
        <CardDescription>
          PNG, JPG o WebP de hasta {BRAND_LOGO_MAX_BYTES / 1024} KB. La imagen
          se reduce a 512 px conservando la proporción. Con fondo transparente
          se ve mejor sobre el pie oscuro.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-24 w-48 items-center justify-center rounded-xl border border-border bg-muted/40 p-3">
            {shownSrc ? (
              <Image
                src={shownSrc}
                alt={pending ? 'Vista previa del nuevo logo' : 'Logo actual de la marca'}
                width={160}
                height={72}
                unoptimized
                className="max-h-full w-auto object-contain"
              />
            ) : (
              <span className="text-sm text-muted-foreground">Sin logo</span>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand-logo-input">Elegir imagen</Label>
            <input
              id="brand-logo-input"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
              disabled={isBusy}
              data-testid="brand-logo-input"
              className="block text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground"
            />
          </div>
        </div>

        {inputError && (
          <p role="alert" className="text-sm text-destructive">
            {inputError}
          </p>
        )}
        {pending && (
          <p className="text-sm text-muted-foreground">
            Listo para guardar ({Math.ceil(pending.file.size / 1024)} KB).
          </p>
        )}
        {message?.error && (
          <p role="alert" className="text-sm text-destructive" data-testid="brand-logo-error">
            {message.error}
          </p>
        )}
        {message?.success && (
          <p role="status" className="text-sm text-green-600" data-testid="brand-logo-success">
            {message.success}
          </p>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          onClick={handleUpload}
          disabled={!pending || isBusy}
          data-testid="brand-logo-save"
          className="w-full sm:w-auto"
        >
          <Upload aria-hidden />
          {isUploading ? 'Guardando...' : 'Guardar logo'}
        </Button>
        {currentSrc && (
          <Button
            type="button"
            variant="outline"
            onClick={handleRemove}
            disabled={isBusy}
            data-testid="brand-logo-remove"
            className="w-full sm:w-auto"
          >
            <Trash2 aria-hidden />
            {isRemoving ? 'Quitando...' : 'Quitar logo'}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
