import * as videoRepository from '@/repositories/videoRepository';
import {
  getVideoMaxSizeBytes,
  getVideoAllowedMimeTypes,
  getStorageProvider,
} from '@/config/videos';
import { getStorageProvider as getProviderInstance } from '@/lib/storage';
import { deleteVideoFileByUrl } from '@/lib/storage';
import { NotFoundError, ValidationError } from '@/domain/errors';
import { videoSchema, videoUpdateSchema } from '@/lib/zod-schemas';
import { ZodError } from 'zod';
import type { VideoInsert, VideoUpdate } from '@/repositories/videoRepository';
import type { FileInfo } from '@/lib/storage';

export async function listVideos(branchId: number, includeDeleted = false) {
  return videoRepository.findAll(branchId, includeDeleted);
}

export async function getVideoById(
  branchId: number,
  id: number,
  includeDeleted = false
) {
  const video = await videoRepository.findById(branchId, id, includeDeleted);
  if (!video) throw new NotFoundError('Video', id);
  return video;
}

export async function listActiveVideos(branchId: number) {
  return videoRepository.findActive(branchId);
}

export async function prepareUpload(
  branchId: number,
  file: FileInfo
) {
  validateFile(file);

  const providerName = getStorageProvider();
  const provider = getProviderInstance(providerName);
  return provider.prepareUpload(file, branchId);
}

export async function createVideo(branchId: number, data: VideoInsert) {
  validateVideo(data);

  try {
    videoSchema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError(error.issues.map((e) => e.message).join('. '));
    }
    throw error;
  }

  return videoRepository.create({ ...data, branchId });
}

export async function updateVideo(
  branchId: number,
  id: number,
  data: VideoUpdate
) {
  const existing = await getVideoById(branchId, id);

  try {
    videoUpdateSchema.parse({ ...existing, ...data });
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError(error.issues.map((e) => e.message).join('. '));
    }
    throw error;
  }

  return videoRepository.update(branchId, id, data);
}

export async function toggleVideoStatus(
  branchId: number,
  id: number,
  isActive: boolean
) {
  await getVideoById(branchId, id);
  return videoRepository.update(branchId, id, { isActive });
}

export async function deleteVideo(branchId: number, id: number) {
  await getVideoById(branchId, id);
  return videoRepository.softDelete(branchId, id);
}

export async function restoreVideo(branchId: number, id: number) {
  await getVideoById(branchId, id, true);
  return videoRepository.restore(branchId, id);
}

export async function permanentlyDeleteVideo(branchId: number, id: number) {
  const video = await getVideoById(branchId, id, true);

  if (!video.deletedAt) {
    throw new ValidationError(
      'El video debe estar en la papelera para eliminarse permanentemente.'
    );
  }

  const deleted = await videoRepository.hardDelete(branchId, id);

  if (deleted && video.fileUrl) {
    await deleteVideoFileByUrl(video.fileUrl);
  }

  return deleted;
}

function validateVideo(data: VideoInsert | VideoUpdate) {
  if (data.size !== undefined && data.size !== null) {
    if (data.size > getVideoMaxSizeBytes()) {
      throw new ValidationError(
        `El archivo supera el tamaño máximo permitido de ${formatBytes(getVideoMaxSizeBytes())}.`
      );
    }
  }

  if ('mimeType' in data && data.mimeType) {
    const allowed = getVideoAllowedMimeTypes();
    if (!allowed.includes(data.mimeType)) {
      throw new ValidationError(
        `El tipo de archivo ${data.mimeType} no está permitido. Tipos permitidos: ${allowed.join(', ')}.`
      );
    }
  }
}

function validateFile(file: FileInfo) {
  const allowed = getVideoAllowedMimeTypes();
  if (!allowed.includes(file.type)) {
    throw new ValidationError(
      `El tipo de archivo ${file.type} no está permitido. Tipos permitidos: ${allowed.join(', ')}.`
    );
  }

  if (file.size > getVideoMaxSizeBytes()) {
    throw new ValidationError(
      `El archivo supera el tamaño máximo permitido de ${formatBytes(getVideoMaxSizeBytes())}.`
    );
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
