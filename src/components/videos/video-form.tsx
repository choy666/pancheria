'use client';

import {
  useActionState,
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { routes } from '@/config/routes';
import {
  getVideoMaxSizeMb,
  getVideoAllowedMimeTypes,
} from '@/config/videos';
import { getDefaultTimeoutMs } from '@/lib/fetch';
import { Upload, FileVideo, X, AlertCircle, CheckCircle2, Video } from 'lucide-react';
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
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasSubmittedRef = useRef(false);

  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileInputKey, setFileInputKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState('');
  const [mimeType, setMimeType] = useState('');
  const [size, setSize] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);

  const previewUrl = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

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

  const resetFileInput = useCallback(() => {
    setFile(null);
    setFileName('');
    setFileUrl('');
    setMimeType('');
    setSize(0);
    setProgress(null);
    setFileInputKey((k) => k + 1);
  }, []);

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

  const handleSelectedFile = useCallback(
    (selected: File | null) => {
      setUploadError(null);
      setFileUrl('');
      setMimeType('');
      setSize(0);
      setProgress(null);

      if (!selected) {
        setFile(null);
        setFileName('');
        return;
      }

      setFile(selected);
      setFileName(selected.name);

      const error = validateFile(selected);
      if (error) {
        setUploadError(error);
        resetFileInput();
      }
    },
    [validateFile, resetFileInput]
  );

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selected = event.target.files?.[0] ?? null;
      handleSelectedFile(selected);
    },
    [handleSelectedFile]
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragOver(false);
      const selected = event.dataTransfer.files?.[0] ?? null;
      handleSelectedFile(selected);
    },
    [handleSelectedFile]
  );

  const doUpload = useCallback(async () => {
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    setProgress(null);
    abortControllerRef.current = new AbortController();

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
      const publicUrl = await uploadToProvider(
        file,
        instructions,
        abortControllerRef.current.signal,
        setProgress
      );

      setFileUrl(publicUrl);
      setMimeType(file.type);
      setSize(file.size);
      setProgress(100);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setUploadError('La subida fue cancelada.');
      } else {
        setUploadError(
          error instanceof Error
            ? error.message
            : 'Error al subir el archivo. Intentá de nuevo.'
        );
      }
      setProgress(null);
    } finally {
      setUploading(false);
      abortControllerRef.current = null;
    }
  }, [file, prepareUploadAction]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (!fileUrl) {
      event.preventDefault();
      setUploadError('Primero debés subir un archivo de video.');
    } else {
      hasSubmittedRef.current = true;
    }
  }

  const maxSizeMb = getVideoMaxSizeMb();
  const allowedTypes = getVideoAllowedMimeTypes();

  const formatFileSize = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={handleSubmit}
      className="mx-auto max-w-2xl space-y-6"
    >
      <input type="hidden" name="fileUrl" value={fileUrl} />
      <input type="hidden" name="mimeType" value={mimeType} />
      <input type="hidden" name="size" value={size} />
      <input type="hidden" name="isActive" value="true" />

      <Card>
        <CardHeader>
          <CardTitle>Nuevo video</CardTitle>
          <CardDescription>
            Completá los datos, seleccioná el archivo y subilo antes de guardar.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
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

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                name="description"
                rows={3}
                maxLength={1000}
                placeholder="Descripción opcional del video"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="video-file-input">Archivo de video</Label>
            <div
              key={fileInputKey}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={[
                'relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 transition-colors',
                'bg-muted/30 hover:bg-muted/50',
                isDragOver
                  ? 'border-primary bg-primary/5'
                  : 'border-border',
                file ? 'border-solid' : '',
              ].join(' ')}
              onClick={() =>
                document.getElementById('video-file-input')?.click()
              }
            >
              {file ? (
                <>
                  <FileVideo className="h-10 w-10 text-muted-foreground" />
                  <div className="text-center">
                    <p className="font-medium">{fileName}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(file.size)} MB · {file.type}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      resetFileInput();
                    }}
                    disabled={uploading || isPending}
                  >
                    <X className="mr-1 h-4 w-4" />
                    Cambiar archivo
                  </Button>
                </>
              ) : (
                <>
                  <Upload className="h-10 w-10 text-muted-foreground" />
                  <div className="text-center">
                    <p className="font-medium">Arrastrá un video o hacé clic para seleccionar</p>
                    <p className="text-sm text-muted-foreground">
                      Tipos permitidos: {allowedTypes.join(', ')} · Tamaño máximo: {maxSizeMb} MB
                    </p>
                  </div>
                </>
              )}
              <input
                id="video-file-input"
                type="file"
                accept={allowedTypes.join(',')}
                onChange={handleFileChange}
                disabled={uploading || isPending}
                className="sr-only"
              />
            </div>
          </div>

          {previewUrl && !fileUrl && (
            <div className="space-y-2">
              <Label>Vista previa</Label>
              <video
                src={previewUrl}
                controls
                preload="metadata"
                className="w-full rounded-2xl border border-white/8"
                style={{ maxHeight: '40vh' }}
              />
            </div>
          )}

          {file && !fileUrl && !uploadError && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Video className="h-4 w-4" />
              <span>Archivo listo para subir.</span>
            </div>
          )}

          {fileUrl && (
            <div className="flex items-start gap-3 rounded-xl border border-green-600/20 bg-green-600/10 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-green-700">Archivo subido</p>
                <p className="text-sm text-green-700/80">
                  {fileName} · {formatFileSize(size)} MB
                </p>
              </div>
            </div>
          )}

          {uploading && progress !== null && progress < 100 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subiendo...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {uploadError && (
            <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
              <p className="text-sm text-destructive">{uploadError}</p>
            </div>
          )}

          {state?.error && !uploadError && (
            <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
              <p className="text-sm text-destructive">{state.error}</p>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-4 sm:flex-row sm:justify-between">
          <div className="flex w-full gap-2 sm:w-auto">
            <Button
              type="button"
              onClick={doUpload}
              disabled={!file || uploading || !!fileUrl}
              className="w-full sm:w-auto"
            >
              {uploading ? 'Subiendo...' : fileUrl ? 'Subido' : 'Subir archivo'}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(routes.videos)}
              disabled={isPending || uploading}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
          </div>

          <Button
            type="submit"
            disabled={!fileUrl || isPending || uploading}
            className="w-full sm:w-auto"
          >
            {isPending ? 'Guardando...' : 'Guardar video'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}

async function uploadToProvider(
  file: File,
  instructions: UploadInstructions,
  signal?: AbortSignal,
  onProgress?: (percentage: number) => void
): Promise<string> {
  const timeoutMs = getDefaultTimeoutMs();

  if (instructions.token) {
    const client = await import('@vercel/blob/client');
    const blobPromise = client.put(instructions.key, file, {
      access: 'public',
      token: instructions.token,
      abortSignal: signal,
      onUploadProgress: onProgress
        ? ({ percentage }) => onProgress(percentage)
        : undefined,
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      const id = setTimeout(
        () => reject(new Error('La subida superó el tiempo de espera.')),
        timeoutMs
      );
      signal?.addEventListener('abort', () => {
        clearTimeout(id);
        reject(new Error('La subida fue cancelada.'));
      });
    });

    const blob = await Promise.race([blobPromise, timeoutPromise]);
    return blob.url;
  }

  let simulatedProgress = 0;
  const progressTimer = onProgress
    ? setInterval(() => {
        simulatedProgress = Math.min(simulatedProgress + 5, 90);
        onProgress(simulatedProgress);
      }, 500)
    : null;

  try {
    if (instructions.method === 'PUT') {
      const response = await fetchWithTimeout(instructions.url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
        signal,
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

    const response = await fetchWithTimeout(instructions.url, {
      method: 'POST',
      body: formData,
      signal,
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
  } finally {
    if (progressTimer) clearInterval(progressTimer);
  }
}

function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const timeoutMs = getDefaultTimeoutMs();
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(new Error('La subida superó el tiempo de espera.')),
    timeoutMs
  );

  if (init?.signal) {
    init.signal.addEventListener('abort', () => controller.abort());
  }

  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timeoutId);
  });
}
