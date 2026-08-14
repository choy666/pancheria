import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { routes } from '@/config/routes';
import { VideoForm } from '@/components/videos/video-form';
import {
  createVideoAction,
  prepareUploadAction,
} from '@/app/(panel)/videos/actions';

export default async function NuevoVideoPage() {
  const session = await auth();

  if (session?.user?.role !== 'admin') {
    redirect(routes.home);
  }

  return (
    <div data-tour="videos-new" className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Subir video</h1>
      <VideoForm
        prepareUploadAction={prepareUploadAction}
        createVideoAction={createVideoAction}
      />
    </div>
  );
}
