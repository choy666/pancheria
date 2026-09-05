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

export function getDefaultBranchPhone(): string | undefined {
  return process.env.DEFAULT_BRANCH_PHONE;
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

export function getNewBranchPhone(): string | undefined {
  return process.env.NEW_BRANCH_PHONE;
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
