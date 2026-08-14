export const DEFAULT_VIDEO_MAX_SIZE_MB = 100;

export const DEFAULT_VIDEO_ALLOWED_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/ogg',
] as const;

export const DEFAULT_CAST_RECEIVER_APP_ID = 'CC1AD845';

export const DEFAULT_CAST_SENDER_SDK_URL =
  'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';

export type StorageProviderName =
  | 'vercel-blob'
  | 's3'
  | 'r2'
  | 'local';

export function getVideoMaxSizeMb(): number {
  const env = process.env.NEXT_PUBLIC_VIDEO_MAX_SIZE_MB;
  if (!env) return DEFAULT_VIDEO_MAX_SIZE_MB;
  const parsed = Number(env);
  return Number.isNaN(parsed) || parsed <= 0
    ? DEFAULT_VIDEO_MAX_SIZE_MB
    : parsed;
}

export function getVideoAllowedMimeTypes(): string[] {
  const env = process.env.NEXT_PUBLIC_VIDEO_ALLOWED_MIME_TYPES;
  if (!env) return [...DEFAULT_VIDEO_ALLOWED_MIME_TYPES];
  return env
    .split(',')
    .map((type) => type.trim())
    .filter(Boolean);
}

export function getCastReceiverAppId(): string {
  return (
    process.env.NEXT_PUBLIC_CAST_RECEIVER_APP_ID ??
    DEFAULT_CAST_RECEIVER_APP_ID
  );
}

export function getCastSenderSdkUrl(): string {
  return (
    process.env.NEXT_PUBLIC_CAST_SENDER_SDK_URL ??
    DEFAULT_CAST_SENDER_SDK_URL
  );
}

export function getStorageProvider(): StorageProviderName {
  const env = process.env.STORAGE_PROVIDER;
  if (!env) return 'local';

  const allowed: StorageProviderName[] = [
    'vercel-blob',
    's3',
    'r2',
    'local',
  ];
  if (allowed.includes(env as StorageProviderName)) {
    return env as StorageProviderName;
  }

  return 'local';
}

export function getVideoMaxSizeBytes(): number {
  return getVideoMaxSizeMb() * 1024 * 1024;
}

export function isAllowedVideoMimeType(mimeType: string): boolean {
  return getVideoAllowedMimeTypes().includes(mimeType);
}
