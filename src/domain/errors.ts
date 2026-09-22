export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string, id?: number | string) {
    super(`${resource}${id !== undefined ? ` con ID ${id}` : ''} no encontrado.`);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class InsufficientStockError extends DomainError {
  /**
   * Nombre del producto afectado. Se expone para que las rutas públicas
   * puedan construir un mensaje amigable sin parsear `message`, que mantiene
   * el detalle interno (insumo y cantidades) para el panel.
   */
  readonly productName: string;

  constructor(
    productName: string,
    available: number,
    requested: number,
    supplyName?: string
  ) {
    super(
      `Stock insuficiente para ${productName}${
        supplyName ? ` (insumo: ${supplyName})` : ''
      }. Disponible: ${available}, solicitado: ${requested}.`
    );
    this.name = 'InsufficientStockError';
    this.productName = productName;
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'No autorizado.') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'No tenés permisos para realizar esta acción.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * La sucursal del `branchId` de la sesión fue eliminada (borrado físico en
 * cascada; el JWT sigue vivo). Lleva `code` para que el cliente distinga
 * este 403 de uno de permisos y fuerce el cierre de sesión.
 */
export class BranchRemovedError extends ForbiddenError {
  readonly code = 'BRANCH_REMOVED';

  constructor(message = 'La sucursal asignada ya no existe.') {
    super(message);
    this.name = 'BranchRemovedError';
  }
}

export class DatabaseConnectionError extends Error {
  constructor(
    message = 'No se pudo conectar a la base de datos. Verificá que el servidor de PostgreSQL esté activo y que DATABASE_URL esté configurada correctamente.'
  ) {
    super(message);
    this.name = 'DatabaseConnectionError';
  }
}
