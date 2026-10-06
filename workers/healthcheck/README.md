# pancheria-healthcheck

Worker de Cloudflare que monitorea `GET /api/health` de producción cada
minuto (Cron Trigger). GitHub Actions tiene delays reales de horas en sus
schedules, así que la alerta minuto-a-minuto depende de este worker o de
un servicio externo equivalente (UptimeRobot, cron-job.org).

## Comportamiento

- 200 + `{ok: true, db: "up"}` → log `ok`, nada más.
- Cualquier otro caso → `console.error` (visible en la observabilidad de
  Workers) y, si existe el secret `NOTIFY_WEBHOOK_URL`, POST al topic de
  ntfy con texto plano y headers `Title`/`Priority`/`Tags`/`Click`. Con
  `NTFY_TOKEN` se agrega `Authorization: Bearer` para topics reservados.

## Deploy

El worker se despliega también vía API de Cloudflare (MCP). Manual:

```bash
cd workers/healthcheck
npx wrangler deploy
```

## Configurar notificación

```bash
npx wrangler secret put NOTIFY_WEBHOOK_URL --name pancheria-healthcheck
npx wrangler secret put NTFY_TOKEN --name pancheria-healthcheck
```

`NOTIFY_WEBHOOK_URL` es la URL del topic ntfy (`https://ntfy.sh/<topic>`)
y `NTFY_TOKEN` el access token de la cuenta ntfy. Mismos valores que los
repository secrets de GitHub usados por `sanity-audit.yml`. El nombre del
topic no se versiona (es pseudo-secreto): está en los secrets de GitHub y
del worker. Para recibir las alertas hay que suscribirse al topic en la
app/web de ntfy.

## Cambiar la URL monitoreada

Editar `[vars].HEALTHCHECK_URL` en `wrangler.toml` y redesplegar, o
actualizar el var por API.
