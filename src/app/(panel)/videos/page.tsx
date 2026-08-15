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
} from '@/app/(panel)/videos/actions';

export default async function VideosPage() {
  const session = await auth();

  if (session?.user?.role !== 'admin') {
    redirect(routes.home);
  }

  const branchId = await getCurrentBranchIdOrRedirect(session);
  const videos = await videoService.listVideos(branchId);

  return (
    <div data-tour="videos-page" className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Videos</h1>
        <Link href={routes.videosNuevo}>
          <Button>Subir video</Button>
        </Link>
      </div>

      <VideoList
        videos={videos}
        deleteVideoAction={deleteVideoAction}
        restoreVideoAction={restoreVideoAction}
        toggleVideoStatusAction={toggleVideoStatusAction}
      />
    </div>
  );
}
