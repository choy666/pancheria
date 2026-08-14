'use server';

import { revalidatePath } from 'next/cache';
import * as videoService from '@/application/services/videoService';
import { requireAdmin } from '@/lib/auth';
import { getCurrentBranchId } from '@/lib/auth';
import { DomainError } from '@/domain/errors';
import { routes } from '@/config/routes';
import type { UploadInstructions } from '@/lib/storage';

export type VideoState = { error: string } | null;
export type PrepareUploadState =
  | { error: string }
  | { data: UploadInstructions }
  | null;

export async function listVideosForBranch() {
  const session = await requireAdmin();
  const branchId = await getCurrentBranchId(session);
  return videoService.listVideos(branchId);
}

export async function prepareUploadAction(
  _prevState: PrepareUploadState,
  formData: FormData
): Promise<PrepareUploadState> {
  const session = await requireAdmin();
  const branchId = await getCurrentBranchId(session);

  const name = formData.get('name')?.toString() ?? '';
  const type = formData.get('type')?.toString() ?? '';
  const sizeRaw = formData.get('size')?.toString() ?? '0';
  const size = Number(sizeRaw);

  try {
    const instructions = await videoService.prepareUpload(branchId, {
      name,
      type,
      size,
    });
    return { data: instructions };
  } catch (error) {
    if (error instanceof DomainError) {
      return { error: error.message };
    }
    throw error;
  }
}

export async function createVideoAction(
  _prevState: VideoState,
  formData: FormData
): Promise<VideoState> {
  const session = await requireAdmin();
  const branchId = await getCurrentBranchId(session);

  const title = formData.get('title')?.toString() ?? '';
  const description = formData.get('description')?.toString() || null;
  const fileUrl = formData.get('fileUrl')?.toString() ?? '';
  const mimeType = formData.get('mimeType')?.toString() ?? '';
  const sizeRaw = formData.get('size')?.toString() ?? '';
  const size = sizeRaw ? Number(sizeRaw) : null;
  const isActive = formData.get('isActive')?.toString() === 'true';

  try {
    await videoService.createVideo(branchId, {
      title,
      description,
      fileUrl,
      mimeType,
      size,
      isActive,
    });
  } catch (error) {
    if (error instanceof DomainError) {
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath(routes.videos);
  return null;
}

export async function updateVideoAction(
  _prevState: VideoState,
  formData: FormData
): Promise<VideoState> {
  const session = await requireAdmin();
  const branchId = await getCurrentBranchId(session);

  const id = Number(formData.get('id'));
  const title = formData.get('title')?.toString() ?? '';
  const description = formData.get('description')?.toString() || null;
  const fileUrl = formData.get('fileUrl')?.toString() ?? '';
  const mimeType = formData.get('mimeType')?.toString() ?? '';
  const sizeRaw = formData.get('size')?.toString() ?? '';
  const size = sizeRaw ? Number(sizeRaw) : null;
  const isActive = formData.get('isActive')?.toString() === 'true';

  try {
    await videoService.updateVideo(branchId, id, {
      title,
      description,
      fileUrl,
      mimeType,
      size,
      isActive,
    });
  } catch (error) {
    if (error instanceof DomainError) {
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath(routes.videos);
  return null;
}

export async function toggleVideoStatusAction(
  _prevState: VideoState,
  formData: FormData
): Promise<VideoState> {
  const session = await requireAdmin();
  const branchId = await getCurrentBranchId(session);

  const id = Number(formData.get('id'));
  const isActive = formData.get('isActive')?.toString() === 'true';

  try {
    await videoService.toggleVideoStatus(branchId, id, isActive);
  } catch (error) {
    if (error instanceof DomainError) {
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath(routes.videos);
  return null;
}

export async function deleteVideoAction(
  _prevState: VideoState,
  formData: FormData
): Promise<VideoState> {
  const session = await requireAdmin();
  const branchId = await getCurrentBranchId(session);

  const id = Number(formData.get('id'));

  try {
    await videoService.deleteVideo(branchId, id);
  } catch (error) {
    if (error instanceof DomainError) {
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath(routes.videos);
  return null;
}

export async function restoreVideoAction(
  _prevState: VideoState,
  formData: FormData
): Promise<VideoState> {
  const session = await requireAdmin();
  const branchId = await getCurrentBranchId(session);

  const id = Number(formData.get('id'));

  try {
    await videoService.restoreVideo(branchId, id);
  } catch (error) {
    if (error instanceof DomainError) {
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath(routes.videos);
  return null;
}
