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

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
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

/**
 * El usuario de la sesión ya no existe en la base (borrado en cascada con su
 * sucursal o eliminado por un admin; el JWT sigue vivo). Lleva `code` para
 * que el cliente fuerce el cierre de sesión igual que con `BRANCH_REMOVED`.
 */
export class UserRemovedError extends ForbiddenError {
  readonly code = 'USER_REMOVED';

  constructor(message = 'Tu usuario fue eliminado.') {
    super(message);
    this.name = 'UserRemovedError';
  }
}

/**
 * El usuario superó el máximo de intentos de login fallidos dentro de la
 * ventana configurada. El `authorize` de NextAuth la convierte en un
 * `CredentialsSignin` con `code` propio para que la UI muestre el mensaje
 * en vez del `error=Configuration` genérico.
 */
export class LoginAttemptsExceededError extends ValidationError {
  readonly code = 'LOGIN_ATTEMPTS_EXCEEDED';

  constructor(message = 'Demasiados intentos fallidos. Probá más tarde.') {
    super(message);
    this.name = 'LoginAttemptsExceededError';
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
