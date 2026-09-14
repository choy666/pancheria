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
