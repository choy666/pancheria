'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { routes } from '@/config/routes';
import type { VideoRow } from '@/domain/types';
import type { VideoState } from '@/app/(panel)/videos/actions';

interface VideoListProps {
  videos: VideoRow[];
  deleteVideoAction: (
    _prevState: VideoState,
    formData: FormData
  ) => Promise<VideoState>;
  restoreVideoAction: (
    _prevState: VideoState,
    formData: FormData
  ) => Promise<VideoState>;
  toggleVideoStatusAction: (
    _prevState: VideoState,
    formData: FormData
  ) => Promise<VideoState>;
}

export function VideoList({
  videos,
  deleteVideoAction,
  restoreVideoAction,
  toggleVideoStatusAction,
}: VideoListProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleAction(
    action: (
      _prevState: VideoState,
      formData: FormData
    ) => Promise<VideoState>,
    formData: FormData
  ) {
    startTransition(() => {
      action(null, formData).then((result) => {
        if (result?.error) {
          setError(result.error);
        } else {
          setError(null);
          router.refresh();
        }
      });
    });
  }

  return (
    <div data-tour="videos-table" className="space-y-4">
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="rounded-2xl border border-white/8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {videos.map((video) => (
              <TableRow key={video.id}>
                <TableCell>
                  <Link
                    href={routes.videoDetalle(video.id)}
                    className="hover:underline"
                  >
                    {video.title}
                  </Link>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {video.mimeType}
                  </span>
                </TableCell>
                <TableCell>
                  {video.deletedAt ? (
                    <Badge variant="destructive">Eliminado</Badge>
                  ) : video.isActive ? (
                    <Badge>Activo</Badge>
                  ) : (
                    <Badge variant="secondary">Inactivo</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={routes.videoDetalle(video.id)}
                      className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                    >
                      Ver
                    </Link>

                    {!video.deletedAt && (
                      <form
                        action={(formData) =>
                          handleAction(toggleVideoStatusAction, formData)
                        }
                      >
                        <input type="hidden" name="id" value={video.id} />
                        <input
                          type="hidden"
                          name="isActive"
                          value={String(!video.isActive)}
                        />
                        <Button
                          type="submit"
                          variant="outline"
                          size="sm"
                          disabled={isPending}
                        >
                          {video.isActive ? 'Desactivar' : 'Activar'}
                        </Button>
                      </form>
                    )}

                    {video.deletedAt ? (
                      <form
                        action={(formData) =>
                          handleAction(restoreVideoAction, formData)
                        }
                      >
                        <input type="hidden" name="id" value={video.id} />
                        <Button
                          type="submit"
                          variant="outline"
                          size="sm"
                          disabled={isPending}
                        >
                          Restaurar
                        </Button>
                      </form>
                    ) : (
                      <form
                        action={(formData) =>
                          handleAction(deleteVideoAction, formData)
                        }
                      >
                        <input type="hidden" name="id" value={video.id} />
                        <Button
                          type="submit"
                          variant="destructive"
                          size="sm"
                          disabled={isPending}
                        >
                          Eliminar
                        </Button>
                      </form>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {videos.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground"
                >
                  No hay videos registrados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
