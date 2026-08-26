import {
  getChatRefreshIntervalMs,
  getChatMaxTextLength,
  getChatRateLimitWindowMs,
  getChatRateLimitMaxRequests,
  getChatImageMaxSizeBytes,
  getChatAllowedImageMimeTypes,
  getChatPageSize,
} from './chat';

describe('chat config', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('getChatRefreshIntervalMs usa el valor por defecto', () => {
    delete process.env.NEXT_PUBLIC_CHAT_REFRESH_INTERVAL_MS;
    expect(getChatRefreshIntervalMs()).toBe(5000);
  });

  test('getChatRefreshIntervalMs aplica un mínimo de 1000 ms', () => {
    process.env.NEXT_PUBLIC_CHAT_REFRESH_INTERVAL_MS = '500';
    expect(getChatRefreshIntervalMs()).toBe(5000);
  });

  test('getChatMaxTextLength usa el valor por defecto', () => {
    delete process.env.NEXT_PUBLIC_CHAT_MAX_TEXT_LENGTH;
    expect(getChatMaxTextLength()).toBe(1000);
  });

  test('getChatMaxTextLength rechaza valores menores a 1', () => {
    process.env.NEXT_PUBLIC_CHAT_MAX_TEXT_LENGTH = '0';
    expect(getChatMaxTextLength()).toBe(1000);
  });

  test('getChatRateLimitWindowMs usa el valor por defecto', () => {
    delete process.env.PUBLIC_CHAT_RATE_LIMIT_WINDOW_MS;
    expect(getChatRateLimitWindowMs()).toBe(60000);
  });

  test('getChatRateLimitMaxRequests usa el valor por defecto', () => {
    delete process.env.PUBLIC_CHAT_RATE_LIMIT_MAX_REQUESTS;
    expect(getChatRateLimitMaxRequests()).toBe(60);
  });

  test('getChatImageMaxSizeBytes convierte MB a bytes', () => {
    process.env.NEXT_PUBLIC_CHAT_IMAGE_MAX_SIZE_MB = '10';
    expect(getChatImageMaxSizeBytes()).toBe(10 * 1024 * 1024);
  });

  test('getChatAllowedImageMimeTypes usa los tipos por defecto', () => {
    delete process.env.NEXT_PUBLIC_CHAT_ALLOWED_IMAGE_MIME_TYPES;
    expect(getChatAllowedImageMimeTypes()).toEqual([
      'image/jpeg',
      'image/png',
      'image/webp',
    ]);
  });

  test('getChatAllowedImageMimeTypes respeta la lista configurada', () => {
    process.env.NEXT_PUBLIC_CHAT_ALLOWED_IMAGE_MIME_TYPES =
      'image/gif, image/svg';
    expect(getChatAllowedImageMimeTypes()).toEqual(['image/gif', 'image/svg']);
  });

  test('getChatPageSize usa el valor por defecto', () => {
    delete process.env.NEXT_PUBLIC_CHAT_PAGE_SIZE;
    expect(getChatPageSize()).toBe(50);
  });

  test('getChatPageSize respeta el máximo de 100', () => {
    process.env.NEXT_PUBLIC_CHAT_PAGE_SIZE = '200';
    expect(getChatPageSize()).toBe(100);
  });
});
