import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { revalidateSessionUser } from '@/lib/auth';
import { routes } from '@/config/routes';
import { VideoForm } from '@/components/videos/video-form';
import {
  createVideoAction,
  prepareUploadAction,
} from '@/app/(panel)/videos/actions';

export default async function NuevoVideoPage() {
  const session = await auth();

  // El rol puede quedar viejo en el JWT: se revalida contra la base antes
  // de decidir el acceso (un admin degradado no debe ver esta página).
  if (
    !session?.user ||
    !(await revalidateSessionUser(session)) ||
    session.user.role !== 'admin'
  ) {
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
