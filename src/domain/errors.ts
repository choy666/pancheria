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

export class DatabaseConnectionError extends Error {
  constructor(
    message = 'No se pudo conectar a la base de datos. Verificá que el servidor de PostgreSQL esté activo y que DATABASE_URL esté configurada correctamente.'
  ) {
    super(message);
    this.name = 'DatabaseConnectionError';
  }
}
