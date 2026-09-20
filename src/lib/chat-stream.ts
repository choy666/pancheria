/**
 * Helper para endpoints SSE (Server-Sent Events) del chat de pedidos.
 *
 * El stream ejecuta un poll interno contra la base cada `intervalMs`, emite
 * comentarios heartbeat cada `heartbeatMs` para mantener viva la conexión
 * atravesando proxies, y se cierra al alcanzar `budgetMs` — siempre antes del
 * `maxDuration` de la función serverless — para que el cliente reconecte con
 * `Last-Event-ID` y no dependa de conexiones infinitas.
 */

import { logger } from '@/lib/logger';
import type {
  ChatStreamState,
  ChatStreamTick,
} from '@/application/services/chatService';
import type { OrderMessage } from '@/domain/types';

type SseEmit = (
  event: string,
  data: unknown,
  id?: string | number
) => void;

interface SseControl {
  /** Cierra el stream antes del presupuesto (p. ej. scope inválido). */
  close: () => void;
}

interface SseStreamOptions {
  /** `request.signal`: al abortarse (cliente desconectado) se frena todo. */
  signal: AbortSignal;
  /** Intervalo del poll interno contra la base. */
  intervalMs: number;
  /** Intervalo de los comentarios `: heartbeat`. */
  heartbeatMs: number;
  /** Presupuesto máximo de la conexión; al cumplirse el stream se cierra. */
  budgetMs: number;
  /** Emisión inicial (p. ej. el evento `state` con el estado del pedido). */
  onStart?: (emit: SseEmit) => void | Promise<void>;
  /** Trabajo de cada tick; decide qué emitir vía `emit`. */
  poll: (emit: SseEmit, control: SseControl) => Promise<void>;
}

function encodeEvent(
  encoder: TextEncoder,
  event: string,
  data: unknown,
  id?: string | number
): Uint8Array {
  // JSON.stringify nunca emite saltos de línea literales, así que el payload
  // cabe en una sola línea `data:`.
  const idLine = id === undefined ? '' : `id: ${id}\n`;
  return encoder.encode(`${idLine}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function createSseResponse(options: SseStreamOptions): Response {
  const { signal, intervalMs, heartbeatMs, budgetMs, onStart, poll } = options;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let polling = false;

      const safeEnqueue = (chunk: Uint8Array): boolean => {
        if (closed) return false;
        try {
          controller.enqueue(chunk);
          return true;
        } catch {
          closed = true;
          return false;
        }
      };

      const emit: SseEmit = (event, data, id) => {
        safeEnqueue(encodeEvent(encoder, event, data, id));
      };

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(pollTimer);
        clearInterval(heartbeatTimer);
        clearTimeout(budgetTimer);
        try {
          controller.close();
        } catch {
          // El controller ya estaba cerrado/cancelado.
        }
      };

      const control: SseControl = { close: cleanup };

      const runPoll = async () => {
        if (closed || polling) return;
        polling = true;
        try {
          await poll(emit, control);
        } catch (error) {
          logger.warn('Error en el poll interno del stream de chat', {
            error,
          });
        } finally {
          polling = false;
        }
      };

      const pollTimer = setInterval(() => {
        void runPoll();
      }, intervalMs);

      const heartbeatTimer = setInterval(() => {
        safeEnqueue(encoder.encode(': heartbeat\n\n'));
      }, heartbeatMs);

      const budgetTimer = setTimeout(cleanup, budgetMs);

      signal.addEventListener('abort', cleanup, { once: true });

      queueMicrotask(async () => {
        if (closed) return;
        try {
          await onStart?.(emit);
        } catch (error) {
          logger.warn('Error al iniciar el stream de chat', { error });
        }
        void runPoll();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Evita que proxies con buffering (nginx) retengan los eventos.
      'X-Accel-Buffering': 'no',
    },
  });
}

interface ChatStreamResponseOptions {
  signal: AbortSignal;
  /** Cursor inicial: `?after=` o el header `Last-Event-ID` de la reconexión. */
  after: number;
  intervalMs: number;
  heartbeatMs: number;
  budgetMs: number;
  /** Estado inicial ya validado por la ruta (404 si era `null`). */
  initialState: ChatStreamState;
  /**
   * Tick del poll interno: devuelve los mensajes con `id > cursor` y el
   * estado vigente, o `null` si el pedido salió del scope (cierra el stream).
   */
  fetchTick: (cursor: number) => Promise<ChatStreamTick | null>;
}

function lastMessageId(messages: OrderMessage[]): number {
  return messages.reduce((max, message) => Math.max(max, message.id), 0);
}

/**
 * Respuesta SSE del chat de un pedido. Emite:
 * - `event: state` con `{status, deliveryType, branchLocation, isExpired,
 *   expiresAt}` al conectar y `{status, isExpired}` cuando cambian.
 * - `event: messages` con `{messages}` e `id: <último id>` cuando llegan
 *   mensajes nuevos; el `id` alimenta `Last-Event-ID` en la reconexión.
 * - `: heartbeat` para mantener la conexión.
 *
 * El cierre por `budgetMs` hace que `EventSource` reconecte solo; el cierre
 * por scope inválido emite `event: error` antes de cerrar para que el cliente
 * caiga al polling REST.
 */
export function createChatStreamResponse(
  options: ChatStreamResponseOptions
): Response {
  const { signal, after, intervalMs, heartbeatMs, budgetMs, initialState, fetchTick } =
    options;

  let cursor = after;
  let lastStatus = initialState.status;
  let lastIsExpired = initialState.isExpired;

  return createSseResponse({
    signal,
    intervalMs,
    heartbeatMs,
    budgetMs,
    onStart: (emit) => {
      emit('state', initialState);
    },
    poll: async (emit, control) => {
      const tick = await fetchTick(cursor);

      if (!tick) {
        emit('error', { reason: 'Pedido fuera de scope o eliminado.' });
        control.close();
        return;
      }

      if (tick.messages.length > 0) {
        cursor = lastMessageId(tick.messages);
        emit('messages', { messages: tick.messages }, cursor);
      }

      if (tick.status !== lastStatus || tick.isExpired !== lastIsExpired) {
        lastStatus = tick.status;
        lastIsExpired = tick.isExpired;
        emit('state', {
          status: tick.status,
          isExpired: tick.isExpired,
        });
      }
    },
  });
}
