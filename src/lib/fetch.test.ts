import {
  authenticatedFetch,
  getDefaultTimeoutMs,
  FetchTimeoutError,
  FetchAbortError,
  FetchNetworkError,
} from './fetch';

describe('getDefaultTimeoutMs', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('usa 30.000 ms por defecto', () => {
    delete process.env.NEXT_PUBLIC_API_TIMEOUT_MS;
    expect(getDefaultTimeoutMs()).toBe(30_000);
  });

  test('respeta NEXT_PUBLIC_API_TIMEOUT_MS', () => {
    process.env.NEXT_PUBLIC_API_TIMEOUT_MS = '100';
    expect(getDefaultTimeoutMs()).toBe(100);
  });

  test('ignora valores inválidos o negativos', () => {
    process.env.NEXT_PUBLIC_API_TIMEOUT_MS = 'abc';
    expect(getDefaultTimeoutMs()).toBe(30_000);
  });
});

describe('authenticatedFetch', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('llama a fetch con credentials include', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(new Response('ok'));

    await authenticatedFetch('/api/test');

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        credentials: 'include',
      })
    );
  });

  test('devuelve la respuesta exitosa', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(new Response('ok'));

    const response = await authenticatedFetch('/api/test');

    expect(response.status).toBe(200);
  });

  test('propaga la señal del caller', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(new Response('ok'));
    const controller = new AbortController();

    await authenticatedFetch('/api/test', { signal: controller.signal });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    );
  });

  test('lanza FetchAbortError cuando el caller aborta', async () => {
    const controller = new AbortController();
    (global.fetch as jest.Mock).mockImplementation(
      () =>
        new Promise((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        })
    );

    const promise = authenticatedFetch('/api/test', { signal: controller.signal });
    controller.abort();

    await expect(promise).rejects.toThrow(FetchAbortError);
  });

  test('lanza FetchTimeoutError cuando vence el timeout', async () => {
    (global.fetch as jest.Mock).mockImplementation(
      (_input: unknown, init?: { signal?: AbortSignal }) => {
        return new Promise((_, reject) => {
          const signal = init?.signal;
          if (!signal) {
            reject(new Error('No signal'));
            return;
          }
          if (signal.aborted) {
            reject(new DOMException('Aborted', 'AbortError'));
            return;
          }
          signal.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      }
    );

    await expect(authenticatedFetch('/api/test', {}, 50)).rejects.toThrow(
      FetchTimeoutError
    );
  });

  test('convierte errores de red en FetchNetworkError', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network failure'));

    await expect(authenticatedFetch('/api/test')).rejects.toThrow(FetchNetworkError);
  });
});
