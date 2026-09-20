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
} from '@/app/(panel)/videos/actions';

interface VideosPageProps {
  searchParams: Promise<{ page?: string; limit?: string }>;
}

export default async function VideosPage({ searchParams }: VideosPageProps) {
  const session = await auth();

  if (session?.user?.role !== 'admin') {
    redirect(routes.home);
  }

  const params = await searchParams;
  const pagination = parsePaginationParams(
    new URLSearchParams({ page: params.page ?? '', limit: params.limit ?? '' })
  );

  const branchId = await getCurrentBranchIdOrRedirect(session);
  const videos = await videoService.listVideos(branchId, pagination);

  return (
    <div data-tour="videos-page" className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Videos</h1>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link href={routes.videosEliminados}>
            <Button data-testid="videos-trash-link" variant="outline" className="w-full sm:w-auto">
              Papelera
            </Button>
          </Link>
          <Link href={routes.videosNuevo}>
            <Button className="w-full sm:w-auto">Subir video</Button>
          </Link>
        </div>
      </div>

      <VideoList
        videos={videos.items}
        deleteVideoAction={deleteVideoAction}
        restoreVideoAction={restoreVideoAction}
        toggleVideoStatusAction={toggleVideoStatusAction}
      />

      <ServerPagination
        page={videos.page}
        limit={videos.limit}
        total={videos.total}
      />
    </div>
  );
}
