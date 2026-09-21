/**
 * @jest-environment node
 *
 * `chat-poll-rate-limit.ts` lee la configuración al cargar el módulo, así que
 * las pruebas que necesitan otros valores usan `jest.resetModules()` +
 * `await import` con las variables de entorno ya definidas.
 */

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  jest.resetModules();
});

describe('chat-poll-rate-limit', () => {
  test('exporta el limiter compartido de polling del chat', async () => {
    const { isChatPollRateLimited } = await import('./chat-poll-rate-limit');

    expect(typeof isChatPollRateLimited).toBe('function');
  });

  test('en entorno de test no veta por defecto', async () => {
    const { isChatPollRateLimited } = await import('./chat-poll-rate-limit');

    expect(await isChatPollRateLimited('1.2.3.4')).toBe(false);
  });

  test('con el veto habilitado bloquea al superar el máximo de la ventana', async () => {
    process.env.E2E_ENABLE_RATE_LIMIT = 'true';
    process.env.PUBLIC_POLL_RATE_LIMIT_MAX_REQUESTS = '2';
    jest.resetModules();

    const { isChatPollRateLimited } = await import('./chat-poll-rate-limit');

    expect(await isChatPollRateLimited('1.2.3.4')).toBe(false);
    expect(await isChatPollRateLimited('1.2.3.4')).toBe(false);
    expect(await isChatPollRateLimited('1.2.3.4')).toBe(true);
    // El veto es por IP: otra dirección sigue permitida.
    expect(await isChatPollRateLimited('9.9.9.9')).toBe(false);
  });
});
