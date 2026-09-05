# Notas para Agentes — Proyecto Panchería

## Idioma
Todas las explicaciones, comentarios y documentación deben estar en español.

## Seguridad
- No hardcodear credenciales, URLs de APIs ni parámetros sensibles en el código.
- Todos los valores sensibles deben provenir de variables de entorno o configuraciones dinámicas.

## Comandos principales

| Propósito                | Comando                                           |
| ------------------------ | ------------------------------------------------- |
| Instalar dependencias    | `npm install`                                     |
| Ejecutar en desarrollo   | `npm run dev`                                     |
| Compilar                 | `npm run build`                                   |
| Iniciar en producción    | `npm run start`                                   |
| Analizar bundle          | `npm run analyze`                                 |
| Lint                     | `npm run lint`                                    |
| Tests unitarios          | `npm test`                                        |
| Verificación de tipos    | `npx tsc --noEmit`                                |
| Tests E2E                | `npm run test:e2e`                                |
| Tests de accesibilidad   | `npm run test:accessibility`                      |
| Código muerto            | `npm run knip`                                    |
| Generar migraciones      | `npx drizzle-kit generate`                        |
| Aplicar migraciones      | `npx drizzle-kit migrate`                          |
| Registrar baseline de migraciones | `npx tsx scripts/drizzle-baseline.ts` (`TARGET_E2E=1` para la base E2E) |
| Empujar migraciones (sincronización directa) | `npx drizzle-kit push`               |
| Empujar migraciones en producción | Ver `.devin/informes/entornos.md`        |
| Ejecutar seed            | `npx tsx src/db/seeds.ts`                         |

> **Atención:** `tests/e2e/global-setup.ts` trunca las tablas `products`, `recipes`, `sales`, `sale_items`, `orders`, `order_items`, `order_messages`, `stock_movements`, `cash_registers`, `public_order_rate_limits`, `login_attempts`, `videos`, `users` y `branches` con `RESTART IDENTITY CASCADE` (las tablas hijas como `order_stock_reservations`, `sale_payments`, `sale_item_recipes` y `order_item_recipes` quedan cubiertas por el `CASCADE`), y re-ejecuta `src/db/seeds.ts`. No correr los tests E2E en una base de datos con datos reales.
>
> Para correr E2E de forma confiable se requiere una base de datos descartable, `ADMIN_USERNAME`/`ADMIN_PASSWORD` consistentes con el seed y que `AUTH_URL`/`NEXTAUTH_URL` apunten a `http://localhost:3000`. El `playwright.config.ts` y `scripts/dev-e2e.ts` cargan `.env.local` como base y luego `.env.e2e` con prioridad, asi que se recomienda copiar `.env.e2e.example` a `.env.e2e` y completar `DATABASE_URL` con una base descartable. **El nombre de la base para E2E debe terminar en `test`, `e2e`, `testing`, `qa` o `staging`, incluso si es local.** El `global-setup.ts` aborta si `DATABASE_URL` no es local o no cumple con ese patrón, salvo que `E2E_ALLOW_REMOTE_DB=true` esté explícitamente definido.
>
> Además, E2E requiere un secreto de autenticación válido (`AUTH_SECRET` o `NEXTAUTH_SECRET`) de al menos 32 bytes y las credenciales de administrador (`ADMIN_USERNAME`/`ADMIN_PASSWORD`). En GitHub Actions, `NEXTAUTH_SECRET`, `ADMIN_USERNAME` y `ADMIN_PASSWORD` deben configurarse como repository secrets; el workflow `.github/workflows/ci.yml` fallará de inmediato si faltan. El job de E2E usa una base de datos remota descartable de Neon, configurada a través de los repository secrets `E2E_DATABASE_URL` y `E2E_DATABASE_URL_UNPOOLED`. El nombre de la base debe terminar en `test`, `e2e`, `testing`, `qa` o `staging` para cumplir la validación de `tests/e2e/global-setup.ts`.
>
> El `webServer` de `playwright.config.ts` levanta `npm run dev:e2e`, que carga `.env.local` y luego `.env.e2e` con `dotenv` antes de iniciar Next.js, y espera a que `/api/caja/resumen` responda. `tests/e2e/global-setup.ts` realiza un `preheat` del servidor llamando las rutas críticas (chat, pedido público, catálogo, caja) antes de ejecutar los tests, para evitar timeouts en los primeros tests por compilación bajo Turbopack. También se puede levantar manualmente con `npm run dev:e2e` y correr `NO_WEB_SERVER=1 npx playwright test`; esto es necesario si `.env.local` apunta a producción o si se quiere reutilizar un servidor ya calentado. Para ejecutar solo los tests de accesibilidad con axe-core, usar `npm run test:accessibility`.
>
> `npm run build` y el job `build` de CI no pasan `DATABASE_URL` porque las páginas públicas críticas (`/pedido`, `/pedido/[id]/chat`) usan `dynamic = 'force-dynamic'`; el build no consulta la base de datos durante la generación estática. Si en el futuro se agrega SSG que requiera DB, usar una URL de staging, nunca la productiva.
>
> Antes de subir cambios a Git, consultar `.devin/informes/checklist-pre-push.md` para evitar errores comunes de CI (lint, tipos, build, knip, variables de E2E, rate limit, etc.).
>
> **Migraciones:** todo cambio en `src/db/schema.ts` debe acompañarse de la migración generada con `npx drizzle-kit generate` y commiteada en `drizzle/`. Las bases de desarrollo y E2E tienen inicializado `drizzle.__drizzle_migrations`, por lo que `npx drizzle-kit migrate` es el flujo recomendado para aplicar cambios. `drizzle-kit push` desincroniza la base del historial commiteado y requiere TTY ante confirmaciones; si se usa, correr después `npx tsx scripts/drizzle-baseline.ts` para registrar la migración como aplicada.

## Variables de entorno
Copiar `.env.example` a `.env.local` y completar:

- `DATABASE_URL` — URL de conexión a PostgreSQL (Neon). En Vercel Postgres equivale a `POSTGRES_URL` (pooled). El runtime también acepta `POSTGRES_URL` y `POSTGRES_PRISMA_URL` como fallback.
- `DATABASE_URL_UNPOOLED` — URL sin pooler para `drizzle-kit` (migraciones). En Vercel Postgres equivale a `POSTGRES_URL_NON_POOLING`.
- `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING` — aliases de Vercel Postgres; el código los prueba en orden si `DATABASE_URL`/`DATABASE_URL_UNPOOLED` no están definidos.
- `NEXTAUTH_URL` — URL base de la app, por defecto `http://localhost:3000`. Se usa también para construir URLs públicas de videos en modo local si `NEXT_PUBLIC_APP_URL` no está definida. En NextAuth v5, si existe `AUTH_URL`, tiene prioridad sobre `NEXTAUTH_URL`; en ese caso `AUTH_URL` también debe coincidir con el dominio de producción.
- `AUTH_URL` (opcional) — URL de autenticación para NextAuth v5. Si se define, tiene prioridad sobre `NEXTAUTH_URL`. Debe coincidir con el dominio de producción; en desarrollo/tests suele ser `http://localhost:3000`.
- `NEXT_PUBLIC_APP_URL` (opcional) — URL pública base de la app. Si se define, tiene prioridad sobre `NEXTAUTH_URL` para URLs locales de videos y adjuntos de chat (`STORAGE_PROVIDER=local`).
- `HOST` / `PORT` (opcionales) — host y puerto para el fallback de desarrollo de `getPublicBaseUrl()` cuando no hay `NEXT_PUBLIC_APP_URL` ni `NEXTAUTH_URL`. Por defecto `localhost:3000`.
- `AUTH_SECRET` (opcional) — secreto preferido por NextAuth v5 para firmar sesiones. Si no se define, se usa `NEXTAUTH_SECRET` como compatibilidad. Debe tener al menos 32 bytes.
- `NEXTAUTH_SECRET` — secreto para sesiones de NextAuth (compatibilidad; Auth.js v5 prefiere `AUTH_SECRET`).
- `ADMIN_USERNAME` — usuario administrador inicial.
- `ADMIN_PASSWORD` — contraseña en texto plano; el seed la hashea con bcrypt.
- `DEFAULT_BRANCH_NAME` — nombre de la sucursal por defecto (usado por el seed).
- `DEFAULT_BRANCH_ADDRESS` (opcional) — dirección de la sucursal por defecto (usado por el seed).
- `DEFAULT_BRANCH_PHONE` (opcional) — teléfono de la sucursal por defecto (usado por el seed).
- `DEFAULT_BRANCH_LOCATION` (opcional) — URL de ubicación de la sucursal por defecto (usado por el seed).
- `NEXT_PUBLIC_BRANCH_TIMEZONE` (opcional) — zona horaria para calcular horarios de apertura de sucursales. Si no se define, se usa `America/Argentina/Buenos_Aires`.
- `NEW_BRANCH_NAME` (opcional) — nombre de una segunda sucursal a crear vía seed.
- `NEW_BRANCH_USERNAME` (opcional) — usuario de la segunda sucursal a crear vía seed.
- `NEW_BRANCH_PASSWORD` (opcional) — contraseña en texto plano del usuario de la segunda sucursal; el seed la hashea con bcrypt.
- `NEXT_PUBLIC_CAJA_REFRESH_INTERVAL_MS` — intervalo de refresco del panel de caja en milisegundos (por defecto 5000 ms; mínimo recomendado 5000 ms).
- `CAJA_AUTO_CLOSE_HOURS` / `NEXT_PUBLIC_CAJA_AUTO_CLOSE_HOURS` (opcional) — horas de cierre automático de cajas abiertas (por defecto 12 horas).
- `CAJA_AUTO_CLOSED_BY` (opcional) — etiqueta del usuario que cierra cajas automáticamente (por defecto `Sistema`).
- `NEXT_PUBLIC_CAJA_CLOCK_INTERVAL_MS` (opcional) — intervalo del reloj de caja en milisegundos (por defecto 60000 ms; mínimo recomendado 10000 ms).
- `CAJA_DEFAULT_HISTORY_DAYS` / `NEXT_PUBLIC_CAJA_DEFAULT_HISTORY_DAYS` (opcional) — días de historial de caja por defecto (por defecto 30 días).
- `TRUSTED_PROXY_IP_HEADER` (opcional) — header confiable para obtener la IP real del cliente en rate limiting. Si no se define, en producción se usa el header `x-vercel-forwarded-for` y en desarrollo se usa `X-Forwarded-For` como fallback.
- `PUBLIC_RATE_LIMIT_TRUST_PRIVATE_IPS` (opcional) — si se define como `true`, permite usar `X-Forwarded-For` en producción cuando no hay proxy confiable configurado. Puede ser vulnerable a IP spoofing; usalo solo si un proxy sanitiza el header.
- `NEXT_PUBLIC_WHATSAPP_NUMBER` (opcional) — número de WhatsApp para pedidos, con código de país y sin signo + ni espacios. Si no se define, el pedido funciona sin enlace de WhatsApp.
- `NEXT_PUBLIC_WHATSAPP_MESSAGE_GREETING` (opcional) — saludo del mensaje de WhatsApp.
- `NEXT_PUBLIC_WHATSAPP_MESSAGE_CLOSING` (opcional) — cierre del mensaje de WhatsApp.
- `NEXT_PUBLIC_PEDIDO_REFETCH_INTERVAL_MS` (opcional) — intervalo de refresco del catálogo público en milisegundos (por defecto 30000 ms).
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
- `PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER` (opcional) — proveedor del rate limit de creación de pedidos y del chat público: `memory` o `db` (PostgreSQL). En producción, si `DATABASE_URL` o `POSTGRES_URL` están definidas y no se especifica lo contrario, se usa `db`; en desarrollo/test y sin base de datos disponible, `memory`. `db` es recomendado para producción con múltiples instancias. Requiere la tabla `public_order_rate_limits` en el esquema.
- `PUBLIC_ORDER_RATE_LIMIT_WINDOW_MS` (opcional) — ventana del rate limit de creación de pedidos en milisegundos (por defecto 60000 ms).
- `PUBLIC_ORDER_RATE_LIMIT_MAX_REQUESTS` (opcional) — cantidad máxima de pedidos por IP en la ventana (por defecto 10).
- `PUBLIC_ORDER_RATE_LIMIT_ENABLE_IN_DEV` (opcional) — si se define como `true`, activa el rate limit de pedidos en `NODE_ENV=development`. Por defecto está deshabilitado en desarrollo para evitar falsos positivos por la IP compartida de loopback (`127.0.0.1` / `::1`).
- `E2E_ENABLE_RATE_LIMIT` (opcional) — si se define como `true`, activa el rate limit de pedidos en `NODE_ENV=test` (usado por el suite de Playwright).
- `BASE_URL` (opcional) — URL base para Playwright (por defecto `http://localhost:3000`).
- `NO_WEB_SERVER` (opcional) — si se define como `1` u otro valor no vacío, deshabilita el `webServer` de Playwright para reutilizar un servidor ya levantado (`npm run dev:e2e`).
- `NO_GLOBAL_SETUP` (opcional) — si se define como `1` u otro valor no vacío, salta `tests/e2e/global-setup.ts` cuando el servidor y la base de datos ya están preparados.
- `CRON_SECRET` (opcional) — secreto para proteger `GET /api/cron/rate-limit-cleanup` y `GET /api/cron/chat-attachments-cleanup`. Si no se define, los endpoints rechazan todas las llamadas.

> Los schedules de los cron jobs (`/api/cron/rate-limit-cleanup` y `/api/cron/chat-attachments-cleanup`) están definidos en `vercel.json` (`0 0 * * *` por defecto). Vercel Cron Jobs no leen variables de entorno para el `schedule`; si se quiere cambiar la frecuencia, editar `vercel.json` (o el cron externo correspondiente).
- `ORDER_EXPIRATION_MS` (opcional) — tiempo en milisegundos antes de que un pedido `pending` se marque como cancelado (por defecto 3_600_000 ms = 1 hora; mínimo 60_000 ms). No libera stock; limpia pedidos viejos del panel al listar.
- `RATE_LIMIT_STORE_PROVIDER` (opcional) — proveedor de almacenamiento de intentos fallidos de login:
  - `memory`: en memoria (por defecto en desarrollo y en `NODE_ENV=test`).
  - `db`: en PostgreSQL usando la tabla `login_attempts` (por defecto en producción cuando `DATABASE_URL` o `POSTGRES_URL` están definidas; configurable explícitamente con `RATE_LIMIT_STORE_PROVIDER=db`).
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
- `NEXT_PUBLIC_PRODUCT_IMAGE_MAX_SIZE_MB` (opcional) — tamaño máximo de imagen de producto/promo en MB (por defecto 5).
- `NEXT_PUBLIC_PRODUCT_IMAGE_ALLOWED_MIME_TYPES` (opcional) — tipos MIME de imagen permitidos separados por coma (por defecto `image/jpeg,image/png,image/webp`).
- `PRODUCT_IMAGE_LOCAL_STORAGE_PATH` (opcional) — ruta local específica para imágenes de productos; si no se define, usa `LOCAL_STORAGE_PATH` como fallback (por defecto `tmp/videos/product-images`).
- `PRODUCT_IMAGE_ALLOWED_EXTERNAL_DOMAINS` (opcional) — lista de dominios permitidos para URLs externas de imágenes separados por coma; si está vacía, se aceptan todos los dominios HTTPS. También se usa en `src/lib/csp-helpers.ts` para extender `img-src` en la CSP.
- `NEXT_PUBLIC_PRODUCT_IMAGE_URL_MAX_LENGTH` / `PRODUCT_IMAGE_URL_MAX_LENGTH` (opcional) — longitud máxima de una URL externa de imagen (por defecto 2048); la variable pública tiene prioridad.
- `NEXT_PUBLIC_PAYMENT_DENOMINATIONS` (opcional) — valores de los botones de denominación rápida en el ingreso de pagos, separados por coma. Por defecto `1000,2000,5000,10000,20000`.
- `NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS` (opcional) — si se define como `true`, se inyecta el script de Vercel Web Analytics en todas las páginas. En desarrollo no envía datos aunque esté habilitado; también es necesario activar Web Analytics en el dashboard de Vercel.

> **Importante:** para que el comportamiento sea idéntico en desarrollo y producción, `DATABASE_URL` debe apuntar a la misma base de datos (o a una réplica/branch de Neon) en ambos entornos. No dejar `DATABASE_URL` apuntando a `localhost` si no hay un PostgreSQL local corriendo; en ese caso usá el mismo URL de Neon que en Vercel.

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
  - `whatsapp` — generación del mensaje y enlace de WhatsApp.
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

## Promos, recetas y snapshots

- El proyecto soporta promos (`compound`) con insumos críticos, manuales y servicios.
- Las recetas (`recipes`) definen qué insumos incluye cada promo, sus cantidades, si son opcionales y si vienen preseleccionados.
- Los insumos críticos con `autoDiscount: true` son obligatorios y son los únicos que descuentan stock.
- Los insumos manuales y servicios pueden ser opcionales; su precio y el de la promo no cambian al quitarlos.
- Cada venta y pedido persiste un snapshot de receta en `sale_item_recipes` y `order_item_recipes` para garantizar que futuras ediciones de recetas no afecten transacciones históricas.
- `PromoOptionsDialog` permite seleccionar complementos en el catálogo público y en el terminal de ventas.
- `orderService.createOrder` inserta un mensaje automático en el chat del pedido con el detalle de preparación de cada promo.
- El canal oficial de confirmación y detalle es el chat del pedido; WhatsApp no debe extenderse con nueva funcionalidad.

## Videos, reproducción y Cast

El sistema permite subir, listar, reproducir y transmitir videos desde el panel (`/videos`). Soporta reproducción local y Google Cast mediante la Web Sender SDK.

- Rutas del panel: `/videos` (listado), `/videos/nuevo` (subida) y `/videos/[id]` (reproducción).
- Endpoints de API: `POST /api/videos/upload` y `GET /api/videos/[id]/stream`.
- La lógica de almacenamiento está centralizada en `src/lib/storage.ts` y soporta cuatro proveedores: `local`, `vercel-blob`, `s3` y `r2`.
- La configuración de videos y proveedores vive en `src/config/videos.ts`.
- En desarrollo, `STORAGE_PROVIDER=local` guarda los archivos en `LOCAL_STORAGE_PATH` (por defecto `tmp/videos`) y los sirve a través de `GET /api/videos/[id]/stream`.
- En producción se recomienda `vercel-blob`, `s3` o `r2`, configurando las credenciales correspondientes en variables de entorno.
- La tabla `videos` en `src/db/schema.ts` almacena metadatos, URL pública, tipo MIME, tamaño y soft delete.

## Imágenes de productos y promos

El sistema permite asociar una imagen ilustrativa a cada producto/promo (`products.imageUrl`, `imageKey`, `imageMimeType`, `imageSize`). Las imágenes son opcionales, no afectan stock, precio ni disponibilidad, y se muestran en el catálogo público (`/pedido`) y en el panel de productos.

- El administrador puede subir un archivo o ingresar una URL externa desde el formulario de promo (`src/components/productos/promo-form.tsx` / `product-image-uploader.tsx`).
- Endpoints de API: `POST /api/productos/imagen/preparar` (devuelve instrucciones de subida), `POST /api/productos/imagen/upload` (solo `local`) y `GET /api/productos/imagen/[key]` (lectura pública).
- La lógica de almacenamiento y validación está en `src/lib/product-image-storage.ts` y `src/lib/product-image-upload-client.ts`, reutilizando el proveedor configurado en `STORAGE_PROVIDER` (`local`, `vercel-blob`, `s3`, `r2`).
- La configuración de tamaño, MIME, dominios permitidos y URL máxima vive en `src/config/product-images.ts`.
- La CSP de `src/lib/csp-helpers.ts` (inyectada por `src/proxy.ts`) extiende `img-src` con los dominios de `PRODUCT_IMAGE_ALLOWED_EXTERNAL_DOMAINS` y con los orígenes de `vercel-blob`, `s3` o `r2` según el proveedor.
- En producción se recomienda `vercel-blob`, `s3` o `r2`; `local` funciona en desarrollo pero pierde archivos en Vercel por el filesystem efímero.

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

### `ECONNREFUSED` al conectar con PostgreSQL en desarrollo

- Verificar que `DATABASE_URL` en `.env.local` no apunte a `localhost` si no hay un PostgreSQL local corriendo.
- Preferir usar la misma URL de Neon que en Vercel (`POSTGRES_URL`) para que dev y prod se comporten igual.
- Revisar `src/db/index.ts` para entender el orden de resolución: `DATABASE_URL` → `POSTGRES_URL` → `POSTGRES_PRISMA_URL`.
- Para migraciones, `drizzle.config.ts` usa `DATABASE_URL_UNPOOLED` → `POSTGRES_URL_NON_POOLING` → `DATABASE_URL` → `POSTGRES_URL`.

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
- Limpieza de adjuntos huérfanos: el cron `GET /api/cron/chat-attachments-cleanup` (configurado en `vercel.json` y protegido por `CRON_SECRET`) elimina archivos bajo el prefijo `chat/` que no tengan un `attachmentKey` asociado en `order_messages`.
- Variables relacionadas: `NEXT_PUBLIC_CHAT_REFRESH_INTERVAL_MS`, `NEXT_PUBLIC_CHAT_MAX_TEXT_LENGTH`, `NEXT_PUBLIC_CHAT_PAGE_SIZE`, `NEXT_PUBLIC_CHAT_IMAGE_MAX_SIZE_MB`, `NEXT_PUBLIC_CHAT_ALLOWED_IMAGE_MIME_TYPES`, `PUBLIC_CHAT_RATE_LIMIT_WINDOW_MS`, `PUBLIC_CHAT_RATE_LIMIT_MAX_REQUESTS`, `CRON_SECRET`, `LOCAL_STORAGE_PATH`, `CHAT_LOCAL_STORAGE_PATH`.
- WhatsApp sigue disponible como fallback cuando `NEXT_PUBLIC_WHATSAPP_NUMBER` está configurado.

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
