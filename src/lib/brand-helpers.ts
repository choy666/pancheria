import { PUBLIC_MARCA_LOGO_API } from '@/config/api';
import type { BrandSettings } from '@/domain/types';

export function isValidCuit(value: string): boolean {
  return /^\d{2}-?\d{8}-?\d$/.test(value);
}

export function normalizeCuit(value: string): string {
  const digits = value.replace(/\D/g, '');
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}

export function isSafeBrandUrl(value: string): boolean {
  if (value.startsWith('/')) return !value.startsWith('//') && !value.includes('\\');
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function getBrandLogoPath(logoUpdatedAt: Date | string | null): string | null {
  if (!logoUpdatedAt) return null;
  return `${PUBLIC_MARCA_LOGO_API}?v=${new Date(logoUpdatedAt).getTime()}`;
}

export function splitBrandName(name: string): { first: string; rest: string } {
  const [first = '', ...words] = name.trim().split(/\s+/);
  return { first, rest: words.join(' ') };
}

export function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function getBrandDisplayName(
  brand: Pick<BrandSettings, 'name'>,
  branchName?: string | null
): string {
  return brand.name?.trim() || branchName?.trim() || 'Pedido online';
}
