# Checklist pre-push — Proyecto Panchería

Este documento resume las verificaciones que se deben ejecutar **antes de subir cambios a Git (`git push`)**, para evitar errores repetidos en el workflow de GitHub Actions.

## Verificaciones mínimas locales

Ejecutar en orden y confirmar que todas pasan:

1. `npm run lint`
2. `npx tsc --noEmit`
3. `npm test`
4. `npm run build`
5. `npm run knip`
6. Si se tocó `src/db/schema.ts`: `npx drizzle-kit generate` y commitear la migración generada en `drizzle/` junto con `drizzle/meta/`; verificar con `npx drizzle-kit check` que no haya drift.

> Si alguno falla, corregir antes de commitear. El CI ejecuta los mismos pasos y fallará en el primer error.

## Verificación E2E (solo con base descartable)

Correr únicamente si se tocaron tests, rutas API, autenticación, rate limit, caja o flujos críticos:

1. Asegurar que `.env.e2e` apunte a una base de datos descartable (nombre terminado en `test`, `e2e`, `testing`, `qa` o `staging`).
2. Ejecutar `npm run test:e2e`.
3. Confirmar que todos los tests pasan.

> **Nunca** correr E2E contra producción. `tests/e2e/global-setup.ts` trunca tablas y ejecuta el seed.

## Validaciones de GitHub Actions

Antes de hacer push, revisar mentalmente estos puntos si se editó `.github/workflows/ci.yml`, variables de entorno, rate limit, almacenamiento o scripts de inicio:

- [ ] Si se tocaron variables de rate limit de pedidos públicos, el workflow de E2E debe incluir:
  - `E2E_ENABLE_RATE_LIMIT=true`
  - `PUBLIC_ORDER_RATE_LIMIT_ENABLE_IN_DEV=true` (porque `next dev` fuerza `NODE_ENV=development`)
  - `PUBLIC_ORDER_RATE_LIMIT_MAX_REQUESTS=2` (para el test de rate limit)
  - `PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER=memory`
  - `TRUSTED_PROXY_IP_HEADER=X-Forwarded-For`
- [ ] `playwright.config.ts` pasa las mismas variables en `webServer.env` si se esperan en el servidor de E2E.
- [ ] Las variables de `.env.e2e.example` que el servidor de E2E necesita también están en el `env:` del job `e2e` de `ci.yml`: en CI no existe `.env.e2e`, así que sin eso aplica el default de producción (ej. `NEXT_PUBLIC_CATALOG_PAGE_SIZE=48` dejaba los productos de los tests fuera de la primera página del catálogo y rompía `product-card-*`).
- [ ] `.env.e2e.example` refleja las variables necesarias para reproducir el entorno localmente.
- [ ] Si se agregó una variable nueva, también se agregó en `AGENTS.md` y `.devin/informes/entornos.md` si aplica.
- [ ] Scripts inline con `node -e "..."` (comillas dobles): bash expande los backticks, `${}` y hasta las comillas de los comentarios JS como sustitución de comandos, mutilando el script (rompió el paso "Verificar secretos de E2E" con `SyntaxError`/`bad substitution` en todo el pipeline). Preferir heredoc con delimitador quoteado (`node - <<'EOF'`), donde bash no expande nada.
- [ ] No hay credenciales, secretos, URLs privadas ni `.env.*` commiteados por accidente.
- [ ] No se modificó `.github/workflows/ci.yml` solo para silenciar advertencias del IDE (ver `lecciones-aprendidas.md`, sección 12).

## Secretos de GitHub Actions y Vercel

Verificar que existan en **Settings → Secrets and variables → Actions** del repositorio:

- [ ] `E2E_DATABASE_URL` — URL con pooler de la base descartable para E2E.
- [ ] `E2E_DATABASE_URL_UNPOOLED` — URL sin pooler de la misma base.
- [ ] Solo si se activa el sharding de E2E (variable `E2E_SHARDS` con más de un shard, p. ej. `[1, 2]`): `E2E_DATABASE_URL_SHARD<N>` y `E2E_DATABASE_URL_SHARD<N>_UNPOOLED` para **cada** shard N ≥ 2. Cada shard necesita su propia base descartable porque `global-setup.ts` trunca todas las tablas; dos shards sobre la misma base se corrompen mutuamente.
- [ ] `NEXTAUTH_SECRET` — secreto de autenticación de al menos 32 bytes.
- [ ] `ADMIN_USERNAME` / `ADMIN_PASSWORD` — credenciales del administrador del seed.
- [ ] `CRON_SECRET` — token usado por `.github/workflows/expire-orders.yml` para llamar a `/api/cron/expire-orders`.

Verificar también en **Settings → Secrets and variables → Actions → Variables** (variables de repositorio, no secretos):

- [ ] `VERCEL_PRODUCTION_URL` — dominio de producción usado por `.github/workflows/expire-orders.yml` para construir la URL del cron. Si falta o queda desactualizada tras un cambio de dominio, el workflow falla (ver `informes/archivados/auditoria-deploy-vercel-2026-09-14.md`).

En **Vercel → Environment Variables → Production** debe existir:

- [ ] `CRON_SECRET` con el **mismo valor** que en GitHub Actions (el endpoint lo requiere para autorizar llamadas).
- [ ] `CRON_SECRET` no debe tener espacios, saltos de línea ni comillas al inicio o final, porque Vercel valida el header `Authorization` en build time.
- [ ] `NEXTAUTH_URL` (o `AUTH_URL`) apuntando al dominio real de producción.
- [ ] `NEXTAUTH_SECRET` (o `AUTH_SECRET`), una URL de base de datos (`DATABASE_URL`/`POSTGRES_URL`/`POSTGRES_PRISMA_URL`) y `STORAGE_PROVIDER` distinto de `local`.

> Si falta alguna de estas variables, el build de producción en Vercel **falla** en `next.config.ts` (`assertVercelProductionEnv`): es intencional para evitar deploys rotos. La validación solo corre cuando `VERCEL_ENV=production` y `CI=1`, por lo que no afecta builds locales ni el CI de GitHub.
>
> Nota: el cron `expire-orders` ya no vive en `vercel.json`; se dispara desde `.github/workflows/expire-orders.yml` cada 5 minutos.

## Revisión de diff

1. `git diff --stat` — confirmar que los archivos modificados son los esperados.
2. `git diff` — leer los cambios antes del commit.
3. `git status` — verificar que no quedan archivos sin trackear que deban incluirse.

## Consejos para evitar errores comunes de CI

- **No confiar solo en que el test pase localmente**: `next dev` cambia `NODE_ENV` a `development`. Algunas guardias de `NODE_ENV` solo se activan en CI si la variable correspondiente está definida.
- **Playwright `webServer` no hereda automáticamente todas las variables del job**: incluir en `webServer.env` cualquier variable que el servidor deba leer en runtime.
- **Los workflows de GitHub Actions reciben strings**: valores como `true` o `2` llegan como strings a `process.env`; el código compara con `'true'`.
- **El job de E2E usa `next dev`**: cualquier comportamiento condicionado por `NODE_ENV=development` o `NODE_ENV=test` debe verificarse en ambos modos.

## Problemas conocidos de tests y soluciones

### Race conditions en tests con `new Date()`

- **Problema**: Tests que dependen de `new Date()` o cálculos de tiempo pueden fallar por race conditions al cruzar cambios de minuto, segundo **o de día civil**: si los horarios se derivan con `getHours()`/`getDay()` de instantes relativos (`now ± N horas`), al correr cerca de medianoche los `HH:mm` resultantes pueden pertenecer al día anterior y quedar registrados bajo el `dayOfWeek` equivocado (los buffers de ±N horas no cubren este caso).
- **Solución**: Fijar el reloj con `jest.useFakeTimers({ now: new Date(año, mes, día, hora) })` usando un instante construido en hora local (determinista en cualquier timezone del runner), y definir los horarios con `dayOfWeek` y `HH:mm` explícitos por día civil.
- **Ejemplo**: En `src/application/services/cashRegisterService.test.ts`, los tests de estado de turno fijan el reloj a un miércoles 15:00 local y registran el turno de apertura bajo el `dayOfWeek` del día anterior (`(dayOfWeek + 6) % 7`).

### Locators de Playwright con múltiples coincidencias

- **Problema**: Locators como `getByRole('heading', { name: /Caja #\d+/ })` pueden encontrar múltiples elementos, violando el modo estricto de Playwright.
- **Solución**: Usar `.first()` para seleccionar explícitamente el primer elemento cuando se espera múltiples coincidencias.
- **Ejemplo**: En `tests/e2e/caja-aislamiento-y-trazabilidad.spec.ts`, el locator usa `.first()` para evitar errores por múltiples headings con el mismo patrón.

## Referencias

- `AGENTS.md` — comandos, variables de entorno y reglas generales.
- `.devin/informes/lecciones-aprendidas.md` — errores previos y decisiones técnicas.
- `.devin/informes/entornos.md` — configuración de entornos y credenciales.
- `.github/workflows/ci.yml` — definición del pipeline.
