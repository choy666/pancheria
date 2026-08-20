import { ValidationError } from '@/domain/errors';

export function validateNonEmptyString(
  value: string | undefined | null,
  fieldName: string
): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) {
    throw new ValidationError(`${fieldName} es obligatorio.`);
  }
  return trimmed;
}

export function validatePositiveInteger(
  value: number,
  fieldName: string,
  message?: string
): void {
  if (!value || value <= 0 || !Number.isInteger(value)) {
    throw new ValidationError(message ?? `${fieldName} debe ser un número entero positivo.`);
  }
}

export function validateMinLength(
  value: string | undefined | null,
  min: number,
  fieldName: string
): void {
  const length = value?.length ?? 0;
  if (length < min) {
    throw new ValidationError(`${fieldName} debe tener al menos ${min} caracteres.`);
  }
}

export function validateBranchOwnership<T extends { branchId: number; name?: string | null }>(
  entity: T,
  expectedBranchId: number,
  entityType: string
): void {
  if (entity.branchId !== expectedBranchId) {
    const name = entity.name ? ` ${entity.name}` : '';
    throw new ValidationError(`${entityType}${name} no pertenece a la sucursal.`);
  }
}


