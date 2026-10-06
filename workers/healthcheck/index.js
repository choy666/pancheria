/**
 * Worker de monitoreo externo de Panchería.
 *
 * Corre con Cron Trigger (`* * * * *`, cada minuto) en Cloudflare y hace
 * GET a HEALTHCHECK_URL. Si la respuesta no es 200, `ok !== true` o
 * `db !== 'up`, loguea el fallo (visible con la API de observabilidad de
 * Cloudflare) y, si está definido el secret NOTIFY_WEBHOOK_URL, dispara
 * un POST con payload estilo Discord/Slack `{content: "..."}`.
 *
 * Variables:
 * - HEALTHCHECK_URL (var de texto en wrangler.toml o metadata del deploy).
 * - NOTIFY_WEBHOOK_URL (secret; `wrangler secret put` o API de secrets):
 *   URL de un topic de ntfy (https://ntfy.sh/<topic> o instancia propia).
 *   El body se envía como texto plano con headers Title/Priority/Tags/Click
 *   nativos de ntfy.
 * - NTFY_TOKEN (secret): access token de la cuenta ntfy para topics
 *   reservados; si existe se manda como `Authorization: Bearer`.
 *
 * Deploy manual equivalente: `npx wrangler deploy` desde este directorio.
 */

addEventListener('scheduled', (event) => {
  event.waitUntil(check());
});

async function check() {
  let status = 0;
  let body = null;
  let error = null;

  try {
    const response = await fetch(HEALTHCHECK_URL, {
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
    return;
  }

  const message = `Panchería healthcheck FALLO: status=${status} error=${error} body=${JSON.stringify(body)}`;
  console.error(message);

  if (typeof NOTIFY_WEBHOOK_URL !== 'undefined' && NOTIFY_WEBHOOK_URL) {
    const headers = {
      Title: 'Panchería caída',
      Priority: '5',
      Tags: 'rotating_light',
      Click: HEALTHCHECK_URL,
    };
    if (typeof NTFY_TOKEN !== 'undefined' && NTFY_TOKEN) {
      headers.Authorization = `Bearer ${NTFY_TOKEN}`;
    }
    await fetch(NOTIFY_WEBHOOK_URL, {
      method: 'POST',
      headers,
      body: message,
    }).catch(() => {});
  }
}
