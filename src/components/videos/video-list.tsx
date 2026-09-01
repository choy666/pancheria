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
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
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
  permanentlyDeleteVideoAction?: (
    _prevState: VideoState,
    formData: FormData
  ) => Promise<VideoState>;
  emptyMessage?: string;
}

export function VideoList({
  videos,
  deleteVideoAction,
  restoreVideoAction,
  toggleVideoStatusAction,
  permanentlyDeleteVideoAction,
  emptyMessage = 'No hay videos registrados.',
}: VideoListProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<{
    type: 'delete' | 'restore' | 'permanent';
    id: number;
    title: string;
  } | null>(null);

  async function handleAction(
    action: (
      _prevState: VideoState,
      formData: FormData
    ) => Promise<VideoState>,
    formData: FormData
  ) {
    startTransition(async () => {
      const result = await action(null, formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setError(null);
        router.refresh();
      }
    });
  }

  function handleConfirm() {
    if (!confirm) return;

    const formData = new FormData();
    formData.append('id', String(confirm.id));

    let action;
    switch (confirm.type) {
      case 'delete':
        action = deleteVideoAction;
        break;
      case 'restore':
        action = restoreVideoAction;
        break;
      case 'permanent':
        action = permanentlyDeleteVideoAction;
        break;
    }

    if (action) {
      handleAction(action, formData);
    }
    setConfirm(null);
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
              <TableRow key={video.id} data-testid="video-row">
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
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isPending}
                          data-testid="restore-video-button"
                          onClick={() =>
                            setConfirm({
                              type: 'restore',
                              id: video.id,
                              title: video.title,
                            })
                          }
                        >
                          Restaurar
                        </Button>
                        {permanentlyDeleteVideoAction && (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={isPending}
                            data-testid="permanently-delete-video-button"
                            onClick={() =>
                              setConfirm({
                                type: 'permanent',
                                id: video.id,
                                title: video.title,
                              })
                            }
                          >
                            Eliminar permanentemente
                          </Button>
                        )}
                      </>
                    ) : (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={isPending}
                        data-testid="delete-video-button"
                        onClick={() =>
                          setConfirm({
                            type: 'delete',
                            id: video.id,
                            title: video.title,
                          })
                        }
                      >
                        Eliminar
                      </Button>
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
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={!!confirm}
        title={
          confirm?.type === 'delete'
            ? 'Eliminar video'
            : confirm?.type === 'restore'
              ? 'Restaurar video'
              : 'Eliminar video permanentemente'
        }
        description={
          confirm?.type === 'delete'
            ? `¿Eliminar "${confirm?.title ?? ''}"? El video se podrá restaurar desde la papelera.`
            : confirm?.type === 'restore'
              ? `¿Restaurar "${confirm?.title ?? ''}"?`
              : `¿Eliminar permanentemente "${confirm?.title ?? ''}"? Esta acción no se puede deshacer.`
        }
        confirmLabel={
          confirm?.type === 'permanent'
            ? 'Eliminar permanentemente'
            : confirm?.type === 'delete'
              ? 'Eliminar'
              : 'Restaurar'
        }
        cancelLabel="Cancelar"
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
