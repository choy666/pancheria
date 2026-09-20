import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { routes } from '@/config/routes';
import * as videoService from '@/application/services/videoService';
import { getCurrentBranchIdOrRedirect } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { VideoList } from '@/components/videos/video-list';
import { ServerPagination } from '@/components/ui/server-pagination';
import { parsePaginationParams } from '@/lib/pagination';
import {
  deleteVideoAction,
  restoreVideoAction,
  toggleVideoStatusAction,
  permanentlyDeleteVideoAction,
} from '@/app/(panel)/videos/actions';

interface VideosTrashPageProps {
  searchParams: Promise<{ page?: string; limit?: string }>;
}

export default async function VideosTrashPage({
  searchParams,
}: VideosTrashPageProps) {
  const session = await auth();

  if (session?.user?.role !== 'admin') {
    redirect(routes.home);
  }

  const params = await searchParams;
  const pagination = parsePaginationParams(
    new URLSearchParams({ page: params.page ?? '', limit: params.limit ?? '' })
  );

  const branchId = await getCurrentBranchIdOrRedirect(session);
  const deletedVideos = await videoService.listVideos(
    branchId,
    pagination,
    'deleted'
  );

  return (
    <div data-tour="videos-trash-page" className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Papelera de videos</h1>
        <Link href={routes.videos}>
          <Button variant="outline">Volver a videos</Button>
        </Link>
      </div>

      <VideoList
        videos={deletedVideos.items}
        deleteVideoAction={deleteVideoAction}
        restoreVideoAction={restoreVideoAction}
        toggleVideoStatusAction={toggleVideoStatusAction}
        permanentlyDeleteVideoAction={permanentlyDeleteVideoAction}
        emptyMessage="No hay videos en la papelera."
      />

      <ServerPagination
        page={deletedVideos.page}
        limit={deletedVideos.limit}
        total={deletedVideos.total}
      />
    </div>
  );
}
