/**
 * Límites de la identidad de marca (`brand_settings`). Son constantes y no
 * variables de entorno: la validación del servidor, el cliente y el check de
 * la base usan los mismos valores.
 */

export const BRAND_LOGO_MAX_BYTES = 512 * 1024;
export const BRAND_LOGO_MAX_SIDE_PX = 512;
export const BRAND_LOGO_MIME_TYPES: readonly string[] = [
  'image/png',
  'image/jpeg',
  'image/webp',
];

export const BRAND_FAQ_MAX_ITEMS = 8;
export const BRAND_FAQ_QUESTION_MAX_LENGTH = 200;
export const BRAND_FAQ_ANSWER_MAX_LENGTH = 1000;
