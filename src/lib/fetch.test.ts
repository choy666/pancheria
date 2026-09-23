import {
  authenticatedFetch,
  getDefaultTimeoutMs,
  throwApiError,
  ApiError,
  FetchTimeoutError,
  FetchAbortError,
  FetchNetworkError,
} from './fetch';
import { routes } from '@/config/routes';

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

describe('throwApiError', () => {
  function jsonResponse(body: unknown, status = 400): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  test('lanza ApiError con el error del body y el status', async () => {
    const response = jsonResponse({ error: 'Stock insuficiente' }, 409);

    await expect(throwApiError(response, 'fallback')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Stock insuficiente',
      status: 409,
    });
  });

  test('usa el fallback cuando el body no es JSON', async () => {
    const response = new Response('no json', { status: 500 });

    await expect(throwApiError(response, 'fallback')).rejects.toMatchObject({
      message: 'fallback',
      status: 500,
    });
  });

  test('propaga code y productName del body', async () => {
    const response = jsonResponse(
      { error: 'Sin stock', code: 'OUT_OF_STOCK', productName: 'Pan' },
      409
    );

    await expect(throwApiError(response, 'fallback')).rejects.toMatchObject({
      code: 'OUT_OF_STOCK',
      productName: 'Pan',
    });
  });

  test('en servidor lanza ApiError con code BRANCH_REMOVED sin redirigir', async () => {
    // Este entorno de test corre sin `window` (jest-environment node).
    const response = jsonResponse(
      { error: 'La sucursal asignada ya no existe.', code: 'BRANCH_REMOVED' },
      403
    );

    await expect(throwApiError(response, 'fallback')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'La sucursal asignada ya no existe.',
      status: 403,
      code: 'BRANCH_REMOVED',
    });
  });

  test('en browser redirige a la página intermedia y lanza ApiError', async () => {
    const assign = jest.fn();
    const globalRef = globalThis as unknown as { window?: { location?: { assign?: jest.Mock } } };
    const originalWindow = globalRef.window;
    globalRef.window = { location: { assign } };
    try {
      const response = jsonResponse(
        { error: 'La sucursal asignada ya no existe.', code: 'BRANCH_REMOVED' },
        403
      );

      await expect(throwApiError(response, 'fallback')).rejects.toThrow(ApiError);
      expect(assign).toHaveBeenCalledWith(routes.sesionFinalizada);
    } finally {
      globalRef.window = originalWindow;
    }
  });

  test('en browser no redirige ante un 403 sin code BRANCH_REMOVED', async () => {
    const assign = jest.fn();
    const globalRef = globalThis as unknown as { window?: { location?: { assign?: jest.Mock } } };
    const originalWindow = globalRef.window;
    globalRef.window = { location: { assign } };
    try {
      const response = jsonResponse({ error: 'Sin permisos' }, 403);

      await expect(throwApiError(response, 'fallback')).rejects.toThrow(ApiError);
      expect(assign).not.toHaveBeenCalled();
    } finally {
      globalRef.window = originalWindow;
    }
  });
});
