'use client';

import { useActionState, useRef, useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { routes } from '@/config/routes';
import {
  getVideoMaxSizeMb,
  getVideoAllowedMimeTypes,
} from '@/config/videos';
import type { VideoState } from '@/app/(panel)/videos/actions';
import type { PrepareUploadState } from '@/app/(panel)/videos/actions';
import type { UploadInstructions } from '@/lib/storage';

interface VideoFormProps {
  prepareUploadAction: (
    _prevState: PrepareUploadState,
    formData: FormData
  ) => Promise<PrepareUploadState>;
  createVideoAction: (
    _prevState: VideoState,
    formData: FormData
  ) => Promise<VideoState>;
}

const initialState: VideoState = null;

export function VideoForm({
  prepareUploadAction,
  createVideoAction,
}: VideoFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    createVideoAction,
    initialState
  );
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasSubmittedRef = useRef(false);

  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState('');
  const [mimeType, setMimeType] = useState('');
  const [size, setSize] = useState(0);

  useEffect(() => {
    if (
      hasSubmittedRef.current &&
      !isPending &&
      state === null &&
      formRef.current
    ) {
      hasSubmittedRef.current = false;
      router.push(routes.videos);
    }
  }, [state, isPending, router]);

  const validateFile = useCallback((selected: File): string | null => {
    const allowed = getVideoAllowedMimeTypes();
    if (!allowed.includes(selected.type)) {
      return `Tipo no permitido. Permitidos: ${allowed.join(', ')}.`;
    }

    const maxBytes = getVideoMaxSizeMb() * 1024 * 1024;
    if (selected.size > maxBytes) {
      return `El archivo supera el límite de ${getVideoMaxSizeMb()} MB.`;
    }

    return null;
  }, []);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selected = event.target.files?.[0] ?? null;
      setFile(selected);
      setFileName(selected?.name ?? '');
      setFileUrl('');
      setMimeType('');
      setSize(0);
      setUploadError(null);

      if (selected) {
        const error = validateFile(selected);
        if (error) {
          setUploadError(error);
          setFile(null);
          setFileName('');
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      }
    },
    [validateFile]
  );

  const doUpload = useCallback(async () => {
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('name', file.name);
      formData.append('type', file.type);
      formData.append('size', String(file.size));

      const result = await prepareUploadAction(null, formData);

      if (result && 'error' in result) {
        setUploadError(result.error);
        setUploading(false);
        return;
      }

      if (!result || !('data' in result)) {
        setUploadError('No se pudieron obtener las instrucciones de subida.');
        setUploading(false);
        return;
      }

      const instructions = result.data as UploadInstructions;
      const publicUrl = await uploadToProvider(file, instructions);

      setFileUrl(publicUrl);
      setMimeType(file.type);
      setSize(file.size);
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : 'Error al subir el archivo. Intentá de nuevo.'
      );
    } finally {
      setUploading(false);
    }
  }, [file, prepareUploadAction]);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!fileUrl) {
        setUploadError('Primero debés subir un archivo de video.');
        return;
      }

      hasSubmittedRef.current = true;
      const formData = new FormData(event.currentTarget);
      formData.append('fileUrl', fileUrl);
      formData.append('mimeType', mimeType);
      formData.append('size', String(size));
      formData.append('isActive', 'true');
      formAction(formData);
    },
    [fileUrl, mimeType, size, formAction]
  );

  const maxSizeMb = getVideoMaxSizeMb();
  const allowedTypes = getVideoAllowedMimeTypes();

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="max-w-md space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="title">Título</Label>
        <Input
          id="title"
          name="title"
          type="text"
          required
          maxLength={255}
          placeholder="Ej: Promoción de verano"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descripción</Label>
        <Textarea
          id="description"
          name="description"
          rows={4}
          maxLength={1000}
          placeholder="Descripción opcional del video"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="file">Archivo de video</Label>
        <Input
          id="file"
          ref={fileInputRef}
          type="file"
          accept={allowedTypes.join(',')}
          onChange={handleFileChange}
          disabled={uploading || isPending}
        />
        <p className="text-xs text-muted-foreground">
          Tipos permitidos: {allowedTypes.join(', ')}. Tamaño máximo:{' '}
          {maxSizeMb} MB.
        </p>
      </div>

      {file && !fileUrl && (
        <Button type="button" onClick={doUpload} disabled={uploading}>
          {uploading ? 'Subiendo...' : 'Subir archivo'}
        </Button>
      )}

      {fileUrl && (
        <p className="text-sm text-green-600">
          Archivo listo: {fileName} ({(size / (1024 * 1024)).toFixed(1)} MB)
        </p>
      )}

      {uploadError && (
        <p className="text-sm text-destructive" role="alert">
          {uploadError}
        </p>
      )}

      {state?.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={!fileUrl || isPending || uploading}>
          {isPending ? 'Guardando...' : 'Guardar video'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(routes.videos)}
          disabled={isPending || uploading}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}

async function uploadToProvider(
  file: File,
  instructions: UploadInstructions
): Promise<string> {
  if (instructions.token) {
    const client = await import('@vercel/blob/client');
    const blob = await client.put(instructions.key, file, {
      access: 'public',
      token: instructions.token,
      multipart: true,
    });
    return blob.url;
  }

  if (instructions.method === 'PUT') {
    const response = await fetch(instructions.url, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Error al subir el archivo: ${response.status} ${response.statusText}`
      );
    }

    return instructions.publicUrl || instructions.url;
  }

  const formData = new FormData();
  if (instructions.fields) {
    Object.entries(instructions.fields).forEach(([key, value]) => {
      formData.append(key, value);
    });
  }
  formData.append('file', file);

  const response = await fetch(instructions.url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(
      `Error al subir el archivo: ${response.status} ${response.statusText}`
    );
  }

  if (instructions.publicUrl) {
    return instructions.publicUrl;
  }

  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    const data = (await response.json()) as { url?: string };
    if (data.url) return data.url;
  }

  const location = response.headers.get('Location');
  if (location) {
    return location;
  }

  throw new Error('No se pudo obtener la URL pública del archivo.');
}
