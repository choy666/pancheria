import { NextRequest } from 'next/server';
import { withCronAuth } from '@/lib/cron-handler';

/**
 * Relay autenticado de alertas a ntfy.
 *
 * Motivo: las egress IPs de Cloudflare Workers están rate-limited en
 * ntfy.sh (HTTP 429 persistente), así que el worker `pancheria-healthcheck`
 * no puede publicar directo. Este endpoint recibe la alerta (Bearer
 * CRON_SECRET) y la reenvía desde la IP propia de Vercel, que no está
 * limitada.
 *
 * Configuración en el servidor:
 * - NOTIFY_WEBHOOK_URL — URL del topic ntfy (https://ntfy.sh/<topic>).
 *   Si no está definida responde `delivered: false` (nada que reenviar).
 * - NTFY_TOKEN — access token opcional de la cuenta ntfy (topics
 *   reservados); se reenvía como `Authorization: Bearer`.
 *
 * El payload aceptado se recorta defensivamente: el relay no es un pasante
 * arbitrario de requests, solo formatea el mensaje de alerta esperado.
 */
export const maxDuration = 15;

const MAX_TITLE = 120;
const MAX_MESSAGE = 4000;
const MAX_TAGS = 8;
const MAX_TAG_LENGTH = 24;
const MAX_CLICK = 500;

type AlertBody = {
  title?: unknown;
  message?: unknown;
  priority?: unknown;
  tags?: unknown;
  click?: unknown;
};

function asTrimmedString(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}

export const POST = withCronAuth('cron/alert', async (request: NextRequest) => {
  const body = (await request.json().catch(() => null)) as AlertBody | null;
  const message = body ? asTrimmedString(body.message, MAX_MESSAGE) : undefined;
  if (!message) {
    return { delivered: false, reason: 'message requerido' };
  }

  const url = asTrimmedString(process.env.NOTIFY_WEBHOOK_URL, MAX_CLICK);
  if (!url) {
    return { delivered: false, reason: 'NOTIFY_WEBHOOK_URL no configurada' };
  }

  const headers: Record<string, string> = {};
  const title = asTrimmedString(body?.title, MAX_TITLE);
  // Los headers HTTP son ASCII: un título con tildes/eñe llega como
  // mojibake ("Panchera"). Se codifica en RFC 2047 como pide ntfy.
  if (title) {
    headers.Title = /^[\x20-\x7E]*$/.test(title)
      ? title
      : `=?UTF-8?B?${Buffer.from(title, 'utf8').toString('base64')}?=`;
  }
  const priority = Number(body?.priority);
  if (Number.isInteger(priority) && priority >= 1 && priority <= 5) {
    headers.Priority = String(priority);
  }
  if (Array.isArray(body?.tags)) {
    const tags = body.tags
      .map((t) => asTrimmedString(t, MAX_TAG_LENGTH))
      .filter((t): t is string => Boolean(t))
      .slice(0, MAX_TAGS);
    if (tags.length > 0) headers.Tags = tags.join(',');
  }
  const click = asTrimmedString(body?.click, MAX_CLICK);
  if (click && click.startsWith('https://')) headers.Click = click;
  const token = asTrimmedString(process.env.NTFY_TOKEN, 500);
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: message,
    cache: 'no-store',
  });

  return {
    delivered: response.ok,
    upstreamStatus: response.status,
  };
});
