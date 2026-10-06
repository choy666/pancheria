# pancheria-healthcheck

Worker de Cloudflare que monitorea `GET /api/health` de producción cada
minuto (Cron Trigger). GitHub Actions tiene delays reales de horas en sus
schedules, así que la alerta minuto-a-minuto depende de este worker o de
un servicio externo equivalente (UptimeRobot, cron-job.org).

## Comportamiento

- 200 + `{ok: true, db: "up"}` → log `ok`, nada más.
- Cualquier otro caso → `console.error` (visible en la observabilidad de
  Workers) y, si existe el secret `NOTIFY_WEBHOOK_URL`, POST
  `{content: "<mensaje>"}` — formato compatible con incoming webhooks de
  Discord y Slack.

## Deploy

El worker se despliega también vía API de Cloudflare (MCP). Manual:

```bash
cd workers/healthcheck
npx wrangler deploy
```

## Configurar notificación

```bash
npx wrangler secret put NOTIFY_WEBHOOK_URL --name pancheria-healthcheck
```

Mismo valor que el repository secret `NOTIFY_WEBHOOK_URL` de GitHub si se
usa el mismo canal (Discord/Slack incoming webhook).

## Cambiar la URL monitoreada

Editar `[vars].HEALTHCHECK_URL` en `wrangler.toml` y redesplegar, o
actualizar el var por API.
