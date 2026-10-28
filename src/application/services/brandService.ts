import { ZodError } from 'zod';
import * as brandRepository from '@/repositories/brandRepository';
import { ValidationError } from '@/domain/errors';
import { BRAND_LOGO_MAX_BYTES, BRAND_LOGO_MIME_TYPES } from '@/config/brand';
import { brandSettingsSchema } from '@/lib/zod-schemas';
import { assertBufferSignature, SIGNATURE_READ_BYTES } from '@/lib/storage';
import { getCachedBrandSettings } from '@/lib/server-cache';
import type { BrandLogo, BrandSettings } from '@/domain/types';

function defaultBrand(): BrandSettings {
  return {
    name: null,
    tagline: null,
    logoUpdatedAt: null,
    legalName: null,
    taxId: null,
    supportEmail: null,
    termsUrl: null,
    privacyUrl: null,
    footerAbout: null,
    paymentMethods: null,
    developedBy: null,
    showHours: true,
    showMap: true,
    showSocial: true,
    faq: [],
    announcementText: null,
    announcementEnabled: false,
    announcementVariant: 'info',
  };
}

export async function getBrand(): Promise<BrandSettings> {
  return (await getCachedBrandSettings()) ?? defaultBrand();
}

export async function getBrandLogo(): Promise<BrandLogo | null> {
  return brandRepository.findLogo();
}

/**
 * Los campos de texto vacíos del formulario se guardan como `NULL`. Los ítems
 * de la ayuda no pasan por acá: una pregunta sin respuesta debe fallar, no
 * borrarse en silencio.
 */
function normalizeBrandInput(input: unknown): unknown {
  if (typeof input !== 'object' || input === null) return input;
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [
      key,
      typeof value === 'string' && value.trim() === '' ? null : value,
    ])
  );
}

export async function updateSettings(input: unknown): Promise<void> {
  let data;
  try {
    data = brandSettingsSchema.parse(normalizeBrandInput(input));
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError(
        error.issues.map((issue) => issue.message).join('. ')
      );
    }
    throw error;
  }

  await brandRepository.upsertSettings(data);
}

export async function saveLogo(file: File): Promise<void> {
  if (!BRAND_LOGO_MIME_TYPES.includes(file.type)) {
    throw new ValidationError('El logo debe ser PNG, JPG o WebP.');
  }
  if (file.size > BRAND_LOGO_MAX_BYTES) {
    throw new ValidationError(
      `El logo supera el tamaño máximo de ${BRAND_LOGO_MAX_BYTES / 1024} KB.`
    );
  }

  const data = Buffer.from(await file.arrayBuffer());
  assertBufferSignature(data.subarray(0, SIGNATURE_READ_BYTES), file.type);
  await brandRepository.upsertLogo(data, file.type);
}

export async function removeLogo(): Promise<void> {
  await brandRepository.clearLogo();
}
