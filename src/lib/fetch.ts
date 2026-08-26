export class FetchTimeoutError extends Error {
  constructor(message = 'La solicitud excedió el tiempo de espera.') {
    super(message);
    this.name = 'FetchTimeoutError';
  }
}

export class FetchNetworkError extends Error {
  constructor(message = 'Error de red. Verificá tu conexión.') {
    super(message);
    this.name = 'FetchNetworkError';
  }
}

export class FetchAbortError extends Error {
  constructor(message = 'La solicitud fue cancelada.') {
    super(message);
    this.name = 'AbortError';
  }
}

export function getDefaultTimeoutMs(): number {
  const env = process.env.NEXT_PUBLIC_API_TIMEOUT_MS;
  if (!env) return 30_000;

  const parsed = Number(env);
  if (Number.isNaN(parsed) || parsed <= 0) return 30_000;

  return parsed;
}

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = getDefaultTimeoutMs()
): Promise<Response> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let timedOut = false;

  if (timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
  }

  const callerSignal = init?.signal;

  function handleCallerAbort() {
    controller.abort();
  }

  if (callerSignal) {
    if (callerSignal.aborted) {
      controller.abort();
    } else {
      callerSignal.addEventListener('abort', handleCallerAbort);
    }
  }

  try {
    const response = await fetch(input, {
      ...init,
      credentials: 'include',
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    const isAbort =
      typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      (error as Error).name === 'AbortError';

    if (isAbort) {
      if (timedOut) {
        throw new FetchTimeoutError();
      }
      throw new FetchAbortError();
    }

    if (error instanceof Error) {
      throw new FetchNetworkError(error.message);
    }

    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    if (callerSignal) {
      callerSignal.removeEventListener('abort', handleCallerAbort);
    }
  }
}
