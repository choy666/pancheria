import {
  authenticatedFetch,
  FetchTimeoutError,
  FetchNetworkError,
  FetchAbortError,
} from './fetch';

const TEST_URL = '/api/test';

function createAbortError() {
  return new DOMException('The operation was aborted.', 'AbortError');
}

function createFetchMock() {
  return jest.fn().mockImplementation((input, init?: RequestInit) => {
    return new Promise<Response>((resolve, reject) => {
      if (init?.signal?.aborted) {
        reject(createAbortError());
        return;
      }

      const onAbort = () => reject(createAbortError());
      init?.signal?.addEventListener('abort', onAbort);
    });
  });
}

describe('authenticatedFetch', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    jest.restoreAllMocks();
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  test('resuelve con la respuesta del fetch', async () => {
    const expected = new Response('ok', { status: 200 });
    global.fetch = jest.fn().mockResolvedValue(expected);

    const result = await authenticatedFetch(TEST_URL);

    expect(result).toBe(expected);
  });

  test('incluye credentials: include y respeta el resto del init', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response('ok'));

    await authenticatedFetch(TEST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ a: 1 }),
    });

    expect(global.fetch).toHaveBeenCalledWith(
      TEST_URL,
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ a: 1 }),
      })
    );
  });

  test('lanza FetchTimeoutError si el fetch supera el tiempo de espera', async () => {
    jest.useFakeTimers();
    global.fetch = createFetchMock();

    const promise = authenticatedFetch(TEST_URL, {}, 1000);

    jest.advanceTimersByTime(1001);

    await expect(promise).rejects.toBeInstanceOf(FetchTimeoutError);
  });

  test('respeta la señal de cancelación del llamador', async () => {
    global.fetch = createFetchMock();

    const callerController = new AbortController();
    callerController.abort();

    await expect(
      authenticatedFetch(TEST_URL, { signal: callerController.signal })
    ).rejects.toBeInstanceOf(FetchAbortError);
  });

  test('cancela el fetch si la señal del llamador se aborta durante la solicitud', async () => {
    global.fetch = createFetchMock();

    const callerController = new AbortController();
    const promise = authenticatedFetch(TEST_URL, {
      signal: callerController.signal,
    });

    callerController.abort();

    await expect(promise).rejects.toBeInstanceOf(FetchAbortError);
  });

  test('lanza FetchNetworkError cuando fetch falla por red', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(authenticatedFetch(TEST_URL)).rejects.toBeInstanceOf(
      FetchNetworkError
    );
  });
});
