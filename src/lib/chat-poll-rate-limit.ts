/**
 * Limiter en memoria compartido por los GET de polling del chat público
 * (`/api/public/pedido/[id]/chat`) y su stream SSE (`.../chat/stream`): ambos
 * cumplen el mismo rol (descubrir mensajes nuevos) y comparten el bucket
 * `chat_poll` para que alternar endpoints no duplique el veto anti-abuso.
 */

import { createPollRateLimiter } from '@/lib/rate-limit';
import {
  getPublicPollRateLimitWindowMs,
  getPublicPollRateLimitMaxRequests,
} from '@/config/rate-limit';

export const isChatPollRateLimited = createPollRateLimiter(
  'chat_poll',
  getPublicPollRateLimitWindowMs(),
  getPublicPollRateLimitMaxRequests()
);
