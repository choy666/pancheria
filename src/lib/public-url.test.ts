/**
 * @jest-environment node
 */
import { logger } from './logger';

jest.mock('./logger', () => ({
  logger: {
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

const mockedLogger = logger as unknown as {
  warn: jest.Mock;
};

function clearEnv() {
  delete process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.NEXTAUTH_URL;
  delete process.env.HOST;
  delete process.env.PORT;
}

describe('getPublicBaseUrl en servidor', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    clearEnv();
    jest.resetModules();
    mockedLogger.warn.mockClear();
  });

  afterEach(() => {
    Object.assign(process.env, { NODE_ENV: originalNodeEnv });
  });

  test('usa NEXT_PUBLIC_APP_URL en servidor', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com/';

    const { getPublicBaseUrl } = await import('./public-url');

    expect(getPublicBaseUrl()).toBe('https://app.example.com');
  });

  test('usa NEXTAUTH_URL cuando no hay NEXT_PUBLIC_APP_URL', async () => {
    process.env.NEXTAUTH_URL = 'https://auth.example.com/';

    const { getPublicBaseUrl } = await import('./public-url');

    expect(getPublicBaseUrl()).toBe('https://auth.example.com');
  });

  test('NEXT_PUBLIC_APP_URL tiene prioridad sobre NEXTAUTH_URL', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com/';
    process.env.NEXTAUTH_URL = 'https://auth.example.com/';

    const { getPublicBaseUrl } = await import('./public-url');

    expect(getPublicBaseUrl()).toBe('https://app.example.com');
  });

  test('usa HOST y PORT cuando no hay URL base configurada', async () => {
    process.env.HOST = '0.0.0.0';
    process.env.PORT = '3001';

    const { getPublicBaseUrl } = await import('./public-url');

    expect(getPublicBaseUrl()).toBe('http://0.0.0.0:3001');
  });

  test('usa HOST con puerto 3000 por defecto', async () => {
    process.env.HOST = '127.0.0.1';

    const { getPublicBaseUrl } = await import('./public-url');

    expect(getPublicBaseUrl()).toBe('http://127.0.0.1:3000');
  });

  test('usa PORT con localhost por defecto', async () => {
    process.env.PORT = '4000';

    const { getPublicBaseUrl } = await import('./public-url');

    expect(getPublicBaseUrl()).toBe('http://localhost:4000');
  });

  test('lanza error en producción si no hay URL base', async () => {
    Object.assign(process.env, { NODE_ENV: 'production' });

    const { getPublicBaseUrl } = await import('./public-url');

    expect(() => getPublicBaseUrl()).toThrow(
      'No se configuró NEXT_PUBLIC_APP_URL o NEXTAUTH_URL'
    );
  });

  test('usa fallback de desarrollo si no hay URL base', async () => {
    Object.assign(process.env, { NODE_ENV: 'development' });

    const { getPublicBaseUrl } = await import('./public-url');

    expect(getPublicBaseUrl()).toBe('http://localhost:3000');
  });
});

describe('getPublicBaseUrl en navegador', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    clearEnv();
    jest.resetModules();
    mockedLogger.warn.mockClear();
  });

  afterEach(() => {
    Object.assign(process.env, { NODE_ENV: originalNodeEnv });
    // @ts-expect-error limpiar global window simulado
    delete global.window;
  });

  test('usa NEXT_PUBLIC_APP_URL en navegador', async () => {
    // @ts-expect-error simular entorno de navegador
    global.window = {};
    process.env.NEXT_PUBLIC_APP_URL = 'https://browser.example.com/';

    const { getPublicBaseUrl } = await import('./public-url');

    expect(getPublicBaseUrl()).toBe('https://browser.example.com');
  });

  test('ignora NEXTAUTH_URL en navegador', async () => {
    // @ts-expect-error simular entorno de navegador
    global.window = {};
    process.env.NEXTAUTH_URL = 'https://auth.example.com/';

    const { getPublicBaseUrl } = await import('./public-url');

    expect(getPublicBaseUrl()).toBe('http://localhost:3000');
  });

  test('lanza error en producción si no hay NEXT_PUBLIC_APP_URL en navegador', async () => {
    // @ts-expect-error simular entorno de navegador
    global.window = {};
    Object.assign(process.env, { NODE_ENV: 'production' });

    const { getPublicBaseUrl } = await import('./public-url');

    expect(() => getPublicBaseUrl()).toThrow(
      'No se configuró NEXT_PUBLIC_APP_URL'
    );
  });
});
