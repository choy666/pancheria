/**
 * Configuración de sucursales. Valores leídos de variables de entorno.
 *
 * No acceder a la base de datos desde este archivo.
 */

export function getDefaultBranchName(): string | undefined {
  return process.env.DEFAULT_BRANCH_NAME?.trim();
}

export function getDefaultBranchAddress(): string | undefined {
  return process.env.DEFAULT_BRANCH_ADDRESS;
}

export function getDefaultBranchPhones(): { label: string; number: string }[] {
  const phone = process.env.DEFAULT_BRANCH_PHONE?.trim();
  return phone ? [{ label: 'Principal', number: phone }] : [];
}

export function getDefaultBranchSocialLinksJson(): string | undefined {
  return process.env.DEFAULT_BRANCH_SOCIAL_LINKS;
}

export function getDefaultBranchLocation(): string | undefined {
  return process.env.DEFAULT_BRANCH_LOCATION;
}

export function getNewBranchName(): string | undefined {
  return process.env.NEW_BRANCH_NAME;
}

export function getNewBranchUsername(): string | undefined {
  return process.env.NEW_BRANCH_USERNAME;
}

export function getNewBranchPassword(): string | undefined {
  return process.env.NEW_BRANCH_PASSWORD;
}

export function getNewBranchAddress(): string | undefined {
  return process.env.NEW_BRANCH_ADDRESS;
}

export function getNewBranchPhones(): { label: string; number: string }[] {
  const phone = process.env.NEW_BRANCH_PHONE?.trim();
  return phone ? [{ label: 'Principal', number: phone }] : [];
}

export function getNewBranchSocialLinksJson(): string | undefined {
  return process.env.NEW_BRANCH_SOCIAL_LINKS;
}

export function getNewBranchLocation(): string | undefined {
  return process.env.NEW_BRANCH_LOCATION;
}

export function getBranchTimezone(): string {
  return (
    process.env.NEXT_PUBLIC_BRANCH_TIMEZONE ||
    'America/Argentina/Buenos_Aires'
  );
}

const DEFAULT_PUBLIC_BRANCH_STATUS_CACHE_S_MAXAGE = 10;
const DEFAULT_PUBLIC_BRANCH_STATUS_CACHE_SWR = 30;

/**
 * Segundos de `s-maxage` para el CDN en `GET /api/public/sucursal/estado`
 * (`PUBLIC_BRANCH_STATUS_CACHE_S_MAXAGE`, por defecto 10). `0` deshabilita
 * el header de caché y vuelve al comportamiento anterior (cada request
 * pega al origen). Es una variable solo de servidor.
 */
export function getPublicBranchStatusCacheSMaxage(): number {
  const raw = process.env.PUBLIC_BRANCH_STATUS_CACHE_S_MAXAGE;
  if (!raw) return DEFAULT_PUBLIC_BRANCH_STATUS_CACHE_S_MAXAGE;

  const parsed = Number(raw);
  if (Number.isNaN(parsed)) return DEFAULT_PUBLIC_BRANCH_STATUS_CACHE_S_MAXAGE;

  return parsed <= 0 ? 0 : Math.floor(parsed);
}

/**
 * Segundos de `stale-while-revalidate` para el CDN en
 * `GET /api/public/sucursal/estado` (`PUBLIC_BRANCH_STATUS_CACHE_SWR`,
 * por defecto 30). Es una variable solo de servidor.
 */
export function getPublicBranchStatusCacheSwr(): number {
  const raw = process.env.PUBLIC_BRANCH_STATUS_CACHE_SWR;
  if (!raw) return DEFAULT_PUBLIC_BRANCH_STATUS_CACHE_SWR;

  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < 0) {
    return DEFAULT_PUBLIC_BRANCH_STATUS_CACHE_SWR;
  }

  return Math.floor(parsed);
}
