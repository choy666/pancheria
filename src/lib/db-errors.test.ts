import { DrizzleQueryError } from 'drizzle-orm/errors';
import { DatabaseConnectionError } from '@/domain/errors';
import { isDatabaseConnectionError } from './db-errors';

function createConnectionAggregateError(): AggregateError {
  const error = new AggregateError([
    new Error('connect ECONNREFUSED 127.0.0.1:5432'),
  ]);
  Object.assign(error, { code: 'ECONNREFUSED' });
  return error;
}

describe('isDatabaseConnectionError', () => {
  it('detecta DatabaseConnectionError', () => {
    expect(isDatabaseConnectionError(new DatabaseConnectionError())).toBe(true);
  });

  it('detecta DrizzleQueryError causado por ECONNREFUSED', () => {
    const cause = createConnectionAggregateError();
    const drizzleError = new DrizzleQueryError('SELECT 1', [], cause);
    expect(isDatabaseConnectionError(drizzleError)).toBe(true);
  });

  it('detecta DrizzleQueryError cuya causa anidada es ECONNREFUSED', () => {
    const inner = createConnectionAggregateError();
    const cause = new Error('Failed to connect');
    Object.assign(cause, { cause: inner });
    const drizzleError = new DrizzleQueryError('SELECT 1', [], cause);
    expect(isDatabaseConnectionError(drizzleError)).toBe(true);
  });

  it('no detecta DrizzleQueryError con otro error', () => {
    const cause = new Error('syntax error at or near ...');
    Object.assign(cause, { code: '42601' });
    const drizzleError = new DrizzleQueryError('SELECT 1', [], cause);
    expect(isDatabaseConnectionError(drizzleError)).toBe(false);
  });

  it('detecta AggregateError con ECONNREFUSED sin envolver por Drizzle', () => {
    const error = createConnectionAggregateError();
    expect(isDatabaseConnectionError(error)).toBe(true);
  });

  it('detecta error de conexión por código anidado', () => {
    const cause = createConnectionAggregateError();
    const error = new Error('No se pudo conectar');
    Object.assign(error, { cause });
    expect(isDatabaseConnectionError(error)).toBe(true);
  });

  it('no detecta errores comunes', () => {
    expect(isDatabaseConnectionError(new Error('Otro error'))).toBe(false);
    expect(isDatabaseConnectionError(null)).toBe(false);
    expect(isDatabaseConnectionError(undefined)).toBe(false);
    expect(isDatabaseConnectionError('string')).toBe(false);
  });
});
