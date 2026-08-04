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
  constructor(productName: string, available: number, requested: number) {
    super(
      `Stock insuficiente para ${productName}. Disponible: ${available}, solicitado: ${requested}.`
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
