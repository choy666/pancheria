/**
 * @jest-environment node
 */
import { createSseResponse, createChatStreamResponse } from './chat-stream';
import { logger } from './logger';
import type { ChatStreamState } from '@/application/services/chatService';
import type { OrderMessage } from '@/domain/types';

jest.mock('./logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

async function readAll(response: Response): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let output = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    output += decoder.decode(value);
  }
  return output;
}

function neverAborted(): AbortSignal {
  return new AbortController().signal;
}

function buildState(overrides: Partial<ChatStreamState> = {}): ChatStreamState {
  return {
    status: 'pending',
    deliveryType: 'pickup',
    branchLocation: null,
    isExpired: false,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    ...overrides,
  };
}

function buildMessage(id: number): OrderMessage {
  return { id, content: `msg-${id}` } as OrderMessage;
}

describe('createSseResponse', () => {
  test('emite el evento inicial, heartbeat y cierra al agotar el presupuesto', async () => {
    const response = createSseResponse({
      signal: neverAborted(),
      intervalMs: 20,
      heartbeatMs: 15,
      budgetMs: 60,
      onStart: (emit) => emit('state', { ok: true }),
      poll: async (emit) => emit('tick', { n: 1 }),
    });

    expect(response.headers.get('Content-Type')).toContain('text/event-stream');
    expect(response.headers.get('Cache-Control')).toContain('no-cache');

    const body = await readAll(response);
    expect(body).toContain('event: state\ndata: {"ok":true}');
    expect(body).toContain(': heartbeat');
    expect(body).toContain('event: tick');
  });

  test('se cierra al abortar la señal del request', async () => {
    const controller = new AbortController();
    const response = createSseResponse({
      signal: controller.signal,
      intervalMs: 10,
      heartbeatMs: 5_000,
      budgetMs: 60_000,
      poll: async () => {},
    });

    setTimeout(() => controller.abort(), 30);
    const body = await readAll(response);
    expect(body).not.toContain(': heartbeat');
  });

  test('loggea y continúa cuando el poll falla', async () => {
    const poll = jest
      .fn()
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValue(undefined);

    const response = createSseResponse({
      signal: neverAborted(),
      intervalMs: 10,
      heartbeatMs: 5_000,
      budgetMs: 45,
      poll,
    });

    await readAll(response);
    expect(logger.warn).toHaveBeenCalled();
    expect(poll.mock.calls.length).toBeGreaterThan(1);
  });
});

describe('createChatStreamResponse', () => {
  test('emite el estado inicial y los mensajes con cursor como id', async () => {
    const fetchTick = jest
      .fn()
      .mockResolvedValueOnce({
        messages: [buildMessage(5), buildMessage(7)],
        status: 'pending',
        isExpired: false,
      })
      .mockResolvedValue({ messages: [], status: 'pending', isExpired: false });

    const response = createChatStreamResponse({
      signal: neverAborted(),
      after: 2,
      intervalMs: 10,
      heartbeatMs: 5_000,
      budgetMs: 55,
      initialState: buildState(),
      fetchTick,
    });

    const body = await readAll(response);

    expect(fetchTick).toHaveBeenNthCalledWith(1, 2);
    expect(body).toContain('event: state');
    expect(body).toContain('"status":"pending"');
    expect(body).toContain('id: 7\nevent: messages');
    // El cursor avanza al último id emitido para el próximo tick.
    expect(fetchTick).toHaveBeenCalledWith(7);
  });

  test('emite `state` solo cuando cambia el estado o la expiración', async () => {
    const fetchTick = jest
      .fn()
      .mockResolvedValueOnce({ messages: [], status: 'pending', isExpired: false })
      .mockResolvedValueOnce({ messages: [], status: 'in_process', isExpired: false })
      .mockResolvedValue({ messages: [], status: 'in_process', isExpired: false });

    const response = createChatStreamResponse({
      signal: neverAborted(),
      after: 0,
      intervalMs: 10,
      heartbeatMs: 5_000,
      budgetMs: 75,
      initialState: buildState(),
      fetchTick,
    });

    const body = await readAll(response);
    const stateEvents = body.match(/event: state/g) ?? [];
    // 1 inicial + 1 por el cambio pending→in_process.
    expect(stateEvents).toHaveLength(2);
    expect(body).toContain('"status":"in_process"');
  });

  test('emite `error` y cierra cuando el pedido sale del scope', async () => {
    const fetchTick = jest.fn().mockResolvedValue(null);

    const response = createChatStreamResponse({
      signal: neverAborted(),
      after: 0,
      intervalMs: 10,
      heartbeatMs: 5_000,
      budgetMs: 60_000,
      initialState: buildState(),
      fetchTick,
    });

    const body = await readAll(response);
    expect(body).toContain('event: error');
    // El stream cerró por scope inválido, no por presupuesto: el tick corrió
    // una sola vez.
    expect(fetchTick).toHaveBeenCalledTimes(1);
  });
});
