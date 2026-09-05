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
- [ ] `.env.e2e.example` refleja las variables necesarias para reproducir el entorno localmente.
- [ ] Si se agregó una variable nueva, también se agregó en `AGENTS.md` y `.devin/informes/entornos.md` si aplica.
- [ ] No hay credenciales, secretos, URLs privadas ni `.env.*` commiteados por accidente.
- [ ] No se modificó `.github/workflows/ci.yml` solo para silenciar advertencias del IDE (ver `lecciones-aprendidas.md`, sección 11).

## Revisión de diff

1. `git diff --stat` — confirmar que los archivos modificados son los esperados.
2. `git diff` — leer los cambios antes del commit.
3. `git status` — verificar que no quedan archivos sin trackear que deban incluirse.

## Consejos para evitar errores comunes de CI

- **No confiar solo en que el test pase localmente**: `next dev` cambia `NODE_ENV` a `development`. Algunas guardias de `NODE_ENV` solo se activan en CI si la variable correspondiente está definida.
- **Playwright `webServer` no hereda automáticamente todas las variables del job**: incluir en `webServer.env` cualquier variable que el servidor deba leer en runtime.
- **Los workflows de GitHub Actions reciben strings**: valores como `true` o `2` llegan como strings a `process.env`; el código compara con `'true'`.
- **El job de E2E usa `next dev`**: cualquier comportamiento condicionado por `NODE_ENV=development` o `NODE_ENV=test` debe verificarse en ambos modos.

## Referencias

- `AGENTS.md` — comandos, variables de entorno y reglas generales.
- `.devin/informes/lecciones-aprendidas.md` — errores previos y decisiones técnicas.
- `.devin/informes/entornos.md` — configuración de entornos y credenciales.
- `.github/workflows/ci.yml` — definición del pipeline.
