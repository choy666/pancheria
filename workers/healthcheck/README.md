# pancheria-healthcheck

Worker de Cloudflare que monitorea `GET /api/health` de producción cada
minuto (Cron Trigger). GitHub Actions tiene delays reales de horas en sus
schedules, así que la alerta minuto-a-minuto depende de este worker o de
un servicio externo equivalente (UptimeRobot, cron-job.org).

## Comportamiento

- 200 + `{ok: true, db: "up"}` → log `ok`, nada más.
- Cualquier otro caso → `console.error` (visible en la observabilidad de
  Workers) y, si existen los bindings `ALERT_URL` + `ALERT_TOKEN`, POST
  JSON al relay `/api/cron/alert` de la app (con `Authorization: Bearer
  ALERT_TOKEN`), que reenvía a ntfy como texto plano con headers
  `Title`/`Priority`/`Tags`/`Click`.

No se publica directo en ntfy.sh: las egress IPs de Cloudflare Workers
reciben HTTP 429 persistente (rate limit por IP compartida entre todos
los clientes de Workers). El relay corre en Vercel, cuya IP no está
limitada.

## Deploy

El worker se despliega también vía API de Cloudflare (MCP). Manual:

```bash
cd workers/healthcheck
npx wrangler deploy
```

## Configurar notificación

```bash
# ALERT_URL ya va en [vars] de wrangler.toml; el token es secret:
npx wrangler secret put ALERT_TOKEN --name pancheria-healthcheck
```

`ALERT_TOKEN` es el mismo valor que `CRON_SECRET` de producción (el relay
`/api/cron/alert` lo exige vía `withCronAuth`). El topic de ntfy y su
access token viven como env vars `NOTIFY_WEBHOOK_URL`/`NTFY_TOKEN` en
Vercel (los usa el relay) y como repository secrets en GitHub (los usa
`sanity-audit.yml`). El nombre del topic no se versiona (es
pseudo-secreto). Para recibir las alertas hay que suscribirse al topic en
la app/web de ntfy.

## Cambiar la URL monitoreada

Editar `[vars].HEALTHCHECK_URL` en `wrangler.toml` y redesplegar, o
actualizar el var por API.
