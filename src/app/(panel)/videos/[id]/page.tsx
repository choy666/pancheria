import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { routes } from '@/config/routes';
import * as videoService from '@/application/services/videoService';
import { getCurrentBranchId } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { VideoPlayer } from '@/components/videos/video-player';
import { CastButton } from '@/components/videos/cast-button';

export default async function VideoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (session?.user?.role !== 'admin') {
    redirect(routes.home);
  }

  const { id } = await params;
  const branchId = await getCurrentBranchId(session);
  const video = await videoService.getVideoById(branchId, Number(id));

  if (!video) {
    notFound();
  }

  return (
    <div data-tour="videos-detail" className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{video.title}</h1>
        <Link href={routes.videos}>
          <Button variant="outline">Volver al listado</Button>
        </Link>
      </div>

      {video.description && (
        <p className="text-muted-foreground">{video.description}</p>
      )}

      <div className="space-y-2">
        <VideoPlayer src={video.fileUrl} mimeType={video.mimeType} />
        <div className="flex justify-end">
          <CastButton src={video.fileUrl} mimeType={video.mimeType} />
        </div>
      </div>
    </div>
  );
}
