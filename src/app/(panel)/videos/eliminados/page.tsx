import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { routes } from '@/config/routes';
import * as videoService from '@/application/services/videoService';
import { getCurrentBranchIdOrRedirect } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { VideoList } from '@/components/videos/video-list';
import {
  deleteVideoAction,
  restoreVideoAction,
  toggleVideoStatusAction,
  permanentlyDeleteVideoAction,
} from '@/app/(panel)/videos/actions';

export default async function VideosTrashPage() {
  const session = await auth();

  if (session?.user?.role !== 'admin') {
    redirect(routes.home);
  }

  const branchId = await getCurrentBranchIdOrRedirect(session);
  const allVideos = await videoService.listVideos(branchId, true);
  const deletedVideos = allVideos.filter((video) => video.deletedAt !== null);

  return (
    <div data-tour="videos-trash-page" className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Papelera de videos</h1>
        <Link href={routes.videos}>
          <Button variant="outline">Volver a videos</Button>
        </Link>
      </div>

      <VideoList
        videos={deletedVideos}
        deleteVideoAction={deleteVideoAction}
        restoreVideoAction={restoreVideoAction}
        toggleVideoStatusAction={toggleVideoStatusAction}
        permanentlyDeleteVideoAction={permanentlyDeleteVideoAction}
        emptyMessage="No hay videos en la papelera."
      />
    </div>
  );
}
