/**
 * Worker de monitoreo externo de Panchería.
 *
 * Corre con Cron Trigger (`* * * * *`, cada minuto) en Cloudflare y hace
 * GET a HEALTHCHECK_URL. Si la respuesta no es 200, `ok !== true` o
 * `db !== 'up'`, loguea el fallo (visible con la API de observabilidad de
 * Cloudflare) y, si están definidos ALERT_URL y ALERT_TOKEN, postea la
 * alerta al relay `/api/cron/alert` de la app, que la reenvía a ntfy.
 *
 * No publica directo en ntfy.sh: las egress IPs de Cloudflare Workers
 * reciben HTTP 429 persistente de ntfy (rate limit por IP compartida).
 * El relay sale desde la IP de Vercel, que no está limitada.
 *
 * Bindings:
 * - HEALTHCHECK_URL (plain_text; en wrangler.toml o metadata del deploy).
 * - ALERT_URL (plain_text): URL del endpoint relay
 *   (`https://<app>/api/cron/alert`).
 * - ALERT_TOKEN (secret_text): mismo valor que CRON_SECRET de producción;
 *   el relay lo exige como `Authorization: Bearer`.
 *
 * Deploy manual equivalente: `npx wrangler deploy` desde este directorio.
 */

const worker = {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(check(env));
  },
};

export default worker;

async function check(env) {
  let status = 0;
  let body = null;
  let error = null;

  try {
    const response = await fetch(env.HEALTHCHECK_URL, {
      cf: { cacheTtl: 0, cacheEverything: false },
    });
    status = response.status;
    body = await response.json().catch(() => null);
  } catch (e) {
    error = String(e);
  }

  const ok =
    !error && status === 200 && body && body.ok === true && body.db === 'up';
  if (ok) {
    console.log(`healthcheck ok status=${status}`);
    return { ok: true, status };
  }

  const message = `Panchería healthcheck FALLO: status=${status} error=${error} body=${JSON.stringify(body)}`;
  console.error(message);

  let notified = 'sin-config';
  if (env.ALERT_URL && env.ALERT_TOKEN) {
    try {
      const res = await fetch(env.ALERT_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${env.ALERT_TOKEN}`,
        },
        body: JSON.stringify({
          title: 'Panchería caída',
          message,
          priority: 5,
          tags: ['rotating_light'],
          click: env.HEALTHCHECK_URL,
        }),
      });
      notified = `http_${res.status}`;
    } catch (e) {
      notified = `fetch_error_${String(e)}`;
    }
  }
  return { ok: false, status, error, notified };
}
