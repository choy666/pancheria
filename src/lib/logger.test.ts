/**
 * @jest-environment node
 */
import { logger, logError } from './logger';

function setNodeEnv(value: 'test' | 'development' | 'production') {
  jest.replaceProperty(process.env, 'NODE_ENV', value);
}

describe('logger', () => {
  let debugSpy: jest.SpyInstance;
  let infoSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('en entorno de test', () => {
    test('no emite ninguna salida por consola', () => {
      setNodeEnv('test');

      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');
      logger.error('error');

      expect(debugSpy).not.toHaveBeenCalled();
      expect(infoSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  describe('en desarrollo', () => {
    beforeEach(() => {
      setNodeEnv('development');
    });

    test('emite texto plano con el mensaje y el contexto', () => {
      logger.info('mensaje de prueba', { detalle: 42 });

      expect(infoSpy).toHaveBeenCalledTimes(1);
      expect(infoSpy).toHaveBeenCalledWith('mensaje de prueba', {
        detalle: 42,
      });
    });

    test('cada nivel usa el método de consola correspondiente', () => {
      logger.debug('d');
      logger.info('i');
      logger.warn('w');
      logger.error('e');

      // `writeLog` usa `{}` como contexto por defecto.
      expect(debugSpy).toHaveBeenCalledWith('d', {});
      expect(infoSpy).toHaveBeenCalledWith('i', {});
      expect(warnSpy).toHaveBeenCalledWith('w', {});
      expect(errorSpy).toHaveBeenCalledWith('e', {});
    });
  });

  describe('en producción', () => {
    beforeEach(() => {
      setNodeEnv('production');
    });

    test('emite un único string JSON con el payload estructurado', () => {
      logger.info('venta registrada', { ventaId: 7 });

      expect(infoSpy).toHaveBeenCalledTimes(1);
      const [salida] = infoSpy.mock.calls[0];
      expect(typeof salida).toBe('string');

      const payload = JSON.parse(salida as string);
      expect(payload).toMatchObject({
        level: 'info',
        message: 'venta registrada',
        ventaId: 7,
      });
      expect(payload.timestamp).toEqual(
        expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
        )
      );
    });

    test('omite los logs de debug para reducir ruido', () => {
      logger.debug('debug en producción');

      expect(debugSpy).not.toHaveBeenCalled();
    });

    test('logger.error emite JSON por console.error', () => {
      logger.error('falló algo');

      expect(errorSpy).toHaveBeenCalledTimes(1);
      const [salida] = errorSpy.mock.calls[0];
      const payload = JSON.parse(salida as string);
      expect(payload).toMatchObject({
        level: 'error',
        message: 'falló algo',
      });
    });
  });

  describe('logError', () => {
    test('en producción serializa el Error como errorMessage/errorStack', () => {
      setNodeEnv('production');
      const error = new Error('boom');

      logError('falló la operación', error, { ventaId: 5 });

      expect(errorSpy).toHaveBeenCalledTimes(1);
      const [salida] = errorSpy.mock.calls[0];
      const payload = JSON.parse(salida as string);

      expect(payload).toMatchObject({
        level: 'error',
        message: 'falló la operación',
        ventaId: 5,
        errorMessage: 'boom',
        errorStack: error.stack,
      });
      // No expone el objeto Error completo en el payload.
      expect(payload).not.toHaveProperty('error');
    });

    test('en producción deja pasar errores que no son instancias de Error', () => {
      setNodeEnv('production');

      logError('falló', 'motivo en texto');

      const [salida] = errorSpy.mock.calls[0];
      const payload = JSON.parse(salida as string);
      expect(payload.error).toBe('motivo en texto');
    });

    test('en desarrollo pasa el error original en el contexto', () => {
      setNodeEnv('development');
      const error = new Error('boom');

      logError('falló la operación', error);

      expect(errorSpy).toHaveBeenCalledWith(
        'falló la operación',
        expect.objectContaining({ error })
      );
    });
  });
});
