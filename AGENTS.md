# Notas para Agentes — Proyecto Panchería

## Idioma
Todas las explicaciones, comentarios y documentación deben estar en español.

## Seguridad
- No hardcodear credenciales, URLs de APIs ni parámetros sensibles en el código.
- Todos los valores sensibles deben provenir de variables de entorno o configuraciones dinámicas.

## Monitoreo en background
Cuando se deje un monitoreo en background (CI de GitHub Actions, deploys de Vercel, procesos largos), reproducir un sonido al finalizar para avisar al usuario — convención acordada: `powershell -c "(New-Object Media.SoundPlayer 'C:\Windows\Media\notify.wav').PlaySync()"` (×3). El monitoreo debe chequear `conclusion` por run ID (no solo `status`), porque la API puede reportar transitoriamente `completed` sin conclusión.

## Comandos principales

| Propósito                | Comando                                           |
| ------------------------ | ------------------------------------------------- |
| Instalar dependencias    | `npm install`                                     |
| Ejecutar en desarrollo   | `npm run dev`                                     |
| Compilar                 | `npm run build`                                   |
| Iniciar en producción    | `npm run start`                                   |
| Analizar bundle          | `npm run analyze` (bajo Turbopack no genera el reporte HTML; usar `npm run analyze:webpack` para generar los HTML en `.next/analyze/`) |
| Lint                     | `npm run lint`                                    |
| Tests unitarios          | `npm test`                                        |
| Verificación de tipos    | `npx tsc --noEmit`                                |
| Tests E2E                | `npm run test:e2e`                                |
| Tests de accesibilidad   | `npm run test:accessibility`                      |
| Código muerto            | `npm run knip`                                    |
| Generar migraciones      | `npx drizzle-kit generate`                        |
| Verificar consistencia de migraciones | `npx drizzle-kit check`                 |
| Aplicar migraciones      | `npx drizzle-kit migrate`                          |
| Registrar baseline de migraciones | `npx tsx scripts/drizzle-baseline.ts` (`TARGET_E2E=1` para la base E2E) |
| Empujar migraciones (sincronización directa) | `npx drizzle-kit push`               |
| Empujar migraciones en producción | Ver `.devin/informes/entornos.md`        |
| Ejecutar seed            | `npx tsx src/db/seeds.ts`                         |
| Cargar catálogo Panchería Popular | `npx tsx scripts/cargar-catalogo.ts --branch <id\|nombre>` (dry-run) · agregar `--apply` para escribir · datos en `scripts/data/catalogo-pancheria-popular.ts` |
| Cargar stock/min_stock en sucursal | `npx tsx scripts/cargar-stock.ts --branch <id\|nombre>` (dry-run) · `--apply` para escribir · datos en `scripts/data/stock-inicial.ts` (`quantity: 0` = pendiente, se omite) · movimientos `restock` auditados |
| Backfill snapshots de venta | `npx tsx scripts/backfill-sale-item-recipes.ts [--apply]` — reconstruye `sale_item_recipes` de ventas compuestas legacy con la receta vigente (one-off del finding `compound_sale_item_missing_snapshot`; idempotente por el `notExists`) |
| Normalizar flags de opcionales en recetas | `npx tsx scripts/normalizar-recetas-opcionales.ts [--apply]` — alinea `is_optional`/`selected_by_default`/`auto_discount` con el tipo del insumo (corrige filas legacy que `POST /api/recetas` rechaza con 400); dry-run por defecto, ver `auditoria-recetas-carrito-2026-10-15.md` |
| Re-encuadrar imágenes de productos | `npx tsx scripts/reencuadrar-imagenes-productos.ts --branch <id> --dir <carpeta-pngs> [--env .env.local] [--base-url <url>] [--apply]` — recorta el aire uniforme del fondo y republica en lienzo 16:9 (misma transformación que `src/lib/product-image-normalize.ts`) subiendo por el pipeline real de la API (login `ADMIN_*` + cookie `activeBranchId` + preparar → put → PUT producto, que verifica la firma y borra la imagen anterior); mapa nombre→archivo dentro del script; dry-run por defecto |

> **Atención:** `tests/e2e/global-setup.ts` trunca las tablas `products`, `recipes`, `sales`, `sale_items`, `orders`, `order_items`, `order_messages`, `stock_movements`, `cash_registers`, `public_order_rate_limits`, `login_attempts`, `videos`, `pantalla_items`, `pantalla_settings`, `menu_settings`, `users` y `branches` con `RESTART IDENTITY CASCADE` (las tablas hijas como `order_stock_reservations`, `sale_payments`, `sale_item_recipes` y `order_item_recipes` quedan cubiertas por el `CASCADE`), y re-ejecuta `src/db/seeds.ts`. No correr los tests E2E en una base de datos con datos reales.
>
> Para correr E2E de forma confiable se requiere una base de datos descartable, `ADMIN_USERNAME`/`ADMIN_PASSWORD` consistentes con el seed y que `AUTH_URL`/`NEXTAUTH_URL` apunten a `http://localhost:3000`. El `playwright.config.ts` y `scripts/dev-e2e.ts` cargan `.env.local` como base y luego `.env.e2e` con prioridad, asi que se recomienda copiar `.env.e2e.example` a `.env.e2e` y completar `DATABASE_URL` con una base descartable. **El nombre de la base para E2E debe terminar en `test`, `e2e`, `testing`, `qa` o `staging`, incluso si es local.** El `global-setup.ts` aborta si `DATABASE_URL` no es local o no cumple con ese patrón, salvo que `E2E_ALLOW_REMOTE_DB=true` esté explícitamente definido.
>
> Además, E2E requiere un secreto de autenticación válido (`AUTH_SECRET` o `NEXTAUTH_SECRET`) de al menos 32 bytes y las credenciales de administrador (`ADMIN_USERNAME`/`ADMIN_PASSWORD`). En GitHub Actions, `NEXTAUTH_SECRET`, `ADMIN_USERNAME` y `ADMIN_PASSWORD` deben configurarse como repository secrets; el workflow `.github/workflows/ci.yml` fallará de inmediato si faltan. El job de E2E usa una base de datos remota descartable de Neon, configurada a través de los repository secrets `E2E_DATABASE_URL` y `E2E_DATABASE_URL_UNPOOLED`. El nombre de la base debe terminar en `test`, `e2e`, `testing`, `qa` o `staging` para cumplir la validación de `tests/e2e/global-setup.ts`.
>
> El `webServer` de `playwright.config.ts` levanta `npm run dev:e2e`, que carga `.env.local` y luego `.env.e2e` con `dotenv` antes de iniciar Next.js, y espera a que `/api/caja/resumen` responda. `tests/e2e/global-setup.ts` realiza un `preheat` del servidor llamando las rutas críticas (chat, pedido público, catálogo, caja) antes de ejecutar los tests, para evitar timeouts en los primeros tests por compilación bajo Turbopack. También se puede levantar manualmente con `npm run dev:e2e` y correr `NO_WEB_SERVER=1 npx playwright test`; esto es necesario si `.env.local` apunta a producción o si se quiere reutilizar un servidor ya calentado. Como Playwright usa `reuseExistingServer: true`, un `next dev` ajeno que ocupe el puerto (p. ej. `npm run dev` con `.env.local`) sería reutilizado aunque sirva otra base de datos; para evitarlo, `dev:e2e` define la variable interna `E2E_SERVER_MARKER` (no configurarla en archivos `.env`), `next.config.ts` la emite como header `x-e2e-server` y `global-setup.ts` aborta si el servidor que responde no la tiene. Para ejecutar solo los tests de accesibilidad con axe-core, usar `npm run test:accessibility`.
>
> El job de E2E en CI soporta sharding opt-in: por defecto corre todo en un shard (`E2E_SHARDS` no definida o `[1]`). Para partir la suite hay que definir la repository variable `E2E_SHARDS` (p. ej. `[1, 2]`) y un par de secrets de base descartable **por shard** (`E2E_DATABASE_URL_SHARD<N>` / `E2E_DATABASE_URL_SHARD<N>_UNPOOLED` para N ≥ 2; el shard 1 sigue usando `E2E_DATABASE_URL`/`E2E_DATABASE_URL_UNPOOLED`). Cada shard necesita su propia base porque `global-setup.ts` trunca todas las tablas; dos shards sobre la misma base se corrompen mutuamente. Cada shard sube su `blob-report` como artifact y el job `e2e-report` lo consolida con `npx playwright merge-reports` en un HTML (`playwright-report`). Localmente también se puede correr `npx playwright test --shard=1/2` contra la misma base, pero solo tiene sentido en CI con bases separadas.
>
> La base E2E remota (`neondb_e2e` en el proyecto Neon `pancheria`) es **la misma** para CI (secrets `E2E_DATABASE_URL*`) y para el `.env.e2e` local, incluido el test-server de Playwright del IDE: el grupo `e2e-db-*` del workflow serializa solo jobs de CI entre sí, no procesos externos. Para cubrir eso, `global-setup.ts` toma un lock de corrida en la tabla `e2e_run_lock` (`tests/e2e/run-lock.ts`, creada con `CREATE TABLE IF NOT EXISTS`; es infra de tests, fuera del schema de drizzle a propósito) y `global-teardown.ts` lo libera al terminar. Una segunda corrida concurrente espera hasta `E2E_RUN_LOCK_WAIT_MINUTES` (default 30) y aborta con un mensaje que identifica al titular; un lock de una corrida muerta se toma igual pasados `E2E_RUN_LOCK_STALE_MINUTES` (default 45). `E2E_IGNORE_RUN_LOCK=1` lo omite (peligroso: solo diagnóstico). Antes de este lock, una corrida local durante el CI nocturno truncó `neondb_e2e` a mitad del run y produjo `ventas-historial` flaky + `videos` roto ("Sucursal con ID 5 no encontrado", `branch_removed`, sucursal por defecto renombrada al seed local).
>
> `npm run build` y el job `build` de CI no pasan `DATABASE_URL` porque las páginas públicas críticas (`/pedido`, `/pedido/[id]/chat`) usan `dynamic = 'force-dynamic'`; el build no consulta la base de datos durante la generación estática. Si en el futuro se agrega SSG que requiera DB, usar una URL de staging, nunca la productiva.
>
> El pipeline de CI tiene un gate inicial (`job cambios`) que calcula si el diff es solo documentación (`.md`, `.devin/`, `docs/`, `LICENSE`): en ese caso los demás jobs se saltan (un job saltado cuenta como éxito para checks requeridos). Además el workflow cancela el run anterior del mismo ref al llegar un push nuevo (`concurrency` a nivel workflow).
>
> En E2E el caché de servidor debe estar deshabilitado con `DATA_CACHE_REVALIDATE_S=0` (ya viene en `.env.e2e.example` y en el job de CI): los helpers de `tests/e2e/helpers.ts` mutan `branches` y `cash_registers` escribiendo directo en la base, por detrás de la app, así que ninguna ruta/action dispara la invalidación por tag y la capa serviría datos viejos.
>
> Los specs E2E comparten la misma base durante la corrida: cualquier inserción bulk (p. ej. para forzar paginación) debe limpiarse en `finally` — datos residuales desplazan filas en `/productos` y rompen specs posteriores por timeouts o selectores (lección de `auditoria-qa-2026-09-21.md` §11). Para llenar inputs controlados apenas se monta la página, usar `waitForHydratedInput(page, selector)` de `tests/e2e/helpers.ts`: un `fill()` previo a la hidratación se pierde en el primer re-render (se manifiesta en WebKit y dispositivos lentos).
>
> Existe un proyecto Playwright `webkit` opt-in para smoke tests cross-browser (no corre en la suite normal): `E2E_WEBKIT=1 npx playwright test <spec> --project=webkit` (requiere `npx playwright install webkit` la primera vez).
>
> Antes de subir cambios a Git, consultar `.devin/informes/checklist-pre-push.md` para evitar errores comunes de CI (lint, tipos, build, knip, variables de E2E, rate limit, etc.).
>
> **Migraciones:** todo cambio en `src/db/schema.ts` debe acompañarse de la migración generada con `npx drizzle-kit generate` y commiteada en `drizzle/`. Las bases de desarrollo y E2E tienen inicializado `drizzle.__drizzle_migrations`, por lo que `npx drizzle-kit migrate` es el flujo recomendado para aplicar cambios. `drizzle-kit push` desincroniza la base del historial commiteado y requiere TTY ante confirmaciones; si se usa, correr después `npx tsx scripts/drizzle-baseline.ts` para registrar la migración como aplicada. Además, tras un `git pull` que traiga cambios en `drizzle/`, correr `npx drizzle-kit migrate` para mantener la base local sincronizada con el código: el código nuevo puede referenciar columnas aún ausentes y fallar con errores 500 (`column ... does not exist`).

## Variables de entorno
Copiar `.env.example` a `.env.local` y completar:

- `DATABASE_URL` — URL de conexión a PostgreSQL (Neon). En Vercel Postgres equivale a `POSTGRES_URL` (pooled). El runtime también acepta `POSTGRES_URL` y `POSTGRES_PRISMA_URL` como fallback.
- `DATABASE_URL_UNPOOLED` — URL sin pooler para `drizzle-kit` (migraciones). En Vercel Postgres equivale a `POSTGRES_URL_NON_POOLING`.
- `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING` — aliases de Vercel Postgres; el código los prueba en orden si `DATABASE_URL`/`DATABASE_URL_UNPOOLED` no están definidos.
- `DATABASE_POOL_MAX` (opcional, **solo servidor**) — máximo de conexiones del pool de PostgreSQL por instancia (si no se define, se usa el default de la librería, ~10). Sirve para acotar la presión sobre Neon con múltiples instancias serverless.
- `DATABASE_CONNECTION_TIMEOUT_MS` (opcional, **solo servidor**) — timeout en milisegundos al establecer una conexión del pool (si no se define, se usa el default de la librería).
- `DATABASE_IDLE_TIMEOUT_MS` (opcional, **solo servidor**) — tiempo máximo en milisegundos de una conexión inactiva en el pool (si no se define, se usa el default de la librería).
- `NEXTAUTH_URL` — URL base de la app, por defecto `http://localhost:3000`. Se usa también para construir URLs públicas de videos en modo local si `NEXT_PUBLIC_APP_URL` no está definida. En NextAuth v5, si existe `AUTH_URL`, tiene prioridad sobre `NEXTAUTH_URL`; en ese caso `AUTH_URL` también debe coincidir con el dominio de producción.
- `AUTH_URL` (opcional) — URL de autenticación para NextAuth v5. Si se define, tiene prioridad sobre `NEXTAUTH_URL`. Debe coincidir con el dominio de producción; en desarrollo/tests suele ser `http://localhost:3000`.
- `NEXT_PUBLIC_APP_URL` (opcional) — URL pública base de la app. Si se define, tiene prioridad sobre `NEXTAUTH_URL` para URLs locales de videos y adjuntos de chat (`STORAGE_PROVIDER=local`).
- `HOST` / `PORT` (opcionales) — host y puerto para el fallback de desarrollo de `getPublicBaseUrl()` cuando no hay `NEXT_PUBLIC_APP_URL` ni `NEXTAUTH_URL`. Por defecto `localhost:3000`.
- `AUTH_SECRET` (opcional) — secreto preferido por NextAuth v5 para firmar sesiones. Si no se define, se usa `NEXTAUTH_SECRET` como compatibilidad. Debe tener al menos 32 bytes.
- `NEXTAUTH_SECRET` — secreto para sesiones de NextAuth (compatibilidad; Auth.js v5 prefiere `AUTH_SECRET`).
- `ADMIN_USERNAME` — usuario administrador inicial.
- `ADMIN_PASSWORD` — contraseña en texto plano; el seed la hashea con bcrypt.
- `DEFAULT_BRANCH_NAME` — nombre de la sucursal por defecto (usado por el seed). Obligatorio: sin fallback, el seed aborta si falta para no persistir un nombre inventado.
- `DEFAULT_BRANCH_ADDRESS` (opcional) — dirección de la sucursal por defecto (usado por el seed).
- `DEFAULT_BRANCH_PHONE` (opcional) — teléfono de la sucursal por defecto (usado por el seed; se guarda como el contacto "Principal" en `phones`).
- `DEFAULT_BRANCH_SOCIAL_LINKS` (opcional) — redes sociales de la sucursal por defecto en JSON `[{"network":"instagram","url":"..."}]`; redes válidas: `instagram`, `facebook`, `whatsapp`, `tiktok`, `x`, `otro`. La URL acepta también un handle (en `whatsapp`, un número).
- `DEFAULT_BRANCH_LOCATION` (opcional) — URL de ubicación de la sucursal por defecto (usado por el seed).
- `DEFAULT_BRANCH_OPENING_HOURS` (opcional) — horarios de apertura de la sucursal por defecto en JSON `[{"dayOfWeek":1,"open":"10:00","close":"22:00"}, ...]` (`dayOfWeek` 0=domingo … 6=sábado; un cierre menor que la apertura es un turno overnight). Si no se define, la sucursal nace **sin horarios** (se considera abierta siempre que haya caja abierta) y se cargan desde el panel. Un JSON o franjas inválidas abortan el seed.
- `NEXT_PUBLIC_BRANCH_TIMEZONE` (opcional) — zona horaria para calcular horarios de apertura de sucursales. Si no se define, se usa `America/Argentina/Buenos_Aires`.
- `NEW_BRANCH_NAME` (opcional) — nombre de una segunda sucursal a crear vía seed.
- `NEW_BRANCH_USERNAME` (opcional) — usuario de la segunda sucursal a crear vía seed.
- `NEW_BRANCH_PASSWORD` (opcional) — contraseña en texto plano del usuario de la segunda sucursal; el seed la hashea con bcrypt.
- `NEW_BRANCH_ADDRESS`, `NEW_BRANCH_PHONE`, `NEW_BRANCH_LOCATION`, `NEW_BRANCH_SOCIAL_LINKS`, `NEW_BRANCH_OPENING_HOURS` (opcionales) — datos de la segunda sucursal; `NEW_BRANCH_PHONE` se guarda como contacto "Principal" en `phones`, `NEW_BRANCH_SOCIAL_LINKS` usa el mismo formato JSON que `DEFAULT_BRANCH_SOCIAL_LINKS` y `NEW_BRANCH_OPENING_HOURS` el mismo que `DEFAULT_BRANCH_OPENING_HOURS` (si no se define, hereda los horarios de la sucursal por defecto).
- `NEXT_PUBLIC_CAJA_REFRESH_INTERVAL_MS` — intervalo de refresco del panel de caja en milisegundos (por defecto 5000 ms; mínimo recomendado 5000 ms).
- `CAJA_AUTO_CLOSE_HOURS` / `NEXT_PUBLIC_CAJA_AUTO_CLOSE_HOURS` (opcional) — horas de cierre automático de cajas abiertas. Por defecto el cierre automático está deshabilitado (`0`); cualquier valor positivo lo habilita y respeta el número de horas configurado. El valor resuelto en el servidor viaja en los payloads como `autoCloseHours` (`/api/caja/resumen`, `/api/panel/resumen` y el detalle SSR de caja); la variante `NEXT_PUBLIC_` solo actúa como fallback del cliente para payloads viejos, ya que `CAJA_AUTO_CLOSE_HOURS` no existe en el bundle del navegador.
- `CAJA_AUTO_CLOSED_BY` (opcional) — etiqueta del usuario que cierra cajas automáticamente (por defecto `Sistema`).
- `NEXT_PUBLIC_CAJA_CLOCK_INTERVAL_MS` (opcional) — intervalo del reloj de caja en milisegundos (por defecto 60000 ms; mínimo recomendado 10000 ms).
- `CAJA_DEFAULT_HISTORY_DAYS` (opcional, **solo servidor**) — días de historial de caja por defecto cuando la request no trae `start` (por defecto 30 días). Lo aplican las rutas `/api/caja/historial` y `/api/caja/eliminadas`; el cliente no envía el rango.
- `TRASH_RESTORE_BATCH_SIZE` (opcional, **solo servidor**) — cajas procesadas por transacción al vaciar la papelera (`/api/caja/eliminadas`, por defecto 20). Cada lote restaura el stock y borra las cajas en su propia transacción: un corte deja los lotes procesados intactos y la operación puede reintentarse.
- `CAJA_SUMMARY_PAGE_SIZE` (opcional, **solo servidor**) — ventas activas cargadas por página al calcular el resumen de una caja (por defecto 500; mínimo 50). Acota el pico de memoria del cierre/resumen con historiales grandes.
- `CAJA_OVERDUE_HOURS` (opcional, **solo servidor**) — umbral en horas del aviso "caja abierta hace mucho tiempo" para sucursales **sin** horarios configurados (por defecto 12). Con horarios configurados los avisos de caja se calculan contra los turnos vigentes en `getCashRegisterShiftStatus`/`resolveCashRegisterAlert` (`src/lib/cash-register-helpers.ts`): `fuera_de_horario` al terminar el turno (info, no bloquea) y `cierre_recomendado` cuando comienza el primer turno posterior a la apertura (warning). Los turnos overnight (`close < open`, ej. `20:00–02:00`) están soportados y el estado viaja calculado en el payload de `/api/caja/resumen` y `/api/panel/resumen` (`estadoTurno`, `alertaCaja`).
- `TRUSTED_PROXY_IP_HEADER` (opcional) — header confiable para obtener la IP real del cliente en rate limiting. Si no se define, en producción se usa el header `x-vercel-forwarded-for` y en desarrollo se usa `X-Forwarded-For` como fallback.
- `PUBLIC_RATE_LIMIT_TRUST_PRIVATE_IPS` (opcional) — si se define como `true`, permite usar `X-Forwarded-For` en producción cuando no hay proxy confiable configurado. Puede ser vulnerable a IP spoofing; usalo solo si un proxy sanitiza el header.
- `NEXT_PUBLIC_PEDIDO_REFETCH_INTERVAL_MS` (opcional) — intervalo de refresco del catálogo público en milisegundos (por defecto 30000 ms).
- `NEXT_PUBLIC_CATALOG_PAGE_SIZE` (opcional) — tamaño de página del catálogo público en `/pedido` (por defecto 48; el listado inicial se carga por SSR y el resto con el botón "Cargar más").
- `PUBLIC_CATALOG_CACHE_S_MAXAGE` / `PUBLIC_CATALOG_CACHE_SWR` (opcionales, **solo servidor**) — `s-maxage` y `stale-while-revalidate` en segundos del `Cache-Control` de `GET /api/public/catalogo` (por defecto 10 y 30; `0` en `s-maxage` deshabilita el header y cada request pega al origen).
- `PUBLIC_BRANCH_STATUS_CACHE_S_MAXAGE` / `PUBLIC_BRANCH_STATUS_CACHE_SWR` (opcionales, **solo servidor**) — ídem para `GET /api/public/sucursal/estado` (mismos valores por defecto). `GET /api/public/pantalla` y `GET /api/public/menu` en cambio usan `PUBLIC_CATALOG_CACHE_S_MAXAGE` / `PUBLIC_CATALOG_CACHE_SWR` (sus snapshots son mayormente catálogo).
- `NEXT_PUBLIC_PANTALLA_PRODUCTO_MS` (opcional) — duración de cada escena de producto de `/pantalla` en milisegundos (por defecto 6000; mínimo 1000).
- `NEXT_PUBLIC_PANTALLA_SUCURSAL_MS` (opcional) — duración de la escena de horarios/datos de la sucursal en milisegundos (por defecto 8000; mínimo 1000).
- `NEXT_PUBLIC_PANTALLA_QR_MS` (opcional) — duración de la escena final con el QR hacia `/pedido` en milisegundos (por defecto 12000; mínimo 1000).
- `NEXT_PUBLIC_PANTALLA_REFETCH_INTERVAL_MS` (opcional) — intervalo de refresco del snapshot de las pantallas kiosk `/pantalla` y `/menu` (catálogo + videos + estado de sucursal) en milisegundos (por defecto 120000; mínimo 10000).
- `NEXT_PUBLIC_PANTALLA_VIDEO_MAX_MS` (opcional) — watchdog de las escenas de video: si el elemento no dispara `ended`/`error` en este tiempo, la playlist avanza igual; con metadata conocida se reemplaza por duración + 5 s (por defecto 120000; mínimo 1000).
- `NEXT_PUBLIC_PANTALLA_MAX_PRODUCTOS` (opcional) — tope de productos del catálogo que entran a la playlist por ciclo, tomando los primeros del orden de grupos públicos: promos/combos (`compound`), bebidas, extras (`service`) (por defecto 15; mínimo 1).
- `NEXT_PUBLIC_MENU_PAGINA_MS` (opcional) — duración de cada página del menú digital `/menu` cuando el catálogo supera una pantalla y la grilla rota, en milisegundos (por defecto 12000; mínimo 1000). Es el default de sucursales sin fila en `menu_settings`; el valor efectivo se personaliza por sucursal desde `/pantalla-config`.
- `NEXT_PUBLIC_MENU_FILAS_PAGINA` (opcional) — presupuesto de filas por página del menú digital `/menu`: cada cabezal de categoría y cada fila de tarjetas (grilla de 4 columnas) consume 1 (por defecto 4; mínimo 1). Ídem: default para sucursales sin configurar.
- `DATA_CACHE_REVALIDATE_S` (opcional, **solo servidor**) — TTL en segundos del caché de servidor (`unstable_cache` en `src/lib/server-cache.ts`) para sucursales y la base del catálogo público (por defecto 60; `<= 0` deshabilita la capa entera). Las mutaciones de productos/sucursales invalidan los tags `branches`/`public-catalog` con `revalidateTag(tag, { expire: 0 })`; la disponibilidad, reservas y estado de caja no se cachean y se calculan en vivo.
- `NEXT_PUBLIC_PEDIDOS_REFRESH_INTERVAL_MS` (opcional) — intervalo de refresco del listado de pedidos del operador en milisegundos (deshabilitado por defecto; definir un valor mayor a 0 para habilitar; 0 lo deshabilita explícitamente).
- `NEXT_PUBLIC_DASHBOARD_REFRESH_INTERVAL_MS` (opcional) — intervalo de refresco del panel de control en milisegundos (por defecto 30000 ms; valores menores a 1000 ms se ajustan a 5000 ms).
- `NEXT_PUBLIC_API_TIMEOUT_MS` (opcional) — timeout por defecto para solicitudes al API desde el cliente en milisegundos (por defecto 30000 ms).
- `NEXT_PUBLIC_CHAT_REFRESH_INTERVAL_MS` (opcional) — intervalo de refresco del chat del pedido en milisegundos (por defecto 5000 ms).
- `NEXT_PUBLIC_CHAT_MAX_TEXT_LENGTH` (opcional) — longitud máxima de un mensaje de chat en caracteres (por defecto 1000).
- `NEXT_PUBLIC_CHAT_PAGE_SIZE` (opcional) — cantidad de mensajes de chat por página (por defecto 50; máximo 100).
- `PUBLIC_CHAT_RATE_LIMIT_WINDOW_MS` (opcional) — ventana del rate limit del chat en milisegundos (por defecto 60000 ms).
- `PUBLIC_CHAT_RATE_LIMIT_MAX_REQUESTS` (opcional) — cantidad máxima de mensajes de chat por IP en la ventana (por defecto 60).
- `NEXT_PUBLIC_CHAT_IMAGE_MAX_SIZE_MB` (opcional) — tamaño máximo de imagen en el chat en MB (por defecto 5).
- `NEXT_PUBLIC_CHAT_ALLOWED_IMAGE_MIME_TYPES` (opcional) — tipos MIME de imagen permitidos en el chat separados por coma (por defecto `image/jpeg,image/png,image/webp`).
- `CHAT_BRANCH_LOCATION_RATE_LIMIT_WINDOW_MS` (opcional) — ventana del rate limit de envío de ubicación de sucursal por chat en milisegundos (por defecto 60000 ms). Se aplica por `branchId` en `POST /api/pedidos/[id]/chat/ubicacion`.
- `CHAT_BRANCH_LOCATION_RATE_LIMIT_MAX_REQUESTS` (opcional) — cantidad máxima de envíos de ubicación de sucursal por ventana (por defecto 5).
- `NEXT_PUBLIC_CHAT_STREAM_ENABLED` (opcional) — si se define como `true`, los chats abiertos reciben mensajes por SSE (`GET /api/pedidos/[id]/chat/stream` del operador y `GET /api/public/pedido/[id]/chat/stream` del cliente) en lugar del poll de `NEXT_PUBLIC_CHAT_REFRESH_INTERVAL_MS`; ante cualquier falla el cliente vuelve al polling automáticamente. Spike de T13: en Vercel la conexión factura duración de función, evaluar costo antes de producción (`.devin/informes/archivados/spike-sse-chat-2026-09-19.md`).
- `CHAT_STREAM_INTERVAL_MS` (opcional, **solo servidor**) — intervalo del poll interno del endpoint SSE contra la base (por defecto 2000 ms; mínimo 500 ms, máximo 60000 ms). El parámetro `interval` de la URL del stream no puede bajar de este valor.
- `CHAT_STREAM_HEARTBEAT_MS` (opcional, **solo servidor**) — intervalo del comentario `: heartbeat` que mantiene viva la conexión SSE (por defecto 15000 ms; mínimo 1000 ms).
- `CHAT_STREAM_BUDGET_MS` (opcional, **solo servidor**) — presupuesto máximo de cada conexión SSE en milisegundos (por defecto 55000 ms; máximo 280000 ms). El stream cierra antes del `maxDuration` de la función y el cliente reconecta con `Last-Event-ID`.
- `CHAT_STREAM_MAX_PER_ORDER` / `CHAT_STREAM_MAX_PER_IP` (opcionales, **solo servidor**) — máximo de streams SSE abiertos a la vez por pedido (por defecto 3) y por IP (por defecto 20). Es un veto en memoria por instancia: por encima responde 429 y el cliente vuelve al polling.
- `PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER` (opcional) — proveedor del rate limit de creación de pedidos y del chat público: `memory` o `db` (PostgreSQL). En producción, si `DATABASE_URL` o `POSTGRES_URL` están definidas y no se especifica lo contrario, se usa `db`; en desarrollo/test y sin base de datos disponible, `memory`. `db` es recomendado para producción con múltiples instancias. Requiere la tabla `public_order_rate_limits` en el esquema.
- `PUBLIC_ORDER_RATE_LIMIT_WINDOW_MS` (opcional) — ventana del rate limit de creación de pedidos en milisegundos (por defecto 60000 ms).
- `PUBLIC_ORDER_RATE_LIMIT_MAX_REQUESTS` (opcional) — cantidad máxima de pedidos por IP en la ventana (por defecto 10).
- `PUBLIC_POLL_RATE_LIMIT_WINDOW_MS` / `PUBLIC_POLL_RATE_LIMIT_MAX_REQUESTS` (opcionales) — ventana en milisegundos y máximo de requests por IP del rate limit en memoria de los polls GET públicos (`GET /api/public/pedido/[id]/chat` y `GET /api/public/pedido/[id]/estado`). Es un veto anti-abuso por instancia que no escribe en la base (por defecto 60000 ms, mínimo 1000 ms, y 240 requests — tolera el poll de 5 s del chat con margen). Los POST y la creación de pedidos siguen usando el store `PUBLIC_ORDER_RATE_LIMIT_*`.
- `PUBLIC_ORDER_RATE_LIMIT_ENABLE_IN_DEV` (opcional) — si se define como `true`, activa el rate limit de pedidos en `NODE_ENV=development`. Por defecto está deshabilitado en desarrollo para evitar falsos positivos por la IP compartida de loopback (`127.0.0.1` / `::1`).
- `E2E_ENABLE_RATE_LIMIT` (opcional) — si se define como `true`, activa el rate limit de pedidos en `NODE_ENV=test` (usado por el suite de Playwright).
- `BASE_URL` (opcional) — URL base para Playwright (por defecto `http://localhost:3000`).
- `NO_WEB_SERVER` (opcional) — si se define como `1` u otro valor no vacío, deshabilita el `webServer` de Playwright para reutilizar un servidor ya levantado (`npm run dev:e2e`).
- `NO_GLOBAL_SETUP` (opcional) — si se define como `1` u otro valor no vacío, salta el truncate/seed/preheat de `tests/e2e/global-setup.ts` cuando el servidor y la base de datos ya están preparados. Las validaciones de entorno y del servidor (`x-e2e-server`) igualmente se ejecutan.
- `CRON_SECRET` (opcional) — secreto para proteger `GET /api/cron/rate-limit-cleanup`, `GET /api/cron/chat-attachments-cleanup`, `GET /api/cron/expire-orders` y `GET /api/cron/sanity-audit`. Si no se define, los endpoints rechazan todas las llamadas.

> Los schedules de los cron jobs en `vercel.json` (`/api/cron/rate-limit-cleanup` y `/api/cron/chat-attachments-cleanup`, `0 0 * * *` por defecto) no se leen de variables de entorno; si se quiere cambiar la frecuencia, editar `vercel.json` (o el cron externo correspondiente). El cron `/api/cron/expire-orders` se dispara desde `.github/workflows/expire-orders.yml` con schedule `*/5 * * * *` y también requiere `CRON_SECRET`. **Verificado 2026-09-19:** la cadencia real del schedule de GitHub Actions es de ~2–5 horas entre corridas (best-effort severo), no 5 minutos — un pedido `pending` tarda en expirar `max(ORDER_EXPIRATION_MS, cadencia real)`; además las lecturas principales (`trackOrder`, `getOrderById`, `getPendingOrders`, `getOrders`) expiran pendings vencidos en el momento (expiración lazy en `orderService`), así que un vencido no se muestra como vigente aunque el cron todavía no haya corrido.
>
> Las rutas de cron y las rutas pesadas (cierre de caja, vaciado de papelera de cajas y productos) exportan `maxDuration = 300`: el plan Hobby con Fluid Compute (default en proyectos creados desde 2025) permite hasta 300 s por función. Si el proyecto migra a otro plan, revisar el límite antes de subirlo.
- `ORDER_EXPIRATION_MS` (opcional) — tiempo en milisegundos antes de que un pedido `pending` se marque como cancelado (por defecto 3_600_000 ms = 1 hora; mínimo 60_000 ms). No libera stock; limpia pedidos viejos del panel al listar. Esta misma ventana cierra el **envío** de mensajes: vencida (`createdAt` + ese valor), ni el cliente ni el operador pueden enviar, en cualquier estado; además el cliente no escribe en pedidos `finished`/`cancelled`. La lectura del historial sigue disponible con el token (decisión de negocio vigente: pedidos aceptados o pagados tras 1 h no admiten mensajes).
- `EXPIRE_ORDERS_TIME_BUDGET_MS` (opcional, **solo servidor**) — presupuesto de tiempo de una corrida de expiración de pedidos (por defecto 240_000 ms; mínimo 5_000 ms). Al agotarse, el cron corta dejando el resto para la próxima invocación (la operación es reentrante) y loguea `expired`/`remaining`. Debe quedar por debajo del `maxDuration` de la ruta (300 s).
- `SANITY_AUDIT_STALE_PENDING_MAX_AGE_HOURS` (opcional, **solo servidor**) — umbral en horas para que un pedido `pending` vencido sin barrer se reporte como `warning` en `GET /api/cron/sanity-audit` (por defecto 24). El endpoint es de solo lectura: lo dispara `.github/workflows/sanity-audit.yml` una vez por día (`0 9 * * *`) y falla el job si hay hallazgos `critical`.
- `SANITY_AUDIT_SAMPLE_LIMIT` (opcional, **solo servidor**) — tope de filas de muestra por hallazgo en el reporte de `sanity-audit` (por defecto 50).
- `ORDER_MESSAGES_RETENTION_DAYS` (opcional, **solo servidor**) — retención en días de los mensajes de pedidos terminales (`finished`/`cancelled`). Si se define, el cron `chat-attachments-cleanup` borra los mensajes cuyo `createdAt` supere el período junto con sus archivos adjuntos del storage; si no se define, no se purgan mensajes. El mismo cron también elimina archivos huérfanos de `chat/`, `product-images/` y `videos/` en el storage configurado.
- `RATE_LIMIT_STORE_PROVIDER` (opcional) — proveedor de almacenamiento de intentos fallidos de login:
  - `memory`: en memoria (por defecto en desarrollo y en `NODE_ENV=test`).
  - `db`: en PostgreSQL usando la tabla `login_attempts` (por defecto en producción cuando `DATABASE_URL` o `POSTGRES_URL` están definidas; configurable explícitamente con `RATE_LIMIT_STORE_PROVIDER=db`).
- `LOGIN_RATE_LIMIT_MAX_ATTEMPTS` (opcional) — cantidad máxima de intentos fallidos de login por usuario antes del bloqueo temporal (por defecto 5).
- `LOGIN_RATE_LIMIT_WINDOW_MS` (opcional) — ventana del rate limit de login por usuario en milisegundos (por defecto 900000 ms = 15 minutos).
- `LOGIN_IP_RATE_LIMIT_MAX_ATTEMPTS` (opcional) — cantidad máxima de intentos fallidos de login por IP antes del bloqueo temporal (por defecto 20). Segundo límite anti password spraying que rota usernames; solo los fallos acumulan (un login exitoso no consume cuota). Si la IP del request no es confiablemente resoluble el límite se omite — el límite por usuario sigue activo. Comparte el store de `PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER` con scope `login_ip`.
- `LOGIN_IP_RATE_LIMIT_WINDOW_MS` (opcional) — ventana del rate limit de login por IP en milisegundos (por defecto 900000 ms = 15 minutos).
- `LOGIN_ATTEMPTS_RETENTION_MS` (opcional, **solo servidor**) — retención de la tabla `login_attempts` en milisegundos (por defecto 604800000 ms = 7 días). El cron `GET /api/cron/rate-limit-cleanup` borra los intentos cuyo `last_attempt` supere el período para acotar el crecimiento de la tabla.
- `SEED_RESET_ADMIN_PASSWORD` (opcional) — gate de seguridad del seed. El seed nunca pisa la contraseña de un administrador existente salvo `SEED_RESET_ADMIN_PASSWORD=1`, en cualquier entorno (un seed local apuntando a producción tampoco la pisa). Para resetear la password del admin correr el seed con esa variable; el global-setup de E2E la setea explícitamente.
- `SEED_SAMPLE_CATALOG` (opcional) — catálogo de ejemplo del seed, **apagado por defecto**. Con `SEED_SAMPLE_CATALOG=1` el seed siembra productos, servicios y promos de muestra con precios y stock literales (pensado para desarrollo y E2E: `.env.e2e.example` y el job de CI la definen). Nunca activarla contra una base de producción — los datos de ejemplo se persisten como productos reales de la sucursal.
- `NEXT_PUBLIC_CAST_RECEIVER_APP_ID` (opcional) — ID de la aplicación receptora de Google Cast (por defecto `CC1AD845`).
- `NEXT_PUBLIC_CAST_SENDER_SDK_URL` (opcional) — URL del SDK de Cast (por defecto `https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1`).
- `NEXT_PUBLIC_VIDEO_MAX_SIZE_MB` (opcional) — tamaño máximo de video en MB (por defecto 100 MB; descomentar en `.env.example` para sobrescribir).
- `NEXT_PUBLIC_VIDEO_ALLOWED_MIME_TYPES` (opcional) — tipos MIME permitidos separados por coma (por defecto `video/mp4,video/webm,video/ogg`).
- `STORAGE_PROVIDER` (opcional) — proveedor de almacenamiento de videos y adjuntos de chat: `local` (por defecto), `vercel-blob`, `s3` o `r2`. Se recomienda `vercel-blob` en desarrollo y producción si se usa `/videos` o chat con imágenes; requiere `BLOB_READ_WRITE_TOKEN`.
- `BLOB_READ_WRITE_TOKEN` — token de Vercel Blob, requerido si `STORAGE_PROVIDER=vercel-blob`.
- `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT` — credenciales de AWS S3, requeridas si `STORAGE_PROVIDER=s3`.
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_REGION` — credenciales de Cloudflare R2, requeridas si `STORAGE_PROVIDER=r2`.
- `LOCAL_STORAGE_PATH` (opcional) — ruta local base para almacenar videos, adjuntos de chat e imágenes de productos cuando `STORAGE_PROVIDER=local` (por defecto `tmp/videos`).
- `CHAT_LOCAL_STORAGE_PATH` (opcional) — ruta local específica para los adjuntos del chat; si no se define, usa `LOCAL_STORAGE_PATH` como fallback.
- `NEXT_PUBLIC_PRODUCT_IMAGE_MAX_SIZE_MB` (opcional) — tamaño máximo en MB de la imagen de producto/promo ya normalizada que llega al servidor (por defecto 5). El navegador acepta archivos originales de hasta 30 MB y los normaliza antes de subir.
- `NEXT_PUBLIC_PRODUCT_IMAGE_ALLOWED_MIME_TYPES` (opcional) — tipos MIME de imagen permitidos separados por coma (por defecto `image/jpeg,image/png,image/webp`).
- `PRODUCT_IMAGE_LOCAL_STORAGE_PATH` (opcional) — ruta local específica para imágenes de productos; si no se define, usa `LOCAL_STORAGE_PATH` como fallback (por defecto `tmp/videos/product-images`).
- `PRODUCT_IMAGE_ALLOWED_EXTERNAL_DOMAINS` (opcional) — dominios separados por coma cuyas imágenes externas heredadas siguen mostrándose en el catálogo. Las URLs externas nuevas no se aceptan (las imágenes se suben como archivo); vacía en producción, así que solo se muestran imágenes del storage. También se usa en `src/lib/csp-helpers.ts` para extender `img-src` en la CSP.
- `NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS` (opcional) — si se define como `true`, se inyecta el script de Vercel Web Analytics en todas las páginas. En desarrollo no envía datos aunque esté habilitado; también es necesario activar Web Analytics en el dashboard de Vercel.
- `NEXT_PUBLIC_MAPS_PROVIDER` (opcional) — proveedor de mapas para compartir ubicaciones por chat y para construir el embed a partir de coordenadas en `/pedido`: `openstreetmap` (por defecto), `google`, `waze` o `raw`. Las URLs de embed de Google (`/maps/embed`, `output=embed`) y de OSM (`/export/embed.html`) se embeben siempre, sin importar el proveedor configurado; Waze no ofrece embed público (la ubicación se muestra solo como enlace).
- `NEXT_PUBLIC_MAPS_BASE_URL` (opcional) — URL base personalizada del proveedor de mapas. Si se define, tiene prioridad sobre las URLs por defecto. Útil para usar un dominio propio o una instancia privada; para el mapa embebido debe exponer la ruta de embed del proveedor (p. ej. `/export/embed.html` en una instancia OSM). Su origen se agrega a `frame-src` de la CSP junto con los orígenes embebibles de Google y OpenStreetMap (`getMapsFrameOrigins` en `src/config/maps.ts`).

> **Convención de variables de entorno:** los parámetros de lógica de negocio se leen de variables de servidor (`X`) y su valor resuelto viaja en el payload del API; `NEXT_PUBLIC_*` solo se usa para lo que el cliente necesita de forma autónoma (intervalos de refresco, límites de UI, URLs públicas). No crear getters duales `X ?? NEXT_PUBLIC_X` nuevos: las variables sin prefijo no existen en el bundle del navegador y divergen del servidor. Excepción ya existente y documentada: `getAutoCloseHours` (fallback del cliente para payloads viejos sin `autoCloseHours`).

> **Geolocalización y HTTPS:** `navigator.geolocation` solo funciona en contextos seguros (`https://` o `http://localhost`). En desarrollo remoto sin HTTPS, el botón de "Compartir ubicación" del cliente no obtendrá la posición. Asegurate de usar `localhost`, HTTPS con certificado local o un túnel seguro (por ejemplo Cloudflare Tunnel) al probar geolocalización.

> **Importante:** para que el comportamiento sea idéntico en desarrollo y producción, `DATABASE_URL` debe apuntar a la misma base de datos (o a una réplica/branch de Neon) en ambos entornos. No dejar `DATABASE_URL` apuntando a `localhost` si no hay un PostgreSQL local corriendo; en ese caso usá el mismo URL de Neon que en Vercel.

### Variables con comportamiento distinto por entorno

Variables cuyo valor, default o comportamiento depende del entorno (detalle completo en `.devin/informes/entornos.md`):

- `NODE_ENV` — `test` silencia `logger` y usa cookie de sesión no-secure; `production` emite logs en JSON y endurece validaciones de runtime.
- `VERCEL_ENV` (inyectada por Vercel: `production`/`preview`/`development`) — cuando es `production`, `next.config.ts` **falla el build** si falta `CRON_SECRET`, `NEXTAUTH_URL`/`AUTH_URL`, `NEXTAUTH_SECRET`/`AUTH_SECRET`, una URL de base de datos, o si `STORAGE_PROVIDER=local`. En preview/development no aplica, así los builds locales y de CI no se rompen.
- `DATABASE_URL` / `POSTGRES_URL` / `POSTGRES_PRISMA_URL` — en Vercel vienen de la integración Neon (`POSTGRES_URL`, `POSTGRES_PRISMA_URL`); en local se usa `DATABASE_URL` con URL directa.
- `NEXTAUTH_URL` / `AUTH_URL` — producción debe apuntar al dominio real; en local y en CI se usa `http://localhost:3000`.
- `STORAGE_PROVIDER` — `local` solo es válido en desarrollo; en producción usar `vercel-blob`, `s3` o `r2` (rechazado en el build de Vercel producción).
- `NEXT_PUBLIC_APP_URL` — se setea por deploy en Vercel/CI; en local cae al fallback de `NEXTAUTH_URL`.
- `NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS` — solo tiene sentido en producción de Vercel; `ConditionalAnalytics` inyecta el script únicamente si está habilitado y el entorno es producción.
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — solo se usan en el seed y en E2E; no aplican a producción.
- `CRON_SECRET` y `VERCEL_PRODUCTION_URL` — se configuran en **GitHub** (secret y variable de repositorio) para los workflows `expire-orders.yml`, `uptime-probe.yml` y `sanity-audit.yml`; no son variables de entorno de Vercel, aunque `CRON_SECRET` también debe existir en Vercel producción porque los endpoints `/api/cron/*` lo validan en runtime.
- `PROBE_BRANCH_ID` — repository variable opcional de GitHub para `uptime-probe.yml`: si está definida, el probe también verifica `/api/public/sucursal/estado?branchId=` y `/api/public/catalogo?branchId=` de esa sucursal (actualmente `3`).
- `NOTIFY_WEBHOOK_URL` y `NTFY_TOKEN` — repository secrets de GitHub para `sanity-audit.yml` y env vars de Vercel para el relay `/api/cron/alert`. Si `NOTIFY_WEBHOOK_URL` está definido, el job de la auditoría publica el resumen de findings en el topic de ntfy indicado (POST con texto plano y headers `Title`/`Priority`/`Tags`/`Click` nativos de ntfy; la prioridad sube según severidad y `Click` abre el run). `NTFY_TOKEN` es el access token de la cuenta ntfy para topics reservados — si existe se manda como `Authorization: Bearer`. Para recibir las alertas hay que suscribirse al topic en la app/web de ntfy.

## Monitoreo y automatización de producción

- `.github/workflows/uptime-probe.yml` — probe read-only cada 15 min (`*/15` nominal; GitHub puede demorar schedules) sobre `/api/health` y `/api/public/catalogo`; con `PROBE_BRANCH_ID` agrega checks de la sucursal.
- `.github/workflows/sanity-audit.yml` — auditoría diaria (`0 9 * * *`, ~06:00 ART) de `GET /api/cron/sanity-audit`: guarda el JSON como artifact (30 días), falla el job si hay hallazgos `critical` y notifica por webhook si `NOTIFY_WEBHOOK_URL` está definido.
- `.github/workflows/expire-orders.yml` — expira pedidos `pending` vencidos (`*/5` nominal, cadencia real de horas; la expiración lazy de `orderService` cubre la corrección operativa).
- `ci.yml` — corre el pipeline completo (incluido E2E) también por schedule diario `0 6 * * *` (~03:00 ART) contra la base descartable de Neon; actúa como E2E nocturno y detecta drift de dependencias/infra.
- `workers/healthcheck/` — Worker de Cloudflare `pancheria-healthcheck` (cron `* * * * *`, cuenta `pancheria.workers.dev`) que monitorea `/api/health` de producción cada minuto: es el complemento de frecuencia real que GitHub Actions no puede garantizar. Código versionado en el repo; deploy por API de Cloudflare o `wrangler deploy`. Ante un fallo postea al relay propio `POST /api/cron/alert` (bindings `ALERT_URL` + `ALERT_TOKEN` = `CRON_SECRET` de producción), que reenvía a ntfy desde la IP de Vercel — el posteo directo a ntfy.sh recibe 429 persistente porque rate-limita las egress IPs compartidas de Workers; si los bindings no existen, el fallo queda solo en logs de Workers.
- `POST /api/cron/alert` — relay autenticado (`withCronAuth`) que reenvía alertas a `NOTIFY_WEBHOOK_URL`/`NTFY_TOKEN` configurados en Vercel. Recorta el payload defensivamente (title/message/tags/click acotados, click solo `https://`). Lo usa el worker de healthcheck; también sirve para otras alertas internas futuras.
- `.github/dependabot.yml` — PRs semanales de dependencias npm (devDependencies agrupadas) y de actions de GitHub.
- `PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER` / `RATE_LIMIT_STORE_PROVIDER` — en producción con `DATABASE_URL`/`POSTGRES_URL` definidas el default es `db`; en desarrollo/test el default es `memory`.

## Configuración del blueprint de Devin
- El blueprint para el snapshot de Devin vive en `.devin/environment.yaml`.
- Para subirlo a Devin Cloud se requiere autenticación con `devin.exe auth login` y un repositorio en GitHub.
- El flujo de DRS es:
  1. `devin.exe cloud drs blueprint-create --repo <owner/repo> --from-file .devin/environment.yaml`
  2. `devin.exe cloud drs build`

## Estructura del proyecto

- `src/app/` — páginas y rutas API
- `src/application/` — servicios de aplicación (casos de uso y coordinación), incluyendo `recipeService` para validación y gestión de recetas de promos.
- `src/repositories/` — capa de repositorios (`productRepository`, `saleRepository`, `cashRegisterRepository`, `orderRepository`, etc.)
- `src/db/` — esquema, conexión y seeds de Drizzle
- `src/components/` — componentes React
- `src/config/` — constantes de configuración (APIs, caja, catálogo, chat, pedidos, paginación, videos, imágenes de productos, rutas). En particular:
  - `src/config/routes.ts` centraliza las rutas de navegación de la UI.
  - `src/config/caja.ts` expone getters para las variables de entorno de caja.
  - `src/config/product-images.ts` expone getters para las variables de entorno de imágenes de productos.
- `src/domain/` — tipos y errores de dominio
- `src/hooks/` — hooks personalizados de React
- `src/lib/` — utilidades y helpers transversales:
  - `cn`, `json`, `money`, `date`, `catalog`, `product-grouping`, `product-style`, etc.
  - `storage` — almacenamiento de videos: `local`, `vercel-blob`, `s3`, `r2`.
  - `product-image-storage` y `product-image-upload-client` — subida, validación y resolución de imágenes de productos/promos usando el proveedor configurado en `STORAGE_PROVIDER`.
  - `chat-storage` — almacenamiento de adjuntos del chat, con `getChatLocalStorageBasePath()` y lectura segura vía `GET /api/chat/attachment/[key]`.
  - `public-url` — resolución de URLs públicas (`NEXT_PUBLIC_APP_URL`, `NEXTAUTH_URL`, `HOST`/`PORT`).
  - `api-handler` — wrapper `withApiErrorHandling` para rutas API.
  - `logger` — utilidad de logging.
  - `rate-limit` y `public-order-rate-limit-store` — rate limiting de pedidos públicos y chat (`PUBLIC_ORDER_RATE_LIMIT_*`, `PUBLIC_CHAT_RATE_LIMIT_*`).
  - `rate-limit-store` — almacenamiento de intentos fallidos de login (`RATE_LIMIT_STORE_PROVIDER`: `memory`/`db`).
  - `branch-resolver` — resolución de la sucursal activa para Server y Client Components.
  - `branch-helpers` — validación y cálculo de horarios de apertura (`NEXT_PUBLIC_BRANCH_TIMEZONE`).
  - `route-guard` — redirecciones de autenticación (`/` → `/pedido` sin sesión, `/login` → `/` con sesión).
  - `fetch` — wrapper `authenticatedFetch` y timeout configurable (`NEXT_PUBLIC_API_TIMEOUT_MS`).
  - `auth` — helpers de sesión, `getCurrentBranchId`/`getCurrentBranchIdOrRedirect`.
  - `with-auth.ts` — wrapper para endpoints autenticados que inyecta `session` y `branchId` en el handler.
  - `db-errors` — manejo centralizado de errores de conexión a PostgreSQL (`503`).
  - `summary-helpers` — cálculo de resúmenes de productos e insumos críticos.
  - `stock-helpers` — locks, iteración de recetas y razones de movimientos de stock.
  - `cash-register-helpers` — selección y bloqueo pesimista de cajas.
  - `product-helpers` — contexto de productos, disponibilidad y validaciones.
  - `sale-helpers` — construcción de ítems y totales de venta, incluyendo `recipeSnapshot` por ítem.
  - `order-helpers` — generación de números/tokens y construcción de pedidos, incluyendo snapshots de receta.
  - `validation-helpers` — validaciones reutilizables.

## Tecnologías
- Next.js 16.3.3, React 19.2.8, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM 0.45.2, PostgreSQL, NextAuth v5.

## Documentación de librerías (Context7 MCP)

- Para consultar documentación actualizada de una librería, framework, SDK o CLI usar el MCP `context7` (`resolve-library-id` + `query-docs`), con prioridad sobre `web_search`.
- Los IDs de Context7 del stack ya están pre-resueltos en `.devin/skills/context7-stack/SKILL.md`: consultar esa tabla y llamar `query-docs` directamente con el ID (y versión) correspondiente, sin repetir la resolución.
- Nunca enviar secretos, valores de `.env` ni código propietario en las queries de Context7: se transmiten a la API externa.

## Documentación de Google Maps Platform (MCP)

- El MCP `google-maps-platform-code-assist` (oficial de Google, endpoint remoto `https://mapscodeassist.googleapis.com/mcp`, sin API key) está configurado en `.devin/config.json` a nivel proyecto.
- Tools: `retrieve-instructions` (llamar **siempre primero**: carga las instrucciones del servidor) y `retrieve-google-maps-platform-docs` (busca en docs oficiales, code samples y repos de Google).
- Usarlo para cualquier consulta de Google Maps Platform: Maps Embed API, URLs de mapas, Places, Geocoding, Routes. Relevante para el proveedor `google` de `NEXT_PUBLIC_MAPS_PROVIDER`, `src/lib/maps.ts` (`buildMapEmbedUrl`) y los orígenes `frame-src` de la CSP (`getMapsFrameOrigins` en `src/config/maps.ts`).

## Grafo de conocimiento del código (Graphify MCP)

- El MCP `graphify` (endpoint hosteado `https://api.graphify.com/mcp`, OAuth — sin API key) consulta el grafo de conocimiento del repo indexado en [app.graphify.com](https://app.graphify.com): ~3.000 nodos / ~9.000 aristas / ~150 comunidades, **reindexado automáticamente en cada push a `main`**. Configurado en `.devin/mcp_config.json` (scope project, commiteado) y pre-aprobado en `.devin/config.json` (`mcp__graphify__*`).
- Autenticación por usuario: `devin mcp login graphify` (abre el browser; el token OAuth vive en `%APPDATA%\devin\mcp\oauth\`, nunca en el repo). Si una sesión reporta `Auth required`, correr `devin mcp logout graphify && devin mcp login graphify`.
- El workspace de Graphify tiene dos repos (`choy666/pancheria` y `choy666/camaras`): **pasar siempre `repository_id: "choy666/pancheria"`** en cada llamada (o consultar `list_repositories`/`list_workspaces` si falla).
- **Uso obligatorio al inicio de cada sesión de trabajo sobre este repo**: correr `graph_stats` (confirma frescura del índice) y orientarse con `query_graph`/`graphify_rank_files` antes de grepear o leer archivos en bloque — mejora el contexto y ahorra tokens. Si el MCP no responde o reporta `Auth required`, avisar al usuario y seguir con las herramientas habituales.
- Cuándo usarlo (complementa grep/lectura, no lo reemplaza):
  - **Orientación**: `graph_stats` (nodos, aristas, comunidades y `freshness` = commit indexado) al empezar un trabajo amplio; `graphify_rank_files` para los archivos más conectados (hoy `domain/types.ts`, `orderService.ts`, `errors.ts`, `tests/e2e/helpers.ts`, `cashRegisterService.ts`, `lib/auth.ts` — tocarlos tiene blast radius alto).
  - **Localizar código**: `query_graph` con `skeleton: true` + `budget` bajo para ubicar símbolos barato; sin `skeleton` devuelve cuerpos de definición con `file:line`.
  - **Impacto antes de refactorizar**: `graphify_callers` / `graphify_callees` / `graphify_impact` / `impact_and_risk`; `graphify_tests_for` para saber qué tests cubren un símbolo.
  - **Trazar conexiones**: `graphify_trace` (call chains dirigidas A→B), `shortest_path`, `graphify_references`, `graphify_node` (definición + vecinos), `graphify_expand` (expandir un nodo visto en skeleton).
  - **PRs/review**: `graphify_file_neighbors` e `impact_and_risk` sobre los archivos del diff.
- Caveats del grafo:
  - Aristas `INFERRED`/`AMBIGUOUS` son deducciones, no hechos: antes de refactorizar sobre ellas, verificar leyendo el archivo (`strict_calls: true` en `graphify_trace`/`graphify_node` limita a aristas resueltas).
  - `resolved: "semantic"` en una respuesta = match aproximado por similitud, no prueba de que el símbolo pedido existe.
  - `graphify_impact` está acotado a vecinos inmediatos; para alcance transitivo usar `graphify_trace` o `shortest_path`.
  - El índice describe el último commit pusheado (`graph_stats.freshness.commit`); con cambios locales sin push puede quedar desactualizado — en ese caso confiar en lectura directa.
  - `remember`/`memories_about`/`recall` gestionan notas durables en Graphify; usarlas solo si el usuario lo pide.

## Promos, recetas y snapshots

- El proyecto soporta promos (`compound`) con insumos críticos, manuales y servicios.
- Las recetas (`recipes`) definen qué insumos incluye cada promo, sus cantidades, si son opcionales y si vienen preseleccionados.
- Los insumos críticos con `autoDiscount: true` son obligatorios y son los únicos que descuentan stock.
- Los insumos manuales y servicios pueden ser opcionales; su precio y el de la promo no cambian al quitarlos.
- Cada venta y pedido persiste un snapshot de receta en `sale_item_recipes` y `order_item_recipes` para garantizar que futuras ediciones de recetas no afecten transacciones históricas.
- `PromoOptionsDialog` permite seleccionar complementos en el catálogo público y en el terminal de ventas.
- `orderService.createOrder` inserta un mensaje automático en el chat del pedido con el detalle de preparación de cada promo.
- El canal oficial de confirmación y detalle es el chat del pedido. La integración con WhatsApp fue eliminada por completo (código, variables `NEXT_PUBLIC_WHATSAPP_*` y enlaces `wa.me`).

## Videos, reproducción y Cast

El sistema permite subir, listar, reproducir y transmitir videos desde el panel (`/videos`). Soporta reproducción local y Google Cast mediante la Web Sender SDK.

- Rutas del panel: `/videos` (listado), `/videos/nuevo` (subida) y `/videos/[id]` (reproducción).
- Endpoints de API: `POST /api/videos/upload` y `GET /api/videos/[id]/stream`.
- La lógica de almacenamiento está centralizada en `src/lib/storage.ts` y soporta cuatro proveedores: `local`, `vercel-blob`, `s3` y `r2`.
- La configuración de videos y proveedores vive en `src/config/videos.ts`.
- En desarrollo, `STORAGE_PROVIDER=local` guarda los archivos en `LOCAL_STORAGE_PATH` (por defecto `tmp/videos`) y los sirve a través de `GET /api/videos/[id]/stream`.
- En producción se recomienda `vercel-blob`, `s3` o `r2`, configurando las credenciales correspondientes en variables de entorno.
- La tabla `videos` en `src/db/schema.ts` almacena metadatos, URL pública, tipo MIME, tamaño y soft delete.

## Pantalla publicitaria (`/pantalla`)

Ruta pública del route group `(kiosk)` (sin chrome de `(public)` ni del panel): una pantalla de sala de espera para Smart TV que rota en bucle videos activos, productos del catálogo con foto y precio, los horarios/estado de la sucursal y una escena final con QR hacia `/pedido?branchId=N`.

- SSR con el mismo patrón de `/pedido`: `?branchId=` opcional (cae a la sucursal por defecto y redirige a la URL canónica), `dynamic = 'force-dynamic'` y `Suspense` sobre el snapshot inicial.
- El snapshot (`src/lib/pantalla-snapshot.ts`, `buildPantallaSnapshot`) lo comparten el SSR y `GET /api/public/pantalla?branchId=` (el endpoint que el cliente consulta con `useVisibilityPolling` cada `NEXT_PUBLIC_PANTALLA_REFETCH_INTERVAL_MS`). Incluye el estado operativo con la misma semántica que `GET /api/public/sucursal/estado` (sin horarios configurados basta una caja abierta).
- La playlist (`buildPantallaPlaylist` en `src/lib/pantalla-playlist.ts`) intercala video/producto, ordena los productos por el agrupamiento público (`compound` primero), oculta los de `availability: 0` y cierra el ciclo con las escenas `branch` y `qr`. Las duraciones por tipo de escena se configuran con `NEXT_PUBLIC_PANTALLA_*_MS`; los videos duran lo que dura el archivo (`onEnded`) con un watchdog (`NEXT_PUBLIC_PANTALLA_VIDEO_MAX_MS`) por si el stream se cuelga.
- El QR usa `react-qr-code` y apunta a `NEXT_PUBLIC_APP_URL` si está definida; si no, al origen que sirve la pantalla (`window.location.origin`). En una TV real conviene definir `NEXT_PUBLIC_APP_URL` con el dominio público para que el QR sea alcanzable desde los celulares.
- **Pin a la URL, no a la cookie:** la pantalla sigue el `branchId` de su propia URL (el cliente pollea `?branchId=<snapshot.branch.id>`), nunca la cookie `activeBranchId` del panel. Una TV ya abierta no salta de sucursal aunque otro usuario cambie el selector del panel — por diseño, para operar una TV por local con pestañas simultáneas. El enlace del panel siempre refleja la sucursal seleccionada *al momento del click*.
- **Acceso desde el panel:** el header (`panel-header.tsx`) muestra un ícono `MonitorPlay` (desktop junto al `BranchSelector`, y dentro del menú mobile) que abre `/pantalla?branchId={activa}` en pestaña nueva; se deshabilita con aviso si la sucursal activa está inactiva y no se renderiza sin `activeBranchId` (nunca `/pantalla` pelado, que resuelve la sucursal *por defecto*). Además cada fila de `/sucursales` tiene el mismo acceso pineado a su propio `branchId` — la forma de fijar la TV de cada local sin escribir la querystring a mano.
- **Varias pantallas simultáneas:** con K TVs hay K requests por intervalo de refresco. El `s-maxage` del CDN (`PUBLIC_CATALOG_CACHE_S_*`) absorbe los hits dentro de la ventana, pero conviene no bajar `NEXT_PUBLIC_PANTALLA_REFETCH_INTERVAL_MS` del default (120 s): el mínimo configurable es 10 s y en serverless cada hit al origen factura duración de función.
- **Limitación timezone:** el reloj del chrome y los horarios de sucursal se calculan con `NEXT_PUBLIC_BRANCH_TIMEZONE`, una zona única global. Si alguna sucursal operara en otro huso, su pantalla mostraría hora y estado de apertura incorrectos (el negocio actual opera en un solo huso).
- **Limitación `STORAGE_PROVIDER=local`:** `GET /api/videos/[id]/stream` exige sesión de admin (`withAuth({ admin: true })`). Con provider `local`, las escenas de video solo se reproducen en un navegador con sesión de administrador (p. ej. la PC del local logueada); en una TV sin sesión el `<video>` falla y la playlist las salta vía `onError`/watchdog, rotando igual con catálogo, sucursal y QR. Para TVs sin login usar `vercel-blob`, `s3` o `r2` (URL pública directa).
- Las imágenes de producto pasan por `next/image` (`remotePatterns`/`localPatterns` ya contemplan los providers); el QR es SVG inline, sin recursos externos. La CSP existente (`media-src`/`img-src` incluye los orígenes del provider configurado) cubre la pantalla sin cambios.

## Menú digital (`/menu`)

Ruta pública del route group `(kiosk)` — la variante "menu board" de `/pantalla` (estilo las carteleras de Mostaza/BK detrás del mostrador): la carta completa en una grilla por categorías, con el QR de pedidos siempre visible. Complementaria a `/pantalla`, no la reemplaza: el carrusel captura atención con videos y un producto por escena; el menú sostiene la decisión de compra con la oferta entera a la vista.

- Mismo flujo que `/pantalla`: `?branchId=` opcional con redirect a la URL canónica (la resolución compartida está en `resolveKioskBranchId` de `src/lib/kiosk-branch.ts`, usada por ambas páginas), `dynamic = 'force-dynamic'`, `Suspense`, y pin a la URL (nunca a la cookie del panel).
- El snapshot propio (`src/lib/menu-snapshot.ts`, `buildMenuSnapshot`) trae sucursal + estado operativo + catálogo con disponibilidad + `settings` de la sucursal (sin videos ni playlist de `/pantalla` — el menú no las consume). Lo comparten el SSR y `GET /api/public/menu?branchId=`, que el cliente pollea cada `NEXT_PUBLIC_PANTALLA_REFETCH_INTERVAL_MS` con los headers `PUBLIC_CATALOG_CACHE_*`.
- Configuración por sucursal en `menu_settings` (espejo de `pantalla_settings`, servicio `src/application/services/menuService.ts`, repo `menuRepository.ts`): `pagina_ms`, `filas_pagina`, `show_qr_strip` (apaga la franja QR) y `hidden_product_ids` (productos vendibles ocultos en el tablero — la curaduría del menú; siguen vendiéndose por caja y por el pedido online). Sin fila valen los defaults `NEXT_PUBLIC_MENU_*`. Se edita desde `/pantalla-config` (sección "Menú digital", `MenuSettingsForm`), la misma página admin que configura el carrusel — los cambios aplican solos en el próximo poll de la TV.
- La paginación (`buildMenuPages` en `src/lib/menu-pages.ts`) filtra `availability <= 0` (la TV no anuncia lo que no se puede vender) y los `hiddenProductIds` del snapshot, ordena por el agrupamiento público y empaca grupos enteros con un presupuesto de "filas" (`settings.filasPagina`): cada cabezal de categoría y cada fila de la grilla de 4 columnas (`MENU_GRID_COLS`, sincronizado con `md:grid-cols-4` del board) consume 1. Una categoría que sola supera el presupuesto se parte con cabezal repetido. Con una sola página el menú queda estático; con varias rota cada `settings.paginaMs`.
- Reutiliza `PantallaChrome` (marca + estado + reloj), `PantallaSkeleton`/`PantallaError`, el keyframe `pantalla-scene-progress` y `getPedidoUrl` (`src/lib/pedido-url.ts`, la URL que también codifica la escena QR de `/pantalla`).
- La franja inferior `menu-qr-strip` mantiene el QR hacia `/pedido` siempre visible — la diferencia funcional clave respecto del ciclo de `/pantalla`, donde solo aparece una vez por vuelta.
- Accesos pineados: igual que `/pantalla`, el header del panel (`KioskLink` en `panel-header.tsx`, testid `menu-link`/`menu-link-mobile`, ícono `LayoutGrid`) y cada fila de `/sucursales` (`branch-menu-link-{id}`) abren `/menu?branchId=<id>` en pestaña nueva; nunca se emite la ruta pelada y con sucursal inactiva quedan deshabilitados.

## Imágenes de productos y promos

El sistema permite asociar una imagen ilustrativa a cada promo y a cada producto vendible al público, es decir bebidas y servicios (`products.imageUrl`, `imageKey`, `imageMimeType`, `imageSize`; la regla está en `isPublicSellableProduct`, `src/lib/catalog.ts`). Las imágenes son opcionales, no afectan stock, precio ni disponibilidad, y se muestran en el catálogo público (`/pedido`).

- El administrador sube un archivo desde el formulario de promo (`src/components/productos/promo-form.tsx`) o de producto (`product-form.tsx`, sección visible para bebidas y servicios, o cuando el producto ya tiene imagen). Ambos usan `product-image-uploader.tsx`, que muestra una vista previa igual a la tarjeta del catálogo y bloquea Guardar mientras haya un error de imagen o una normalización en curso.
- Antes de subir, el navegador normaliza la imagen (`src/lib/product-image-normalize.ts`): la decodifica respetando la orientación EXIF y la encuadra completa en un lienzo fijo de 1200×675 (16:9) con márgenes transparentes si la proporción original es otra; exporta WebP (q0.8) y, en navegadores que no lo soportan desde canvas, JPEG sobre fondo blanco como respaldo. La re-codificación elimina todos los metadatos del original (GPS, cámara). El archivo original puede pesar hasta 30 MB; la salida queda muy por debajo del límite del servidor. Si el original es más chico que el tamaño de salida (lado mayor < 800 px) se avisa que puede verse borrosa, sin bloquear.
- Al guardar, "quitar" (`none`) viaja en el POST/PUT del producto y `stored` no envía cambios. Un archivo (`upload`) se sube después con `persistProductImageUpload`, porque su key depende del id del producto. Si la subida falla tras crear el producto, reintentar actualiza ese mismo producto y no lo duplica. Con la sección oculta, un archivo pendiente se descarta sin tocar la imagen guardada (`imageToPersist`).
- Endpoints de API: `POST /api/productos/imagen/preparar` (devuelve instrucciones de subida), `POST /api/productos/imagen/upload` (solo `local`) y `GET /api/productos/imagen/[key]` (lectura pública).
- La lógica de almacenamiento y validación está en `src/lib/product-image-storage.ts` y `src/lib/product-image-upload-client.ts`, reutilizando el proveedor configurado en `STORAGE_PROVIDER` (`local`, `vercel-blob`, `s3`, `r2`).
- La configuración de tamaño, MIME, dominios permitidos y parámetros de normalización vive en `src/config/product-images.ts`.
- La CSP de `src/lib/csp-helpers.ts` (inyectada por `src/proxy.ts`) extiende `img-src` con los dominios de `PRODUCT_IMAGE_ALLOWED_EXTERNAL_DOMAINS` y con los orígenes de `vercel-blob`, `s3` o `r2` según el proveedor. También extiende `frame-src` con los orígenes de los proveedores de mapas con embed público —Google y OpenStreetMap, siempre, más el de `NEXT_PUBLIC_MAPS_BASE_URL`— (`getMapsFrameOrigins` en `src/config/maps.ts`) para el iframe del mapa embebido de `/pedido`; `buildMapEmbedUrl` (`src/lib/maps.ts`) solo devuelve URLs de esos mismos orígenes, y `buildMapViewUrl` traduce las URLs de embed a la página de mapa equivalente para los enlaces externos (una URL `/maps/embed?pb=…` abierta en pestaña muestra el error "Embed API must be used in an iframe").
- En producción se recomienda `vercel-blob`, `s3` o `r2`; `local` funciona en desarrollo pero pierde archivos en Vercel por el filesystem efímero.
- Las tarjetas del catálogo (`ProductCardImage`) usan `object-contain`: la foto se ve completa dentro del 16:9 de la tarjeta, sin recortes. Como la normalización ya publica todo en 1200×675, el catálogo recibe la imagen con el encuadre definitivo (márgenes transparentes sobre el degradado de marca).

## Despliegue en Vercel

### Opción A — deploy manual con Vercel CLI (recomendado para aprender)

1. Asegurate de tener `.env.local` completo con `DATABASE_URL`, `NEXTAUTH_SECRET`, `ADMIN_USERNAME` y `ADMIN_PASSWORD`.
2. Login en Vercel CLI:
   ```bash
   vercel login
   ```
3. Si el proyecto ya existe y tiene Framework Preset incorrecto o Deployment Protection activado, eliminarlo y recrearlo:
   ```bash
   vercel project remove <nombre-proyecto>
   Remove-Item -Path .vercel/project.json, .vercel/README.txt -Force
   vercel --prod --yes
   ```
   - El CLI detectará Next.js automáticamente y conectará el repositorio de GitHub si existe.
   - Anotá el dominio de producción asignado. Ese mismo valor debe usarse para `NEXTAUTH_URL` (o `AUTH_URL`, que tiene prioridad en NextAuth v5) en producción. No hardcodear el dominio en el código ni en la documentación; siempre obtenerlo de la configuración de Vercel.
4. Subir las variables de entorno a Vercel:
   ```bash
   $db = (Get-Content .env.local | Select-String '^DATABASE_URL=(.*)').Matches.Groups[1].Value; $db | vercel env add DATABASE_URL production
   $secret = (Get-Content .env.local | Select-String '^NEXTAUTH_SECRET=(.*)').Matches.Groups[1].Value; $secret | vercel env add NEXTAUTH_SECRET production
   $user = (Get-Content .env.local | Select-String '^ADMIN_USERNAME=(.*)').Matches.Groups[1].Value; $user | vercel env add ADMIN_USERNAME production
   $pass = (Get-Content .env.local | Select-String '^ADMIN_PASSWORD=(.*)').Matches.Groups[1].Value; $pass | vercel env add ADMIN_PASSWORD production
   echo "https://<dominio-produccion>.vercel.app" | vercel env add NEXTAUTH_URL production
   ```
5. Sincronizar la base de datos de producción:
   ```bash
   npx drizzle-kit push
   npx tsx src/db/seeds.ts
   ```
6. Redeployar para que las variables de entorno formen parte del build:
   ```bash
   vercel --prod --yes
   ```

### Notas importantes para futuros proyectos Next.js en Vercel

- Siempre verificar en `vercel inspect <url>` que `Builds` contenga funciones serverless (`λ`); si aparece `Framework Preset: Other`, el proyecto no detectó Next.js y no servirá las rutas del App Router. En ese caso, recrear el proyecto como se indica arriba.
- Si la URL muestra la pantalla de login de Vercel en lugar de la app, es porque **Vercel Authentication** (Deployment Protection) está activado. Deshabilitarlo desde el dashboard: **Settings → Deployment Protection → Vercel Authentication**.
- `NEXTAUTH_URL` debe coincidir con el dominio de producción asignado por Vercel (el alias del deployment, no la URL única generada).
- Con GitHub conectado, cualquier `push` a `main` genera un deploy automático y lo asigna al dominio de producción.

### Opción B — deploy automático desde GitHub
1. Conectar el repositorio de GitHub en el dashboard de Vercel.
2. Configurar las variables de entorno en Vercel.
3. Ejecutar `npx drizzle-kit push` y `npx tsx src/db/seeds.ts` en producción.
4. Hacer push a `main` para que Vercel haga el deploy automático.

## Testing

### Setup de tests

`jest.setup.ts` registra automáticamente `afterEach(cleanup)` de `@testing-library/react` para desmontar componentes y hooks entre tests. Esto evita actualizaciones de estado tardías y warnings de `act(...)`.

```ts
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';

afterEach(cleanup);
```

### Hooks con carga asíncrona

Todo hook que dispare `fetch` en `useEffect` debe:

1. Declarar una bandera `cancelled` o usar un `useRef` para saber si aún está montado.
2. No llamar `setState` si el componente ya se desmontó.
3. Retornar una función de cleanup que active la bandera.

Ejemplo con `useRef` (reutilizable en hooks expuestos fuera de un `useEffect`):

```ts
const isMountedRef = useRef(true);

useEffect(() => {
  isMountedRef.current = true;
  queueMicrotask(() => void load());
  return () => {
    isMountedRef.current = false;
  };
}, []);

async function load() {
  try {
    const data = await fetchData();
    if (!isMountedRef.current) return;
    setData(data);
  } catch (error) {
    if (!isMountedRef.current) return;
    setError(...);
  } finally {
    if (isMountedRef.current) setLoading(false);
  }
}
```

Ejemplo con bandera local dentro del `useEffect`:

```ts
useEffect(() => {
  let cancelled = false;

  async function load() {
    const data = await fetchData();
    if (cancelled) return;
    setData(data);
  }

  load();

  return () => {
    cancelled = true;
  };
}, []);
```

### Tests de hooks

- Si un hook inicia una carga asíncrona, el test debe esperar a que se estabilice con `waitFor`:
  ```ts
  const { result } = renderHook(() => useMyHook());
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  ```
- No dejar tests sincrónicos que terminen antes de que el `useEffect` asíncrono complete.
- Para eventos asíncronos, preferir `await act(async () => { ... })` o `userEvent` sobre `fireEvent` cuando sea posible.

## Troubleshooting

### El botón de Cast no se habilita en `/videos/[id]`

- Síntoma: en la página de detalle de un video el botón "Enviar a Cast" aparece deshabilitado o no detecta dispositivos.
- Causas comunes:
  - El Web Sender SDK de Google Cast requiere inicialización a través de `window.__onGCastApiAvailable` y los estados correctos de `cast.framework.CastState` y `cast.framework.SessionState`. Usar nombres de enum inexistentes (por ejemplo `CastState.AVAILABLE` o `SessionState.CONNECTED`) hace que el botón nunca se habilite.
  - Cast solo funciona en orígenes seguros: `localhost` o `https://`. Si se accede por IP local (`http://192.168.x.x:3000`) o sin HTTPS en producción, el navegador no expone la API de Cast.
  - Si no hay dispositivos Cast en la red, el SDK reporta `NO_DEVICES_AVAILABLE` y el botón se mantiene deshabilitado. Verificar que el dispositivo esté en la misma red y activo.
- Solución: mantener `src/hooks/useCast.ts` alineado con la documentación oficial: definir `window.__onGCastApiAvailable` antes de cargar el script, usar `CastState.NO_DEVICES_AVAILABLE` para decidir si hay dispositivos, y `SessionState.SESSION_STARTED`/`SESSION_RESUMED` para detectar sesión activa. En desarrollo usar `http://localhost:3000` o exponer el servidor con HTTPS (por ejemplo `ngrok`).

### Los videos subidos no se reproducen o desaparecen en producción

- Síntoma: un video o adjunto de chat se sube correctamente pero al intentar reproducirlo/descargarlo da `404`, o desaparece tras un nuevo deploy.
- Causa: `STORAGE_PROVIDER=local` guarda los archivos en el filesystem efímero de la función serverless (`tmp/videos` por defecto, o `CHAT_LOCAL_STORAGE_PATH`/`LOCAL_STORAGE_PATH` para chat). Entre invocaciones o deploys el archivo puede no estar disponible.
- Solución: en producción usar `STORAGE_PROVIDER=vercel-blob` (si ya se configuró `BLOB_READ_WRITE_TOKEN`), `s3` o `r2`, con las credenciales correspondientes. Re-desplegar para que la variable forme parte del build.

### Acceso a `/` no redirige como se espera

- Síntoma: sin sesión, `/` redirige al catálogo `/pedido` en lugar del panel, o muestra el panel, o `/login` no redirige al panel con sesión.
- Causa: el proyecto **sí tiene un proxy/middleware NextAuth activo** en `src/proxy.ts` (Next.js 16 renombró `middleware.ts` a `proxy.ts`; el archivo en `src/proxy.ts` es válido). `src/lib/route-guard.ts` se ejecuta a través del callback `authorized` de `src/auth.config.ts` dentro del proxy. Sin embargo, las redirecciones también están duplicadas en los Server Components:
  - `src/app/(panel)/layout.tsx` redirige a `/login` si no hay sesión.
  - `src/app/(auth)/login/page.tsx` redirige a `/` si ya hay sesión.
- Además, `src/lib/route-guard.ts` redirige `/` sin sesión a `/pedido`, mientras que `src/app/(panel)/layout.tsx` redirige `/` sin sesión a `/login`. Eso genera una inconsistencia si ambas capas se ejecutan.
- Solución: la redirección autoritaria es la del proxy (`src/proxy.ts` + `src/lib/route-guard.ts`). `src/app/(panel)/layout.tsx` y `src/app/(auth)/login/page.tsx` son redirecciones defensivas de fallback (el matcher del proxy excluye `/api`, `/_next/static`, `/_next/image`, `favicon.ico` y archivos `.svg`; aplica CSP a las rutas de UI y redirecciones de `route-guard`). No hace falta eliminarlas, pero sí documentar su rol. Verificar que `NEXTAUTH_URL`/`AUTH_URL` apunten al dominio de producción.

### Un asset público redirige a `/login`

- Síntoma: una imagen o archivo estático que debería verse sin sesión (catálogo, pantalla, login) responde con la página de login.
- Causa: el matcher de `src/proxy.ts` excluye `api`, `_next/static`, `_next/image`, `favicon.ico` y cualquier `.svg`, así que los SVG se sirven siempre. Cualquier otro asset sí pasa por la guardia: `isPublicPath` (`src/lib/route-guard.ts`) lo deja público solo si es un archivo suelto en la raíz de `public/` con extensión `png`, `ico`, `jpg` o `jpeg`. Un PNG anidado (p. ej. `public/img/promo.png`) o un `.webp` en la raíz redirige a `/login` sin sesión.
- Solución: moverlo a la raíz de `public/` con una de esas extensiones o ampliar la regla. El test "todo archivo de public/ es público" en `route-guard.test.ts` falla si queda un archivo que `isPublicPath` no reconoce.

### `ECONNREFUSED` al conectar con PostgreSQL en desarrollo

- Verificar que `DATABASE_URL` en `.env.local` no apunte a `localhost` si no hay un PostgreSQL local corriendo.
- Preferir usar la misma URL de Neon que en Vercel (`POSTGRES_URL`) para que dev y prod se comporten igual.
- Revisar `src/db/index.ts` para entender el orden de resolución: `DATABASE_URL` → `POSTGRES_URL` → `POSTGRES_PRISMA_URL`.
- Para migraciones, `drizzle.config.ts` usa `DATABASE_URL_UNPOOLED` → `POSTGRES_URL_NON_POOLING` → `DATABASE_URL` → `POSTGRES_URL`.

### Usuario bloqueado por intentos fallidos de login

- Síntoma: el login responde "Demasiados intentos fallidos" aunque la contraseña sea correcta.
- Causa: el bloqueo es por usuario (`LOGIN_RATE_LIMIT_MAX_ATTEMPTS`, 5 por defecto, dentro de `LOGIN_RATE_LIMIT_WINDOW_MS`, 15 minutos) y rechaza también la contraseña correcta mientras dura. Quien conozca el usuario puede mantenerlo bloqueado enviando 5 fallos por ventana, desde cualquier IP.
- Solución: esperar a que venza la ventana desde el último intento fallido, o borrar la fila del usuario en `login_attempts` de la base del entorno afectado (`DELETE FROM login_attempts WHERE username = '<usuario>';`). Confirmar el entorno antes de ejecutarlo: es una operación sobre datos reales.
- Si el bloqueo se repite, revisar si algún cliente o script insiste con esa cuenta. El límite por IP (`LOGIN_IP_RATE_LIMIT_MAX_ATTEMPTS`) frena a una sola IP, no a una red de IPs.
- Si aparece el log `Límite por IP de login inactivo`, el límite por IP no está activo: configurar `TRUSTED_PROXY_IP_HEADER` o desplegar en Vercel.

## Auditorías e informes

El directorio `.devin/informes` contiene la guía de lecciones aprendidas de las auditorías realizadas en el proyecto.

- Lecciones aprendidas: `.devin/informes/lecciones-aprendidas.md`
- Guía para escribir prompts: `.devin/prompts/README.md`

Antes de iniciar tareas de auditoría, refactorización, integridad de datos, configuración de entorno o escritura de prompts, consultar estos archivos para evitar regresiones documentadas.

## Chat de pedidos

Cada pedido `pending` dispone de un chat entre cliente y operador. Los mensajes se almacenan en `order_messages` y se asocian al token `cancellationToken` del pedido para el acceso público.

- Página pública: `/pedido/[id]/chat?token=...`.
- Panel: el chat se renderiza dentro del detalle del pedido (`/pedidos/[id]`); el listado (`/pedidos`) muestra `unreadCount` y puede hacer polling automático si se configura `NEXT_PUBLIC_PEDIDOS_REFRESH_INTERVAL_MS`; si no está configurada, el operador debe actualizar manualmente.
- Endpoints públicos:
  - `GET /api/public/pedido/[id]/chat` devuelve `{ messages, status }`; `status` permite al cliente saber si el operador confirmó o canceló el pedido mientras la pestaña sigue abierta.
  - `POST /api/public/pedido/[id]/chat` envía un mensaje de texto.
  - `POST /api/public/pedido/[id]/chat/leido` marca como leídos los mensajes del operador.
  - `POST /api/public/pedido/[id]/chat/upload` envía un mensaje con imagen.
- Endpoints del panel: equivalentes bajo `/api/pedidos/[id]/chat`, `/api/pedidos/[id]/chat/leido` y `/api/pedidos/[id]/chat/upload`.
- Adjuntos: soportan `STORAGE_PROVIDER=local`, `vercel-blob`, `s3` y `r2` a través de `src/lib/chat-storage.ts`. La key interna se guarda en `order_messages.attachmentKey`; las URLs públicas locales usan `NEXT_PUBLIC_APP_URL` o `NEXTAUTH_URL` como base y se sirven por `GET /api/chat/attachment/[key]`, sin exponer paths físicos.
- Refresco: `OrderChat` hace polling cada `NEXT_PUBLIC_CHAT_REFRESH_INTERVAL_MS` (por defecto 5000 ms), pausa el polling durante el envío de un mensaje para evitar condiciones de carrera, y dispara un poll inmediato al montar, en `pageshow` y en `visibilitychange`. En tests se puede pasar la prop `disablePollingOnMount` para evitar el poll inmediato sin ramificar el código por `NODE_ENV`.
- Paginación: el historial se carga por páginas de `NEXT_PUBLIC_CHAT_PAGE_SIZE` mensajes (por defecto 50; máximo 100) usando `before` y `after` como cursores. El botón "Cargar mensajes anteriores" trae mensajes previos preservando la posición del scroll.
- Body en POST: el cliente envía el contenido como JSON body. El upgrade a Next.js 16.3.3 resolvió el bug de `request.body === null` bajo `next dev` con Turbopack. Los handlers usan `request.json()` y no aceptan query params: si el body no es JSON válido, se parsea como objeto vacío y el mensaje se envía vacío. Ver <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/pedido/[id]/chat/route.ts" /> y <ref_file file="C:/developer/paginas/pancheria/src/app/api/pedidos/[id]/chat/route.ts" />.
- Backoff de errores: si un poll de mensajes nuevos falla, `OrderChat` duplica el tiempo de espera hasta un máximo de 8 veces el intervalo base (`NEXT_PUBLIC_CHAT_REFRESH_INTERVAL_MS`) para evitar saturar al servidor. El polling se retoma en el momento cuando el usuario vuelve a la pestaña (`visibilitychange` o `pageshow`).
- SSR de `/pedido/[id]/chat`: `dynamic = 'force-dynamic'` es suficiente para evitar cacheos de la página; no se requieren `unstable_noStore`, `revalidate = 0` ni `fetchCache = 'force-no-store'` adicionales.
- Rate limit del chat: `createRateLimiter` en `src/lib/rate-limit.ts` comparte el mismo store que el rate limit de pedidos públicos (`PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER`). La ventana y el máximo se configuran con `PUBLIC_CHAT_RATE_LIMIT_WINDOW_MS` y `PUBLIC_CHAT_RATE_LIMIT_MAX_REQUESTS`.
- Rate limit de ubicación de sucursal: `POST /api/pedidos/[id]/chat/ubicacion` aplica `createRateLimiter` por `branchId` para evitar spam de ubicaciones. La ventana y el máximo se configuran con `CHAT_BRANCH_LOCATION_RATE_LIMIT_WINDOW_MS` y `CHAT_BRANCH_LOCATION_RATE_LIMIT_MAX_REQUESTS` (por defecto 60 s y 5 envíos).
- Limpieza de adjuntos huérfanos: el cron `GET /api/cron/chat-attachments-cleanup` (configurado en `vercel.json` y protegido por `CRON_SECRET`) elimina archivos bajo el prefijo `chat/` que no tengan un `attachmentKey` asociado en `order_messages`.
- Compartir ubicación: el chat soporta compartir ubicaciones sin migrar el esquema.
  - Cliente con `delivery`: `OrderChat` muestra un botón que usa `navigator.geolocation` para obtener la posición y genera un enlace a mapas usando `src/lib/maps.ts`. El enlace se carga en el textarea para que el usuario lo revise y envíe manualmente.
  - Operador con `pickup`: si la sucursal tiene `branch.location` validada, `OrderChat` muestra un botón que envía la ubicación a través de `POST /api/pedidos/[id]/chat/ubicacion`, implementado en `chatService.sendBranchLocationMessage`.
  - Ambos flujos generan un mensaje de texto con una URL de mapas; `ChatMessageList` detecta URLs conocidas y las renderiza como enlaces "Ver ubicación" con `target="_blank"`.
  - `PedidoInfo` convierte la dirección de envío del cliente en un enlace de búsqueda de mapas.
  - El proveedor de mapas y la URL base se configuran con `NEXT_PUBLIC_MAPS_PROVIDER` y `NEXT_PUBLIC_MAPS_BASE_URL` (ver `.env.example`). Los valores por defecto usan dominios públicos (OpenStreetMap, Google Maps, Waze) y pueden sobrescribirse sin modificar el código.
  - `src/lib/maps.ts` valida URLs seguras (`http`/`https`), rechaza esquemas inseguros y acepta coordenadas en formato texto convertidas a URL.
- Variables relacionadas: `NEXT_PUBLIC_CHAT_REFRESH_INTERVAL_MS`, `NEXT_PUBLIC_CHAT_MAX_TEXT_LENGTH`, `NEXT_PUBLIC_CHAT_PAGE_SIZE`, `NEXT_PUBLIC_CHAT_IMAGE_MAX_SIZE_MB`, `NEXT_PUBLIC_CHAT_ALLOWED_IMAGE_MIME_TYPES`, `PUBLIC_CHAT_RATE_LIMIT_WINDOW_MS`, `PUBLIC_CHAT_RATE_LIMIT_MAX_REQUESTS`, `CHAT_BRANCH_LOCATION_RATE_LIMIT_WINDOW_MS`, `CHAT_BRANCH_LOCATION_RATE_LIMIT_MAX_REQUESTS`, `CRON_SECRET`, `LOCAL_STORAGE_PATH`, `CHAT_LOCAL_STORAGE_PATH`, `NEXT_PUBLIC_MAPS_PROVIDER`, `NEXT_PUBLIC_MAPS_BASE_URL`.
- La integración con WhatsApp fue eliminada; el chat del pedido es el único canal de comunicación con el cliente.

### Lineamientos para futuros chats

Para evitar duplicación de código al agregar nuevos canales de chat o extender el existente:

- Reutilizar `src/lib/rate-limit.ts` con un scope propio (por ejemplo, `chat:` o `support:`) en lugar de crear un nuevo sistema de rate limit.
- Reutilizar `src/lib/chat-storage.ts` para cualquier adjunto de imagen; no crear un storage paralelo. Si se requieren tipos de archivo distintos, extender los MIME y la validación de tamaño en `src/config/chat.ts`.
- Extender el esquema `order_messages` (o crear una tabla específica con el mismo patrón de columnas) en lugar de duplicar tablas de mensajes genéricas.
- Reutilizar `src/components/chat/order-chat.tsx` parametrizando `chatApiUrl`, `readApiUrl`, `uploadApiUrl`, `isClient` y `readOnly`.
- Seguir el flujo `chatService` → `orderMessageRepository` → endpoints API → componente `OrderChat`. No replicar la lógica de envío/lectura en componentes o páginas.

## Papelera de productos y videos

- Los productos y videos soportan soft delete (`deletedAt`, `isActive: false`) y restauración desde sus respectivas papeleras: `/productos/eliminados` y `/videos/eliminados`.
- El soft delete **no** debe borrar archivos asociados (imagen del producto, archivo de video) ni recetas; eso asegura que la restauración recupere el estado completo.
- El hard delete individual (`productService.permanentlyDeleteProduct`, `videoService.permanentlyDeleteVideo`) elimina la fila de la base de datos y luego libera el archivo con `deleteProductImage` o `deleteVideoFileByUrl`.
- `productService.permanentlyDeleteProduct` valida referencias históricas (`sale_items`, `order_items`, `sale_item_recipes`, `order_item_recipes`, `order_stock_reservations`, `stock_movements`, `recipes.supplyId`) y rechaza el borrado si existen. Las recetas de un producto compuesto se eliminan en cascada por la FK `recipes.compoundProductId`.
- `videoService.permanentlyDeleteVideo` requiere que el video esté en soft delete; los videos no tienen dependencias restrictivas.

## Cachés en memoria y rate limiting

- `RateLimitStore` (`src/lib/rate-limit-store.ts`) es un singleton accesible con `getRateLimitStore()`. Expone `remove(username)` para invalidar intentos fallidos de un usuario.
- `userService.deleteUser` y `branchService.deleteBranch` invocan `rateLimitStore.remove()` tras confirmar la eliminación en base de datos.
- `InMemoryPublicOrderRateLimitStore` (`src/lib/public-order-rate-limit-store.ts`) limpia entradas expiradas periódicamente dentro de `recordRequest`.
- En producción con múltiples instancias se recomienda `RATE_LIMIT_STORE_PROVIDER=db` y `PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER=db` para compartir el estado.

## Eliminación de sucursales y limpieza de recursos

- `src/application/services/branchService.ts` implementa `deleteBranch` como hard delete en una transacción. Elimina en cascada: recetas, `sale_items`, movimientos de stock, pedidos (`orders` con `order_items`, `order_messages`, `order_stock_reservations` y `order_item_recipes` por cascada), ventas (`sales` con `sale_payments` y `sale_item_recipes` por cascada), cajas, videos, productos, usuarios y finalmente la sucursal.
- Antes del commit, `deleteBranch` recolecta las claves de archivos asociados:
  - `products.imageKey` (imágenes de productos/promos).
  - `orderMessages.attachmentKey` (adjuntos de chat de los pedidos de la sucursal).
  - `videos.fileUrl` (videos de la sucursal).
- Inmediatamente después del commit se llaman `deleteProductImage`, `deleteChatAttachment` y `deleteVideoFileByUrl`, que soportan los proveedores `local`, `vercel-blob`, `s3` y `r2`.
- `src/lib/storage.ts` expone `deleteStorageFile` y `deleteVideoFileByUrl`; `src/lib/product-image-storage.ts` expone `deleteProductImage`; `src/lib/chat-storage.ts` expone `deleteChatAttachment`.
- La eliminación de sucursal **no conserva historial**. En cambio, el flujo diario de productos, cajas y videos usa soft delete (`deletedAt`) con papelera/restauración; los archivos no se liberan hasta que se elimine definitivamente la entidad o la sucursal.
- El cliente detecta sucursales eliminadas: `src/components/pedido/usePedidoClient.ts` limpia `pancheria-branch-id`, `pancheria-cart-v1`, pedidos recientes (`pancheria-recent-orders-v1`) y claves del tour asociadas a la sucursal inexistente.

## Consideraciones técnicas futuras

- `authService.ts` abstrae el almacenamiento de intentos fallidos mediante `RateLimitStore` (`src/lib/rate-limit-store.ts`). La implementación por defecto es `InMemoryRateLimitStore`. Para producción con múltiples instancias, usar `DbRateLimitStore` configurando `RATE_LIMIT_STORE_PROVIDER=db` (requiere la tabla `login_attempts`, ya existente en `src/db/schema.ts` y creada con la migración `0007_boring_scorpion.sql`).
- Los resúmenes de caja y cierre (`productsSummary`, `criticalSuppliesSummary`) ya se migraron a `jsonb` en `src/db/schema.ts` para aprovechar la validación nativa de PostgreSQL.
- El rate limit de pedidos públicos (`POST /api/public/pedido`) y del chat público soporta `PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER=db` para usar PostgreSQL como store compartida en producción con múltiples instancias. Ver la tabla `public_order_rate_limits` en `src/db/schema.ts`.
- Los adjuntos del chat almacenan `attachmentKey` en `order_messages`, lo que permite la limpieza periódica de archivos huérfanos mediante `GET /api/cron/chat-attachments-cleanup`. El cron debe reflejarse en `vercel.json` y protegerse con `CRON_SECRET`.
- `cashRegisters.closedBy` permanece como `varchar` y no como FK a `users`. El cierre automático usa el valor simbólico que devuelve `getAutoClosedBy()` en `src/config/caja.ts`. Si en el futuro se requiere trazabilidad estricta del usuario que cierra, se evaluará agregar un campo `closedByUserId` nullable manteniendo `closedBy` como label legible.

## Bases de datos y entornos

Para operar con bases de datos seguir las reglas de `.devin/informes/entornos.md`. A continuación el resumen operativo para agentes:

### 1. Identificar la URL de cada entorno

| Entorno | Archivo / Origen | Variable clave | Cómo leerla |
|---|---|---|---|
| Desarrollo local | `.env.local` | `DATABASE_URL_UNPOOLED` | `Get-Content .env.local \| Where-Object { $_ -match '^DATABASE_URL_UNPOOLED=' }` |
| Producción | Vercel (descarga temporal) | `DATABASE_URL_UNPOOLED` | `npx vercel env pull .env.production.local --environment=production` |
| E2E / Playwright | `.env.e2e` | `DATABASE_URL` | `Get-Content .env.e2e \| Where-Object { $_ -match '^DATABASE_URL=' }` |

> El runtime acepta como fallback `POSTGRES_URL`, `POSTGRES_PRISMA_URL` y `POSTGRES_URL_NON_POOLING`. El nombre de la base para E2E **debe terminar en `test`, `e2e`, `testing`, `qa` o `staging`**.

### 2. Aplicar migraciones

- Desarrollo: `npx drizzle-kit push` (usar `--force` si pide confirmación por `data-loss`).
- Producción: ver el paso a paso en `.devin/informes/entornos.md` usando `npx vercel env pull`.
- E2E: `tests/e2e/global-setup.ts` maneja el esquema; no usar `npx drizzle-kit push` manualmente salvo que se esté preparando la base por primera vez.

### 3. Correr Playwright

```powershell
npm run test:e2e
```

Para depurar sin levantar el servidor desde Playwright:

```powershell
npm run dev:e2e
$env:NO_WEB_SERVER = 1
npx playwright test
```

Playwright y `dev-e2e` cargan `.env.local` primero y luego `.env.e2e` con prioridad.

### 4. Variables obligatorias por entorno

- Desarrollo y producción: `DATABASE_URL`, `DATABASE_URL_UNPOOLED` (o sus alias de Vercel), `AUTH_SECRET` o `NEXTAUTH_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`.
- E2E: `DATABASE_URL` (base descartable), `AUTH_SECRET` o `NEXTAUTH_SECRET`, `AUTH_URL` y `NEXTAUTH_URL`=`http://localhost:3000`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`.

### 5. Reglas de seguridad

- Nunca correr `npm run test:e2e` contra producción, desarrollo o cualquier base con datos reales.
- Nunca hardcodear URLs de base de datos, credenciales ni secretos.
- `npx vercel env pull` descarga secretos en texto plano: borrar `.env.production.local` inmediatamente después de usarlo.
- Si una credencial se expone, rotarla en Neon/Vercel de inmediato.
