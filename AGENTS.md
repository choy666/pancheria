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
| Generar migraciones      | `npx drizzle-kit generate`                        |
| Empujar migraciones      | `npx drizzle-kit push`                            |
| Ejecutar seed            | `npx tsx src/db/seeds.ts`                         |

> **Atención:** `tests/e2e/global-setup.ts` trunca las tablas `products`, `recipes`, `sales`, `sale_items`, `orders`, `order_items`, `order_messages`, `stock_movements`, `cash_registers`, `daily_closures`, `public_order_rate_limits`, `login_attempts`, `videos`, `users` y `branches`, y re-ejecuta `src/db/seeds.ts`. No correr los tests E2E en una base de datos con datos reales.
>
> Para correr E2E de forma confiable se requiere una base de datos descartable, `ADMIN_USERNAME`/`ADMIN_PASSWORD` consistentes con el seed y que `AUTH_URL`/`NEXTAUTH_URL` apunten a `http://localhost:3000`. Copiar `.env.e2e.example` a `.env.e2e` y completar `DATABASE_URL` con una base descartable; el `global-setup.ts` valida que la URL sea local o tenga un sufijo de test/e2e/qa/staging y aborta si no lo es.
>
> Además, E2E requiere un secreto de autenticación válido (`AUTH_SECRET` o `NEXTAUTH_SECRET`) de al menos 32 bytes y las credenciales de administrador (`ADMIN_USERNAME`/`ADMIN_PASSWORD`). En GitHub Actions, `NEXTAUTH_SECRET`, `ADMIN_USERNAME` y `ADMIN_PASSWORD` deben configurarse como repository secrets; el workflow `.github/workflows/ci.yml` fallará de inmediato si faltan. Para las variables del contenedor PostgreSQL en CI se usan `vars.E2E_DB_USER`, `secrets.E2E_DB_PASSWORD` y `vars.E2E_DB_NAME`.
>
> El `webServer` de `playwright.config.ts` levanta `npm run dev:e2e`, que carga `.env.e2e` con `dotenv` antes de iniciar Next.js, y espera a que `/api/caja/resumen` responda para forzar la compilación de una ruta API antes de iniciar los tests. También se puede levantar manualmente con `npm run dev:e2e` y correr `NO_WEB_SERVER=1 npx playwright test`; esto es necesario si `.env.local` apunta a producción o si se quiere reutilizar un servidor ya calentado.

## Variables de entorno
Copiar `.env.example` a `.env.local` y completar:

- `DATABASE_URL` — URL de conexión a PostgreSQL (Neon). En Vercel Postgres equivale a `POSTGRES_URL` (pooled).
- `DATABASE_URL_UNPOOLED` — URL sin pooler para `drizzle-kit` (migraciones). En Vercel Postgres equivale a `POSTGRES_URL_NON_POOLING`.
- `NEXTAUTH_URL` — URL base de la app, por defecto `http://localhost:3000`. Se usa también para construir URLs públicas de videos en modo local si `NEXT_PUBLIC_APP_URL` no está definida. En NextAuth v5, si existe `AUTH_URL`, tiene prioridad sobre `NEXTAUTH_URL`; en ese caso `AUTH_URL` también debe coincidir con el dominio de producción.
- `AUTH_URL` (opcional) — URL de autenticación para NextAuth v5. Si se define, tiene prioridad sobre `NEXTAUTH_URL`. Debe coincidir con el dominio de producción; en desarrollo/tests suele ser `http://localhost:3000`.
- `NEXT_PUBLIC_APP_URL` (opcional) — URL pública base de la app. Si se define, tiene prioridad sobre `NEXTAUTH_URL` para URLs locales de videos y adjuntos de chat (`STORAGE_PROVIDER=local`).
- `NEXTAUTH_SECRET` — secreto para sesiones de NextAuth.
- `ADMIN_USERNAME` — usuario administrador inicial.
- `ADMIN_PASSWORD` — contraseña en texto plano; el seed la hashea con bcrypt.
- `DEFAULT_BRANCH_NAME` — nombre de la sucursal por defecto (usado por el seed).
- `NEW_BRANCH_NAME` (opcional) — nombre de una segunda sucursal a crear vía seed.
- `NEW_BRANCH_USERNAME` (opcional) — usuario de la segunda sucursal a crear vía seed.
- `NEW_BRANCH_PASSWORD` (opcional) — contraseña en texto plano del usuario de la segunda sucursal; el seed la hashea con bcrypt.
- `NEXT_PUBLIC_CAJA_REFRESH_INTERVAL_MS` — intervalo de refresco del panel de caja en milisegundos (por defecto 5000 ms).
- `NEXT_PUBLIC_WHATSAPP_NUMBER` — número de WhatsApp para pedidos, con código de país y sin signo + ni espacios.
- `NEXT_PUBLIC_WHATSAPP_MESSAGE_GREETING` (opcional) — saludo del mensaje de WhatsApp.
- `NEXT_PUBLIC_WHATSAPP_MESSAGE_CLOSING` (opcional) — cierre del mensaje de WhatsApp.
- `NEXT_PUBLIC_PEDIDO_REFETCH_INTERVAL_MS` (opcional) — intervalo de refresco del catálogo público en milisegundos (por defecto 30000 ms).
- `NEXT_PUBLIC_PEDIDOS_REFRESH_INTERVAL_MS` (opcional) — intervalo de refresco del listado de pedidos del operador en milisegundos (por defecto 10000 ms; 0 lo deshabilita).
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
- `PUBLIC_ORDER_RATE_LIMIT_CLEANUP_SCHEDULE` (opcional) — expresión `cron` para la limpieza de entradas vencidas de `public_order_rate_limits`. Por defecto `0 0 * * *` (una vez por día). Vercel Cron Jobs no lee variables de entorno para el `schedule`, así que este valor debe reflejarse en `vercel.json` o en la configuración de cron externo que llame a `GET /api/cron/rate-limit-cleanup`. En el plan Hobby de Vercel los cron jobs deben ser diarios; para una frecuencia mayor es necesario un plan Pro o un cron externo.
- `CRON_SECRET` (opcional) — secreto para proteger `GET /api/cron/rate-limit-cleanup` y `GET /api/cron/chat-attachments-cleanup`. Si no se define, los endpoints rechazan todas las llamadas.
- `CHAT_ATTACHMENTS_CLEANUP_SCHEDULE` (opcional) — expresión `cron` para la limpieza de adjuntos huérfanos del chat. Por defecto `0 0 * * *` (una vez por día). Vercel Cron Jobs no lee variables de entorno para el `schedule`; este valor debe reflejarse en `vercel.json`.
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
- `LOCAL_STORAGE_PATH` (opcional) — ruta local base para almacenar videos y adjuntos de chat cuando `STORAGE_PROVIDER=local` (por defecto `tmp/videos`).
- `CHAT_LOCAL_STORAGE_PATH` (opcional) — ruta local específica para los adjuntos del chat; si no se define, usa `LOCAL_STORAGE_PATH` como fallback.

> **Importante:** para que el comportamiento sea idéntico en desarrollo y producción, `DATABASE_URL` debe apuntar a la misma base de datos (o a una réplica/branch de Neon) en ambos entornos. No dejar `DATABASE_URL` apuntando a `localhost` si no hay un PostgreSQL local corriendo; en ese caso usá el mismo URL de Neon que en Vercel.

## Configuración del blueprint de Devin
- El blueprint para el snapshot de Devin vive en `.devin/environment.yaml`.
- Para subirlo a Devin Cloud se requiere autenticación con `devin.exe auth login` y un repositorio en GitHub.
- El flujo de DRS es:
  1. `devin.exe cloud drs blueprint-create --repo <owner/repo> --from-file .devin/environment.yaml`
  2. `devin.exe cloud drs build`

## Estructura del proyecto

- `src/app/` — páginas y rutas API
- `src/application/` — servicios de aplicación (casos de uso y coordinación)
- `src/repositories/` — capa de repositorios (`productRepository`, `saleRepository`, `cashRegisterRepository`, `orderRepository`, etc.)
- `src/db/` — esquema, conexión y seeds de Drizzle
- `src/components/` — componentes React
- `src/config/` — constantes de configuración (APIs, caja, catálogo, chat, pedidos, paginación, videos, rutas)
- `src/domain/` — tipos y errores de dominio
- `src/hooks/` — hooks personalizados de React
- `src/lib/` — utilidades y helpers transversales:
  - `money`, `date`, `catalog`, `product-grouping`, `product-style`, etc.
  - `storage` — almacenamiento de videos: `local`, `vercel-blob`, `s3`, `r2`.
  - `chat-storage` — almacenamiento de adjuntos del chat, con `getChatLocalStorageBasePath()` y lectura segura vía `GET /api/chat/attachment/[key]`.
  - `rate-limit` y `public-order-rate-limit-store` — rate limiting de pedidos públicos y chat (`PUBLIC_ORDER_RATE_LIMIT_*`, `PUBLIC_CHAT_RATE_LIMIT_*`).
  - `rate-limit-store` — almacenamiento de intentos fallidos de login (`RATE_LIMIT_STORE_PROVIDER`: `memory`/`db`).
  - `branch-resolver` — resolución de la sucursal activa para Server y Client Components.
  - `route-guard` — redirecciones de autenticación (`/` → `/pedido` sin sesión, `/login` → `/` con sesión).
  - `fetch` — wrapper `authenticatedFetch` y timeout configurable (`NEXT_PUBLIC_API_TIMEOUT_MS`).
  - `whatsapp` — generación del mensaje y enlace de WhatsApp.
  - `auth` — helpers de sesión, `getCurrentBranchId`/`getCurrentBranchIdOrRedirect`.
  - `db-errors` — manejo centralizado de errores de conexión a PostgreSQL (`503`).
  - `summary-helpers` — cálculo de resúmenes de productos e insumos críticos.
  - `stock-helpers` — locks, iteración de recetas y razones de movimientos de stock.
  - `cash-register-helpers` — selección y bloqueo pesimista de cajas.
  - `product-helpers` — contexto de productos, disponibilidad y validaciones.
  - `sale-helpers` — construcción de ítems y totales de venta.
  - `order-helpers` — generación de números/tokens y construcción de pedidos.
  - `validation-helpers` — validaciones reutilizables.

## Tecnologías
- Next.js 16.3.2, React 19.2.8, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM 0.45.2, PostgreSQL, NextAuth v5.

## Videos, reproducción y Cast

El sistema permite subir, listar, reproducir y transmitir videos desde el panel (`/videos`). Soporta reproducción local y Google Cast mediante la Web Sender SDK.

- Rutas del panel: `/videos` (listado), `/videos/nuevo` (subida) y `/videos/[id]` (reproducción).
- Endpoints de API: `POST /api/videos/upload` y `GET /api/videos/[id]/stream`.
- La lógica de almacenamiento está centralizada en `src/lib/storage.ts` y soporta cuatro proveedores: `local`, `vercel-blob`, `s3` y `r2`.
- La configuración de videos y proveedores vive en `src/config/videos.ts`.
- En desarrollo, `STORAGE_PROVIDER=local` guarda los archivos en `LOCAL_STORAGE_PATH` (por defecto `tmp/videos`) y los sirve a través de `GET /api/videos/[id]/stream`.
- En producción se recomienda `vercel-blob`, `s3` o `r2`, configurando las credenciales correspondientes en variables de entorno.
- La tabla `videos` en `src/db/schema.ts` almacena metadatos, URL pública, tipo MIME, tamaño y soft delete.

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
   - Anotá el dominio de producción asignado. Para este proyecto, el dominio oficial es `https://pancheria-alpha.vercel.app`; ese mismo valor debe usarse para `NEXTAUTH_URL` en producción.
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
- Solución: la redirección autoritaria es la del proxy (`src/proxy.ts` + `src/lib/route-guard.ts`). `src/app/(panel)/layout.tsx` y `src/app/(auth)/login/page.tsx` son redirecciones defensivas de fallback (el matcher del proxy excluye `/login` y las subrutas del panel no deberían llegar al layout sin pasar por el proxy). No hace falta eliminarlas, pero sí documentar su rol. Verificar que `NEXTAUTH_URL`/`AUTH_URL` apunten al dominio de producción.

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
- Panel: el chat se renderiza dentro del detalle del pedido (`/pedidos/[id]`); el listado (`/pedidos`) muestra `unreadCount` y hace polling según `NEXT_PUBLIC_PEDIDOS_REFRESH_INTERVAL_MS`.
- Endpoints públicos:
  - `GET /api/public/pedido/[id]/chat` devuelve `{ messages, status }`; `status` permite al cliente saber si el operador confirmó o canceló el pedido mientras la pestaña sigue abierta.
  - `POST /api/public/pedido/[id]/chat` envía un mensaje de texto.
  - `POST /api/public/pedido/[id]/chat/leido` marca como leídos los mensajes del operador.
  - `POST /api/public/pedido/[id]/chat/upload` envía un mensaje con imagen.
- Endpoints del panel: equivalentes bajo `/api/pedidos/[id]/chat`, `/api/pedidos/[id]/chat/leido` y `/api/pedidos/[id]/chat/upload`.
- Adjuntos: soportan `STORAGE_PROVIDER=local`, `vercel-blob`, `s3` y `r2` a través de `src/lib/chat-storage.ts`. La key interna se guarda en `order_messages.attachmentKey`; las URLs públicas locales usan `NEXT_PUBLIC_APP_URL` o `NEXTAUTH_URL` como base y se sirven por `GET /api/chat/attachment/[key]`, sin exponer paths físicos.
- Refresco: `OrderChat` hace polling cada `NEXT_PUBLIC_CHAT_REFRESH_INTERVAL_MS` (por defecto 5000 ms), pausa el polling durante el envío de un mensaje para evitar condiciones de carrera, y dispara un poll inmediato al montar, en `pageshow` y en `visibilitychange`. En tests se puede pasar la prop `disablePollingOnMount` para evitar el poll inmediato sin ramificar el código por `NODE_ENV`.
- Paginación: el historial se carga por páginas de `NEXT_PUBLIC_CHAT_PAGE_SIZE` mensajes (por defecto 50; máximo 100) usando `before` y `after` como cursores. El botón "Cargar mensajes anteriores" trae mensajes previos preservando la posición del scroll.
- Body en POST: el cliente envía el contenido como JSON body. El upgrade a Next.js 16.3.2 resolvió el bug de `request.body === null` bajo `next dev` con Turbopack. Los handlers aún aceptan el contenido por query param (`?content=...`) como fallback defensivo, pero el flujo normal usa JSON. Ver <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/pedido/[id]/chat/route.ts" /> y <ref_file file="C:/developer/paginas/pancheria/src/app/api/pedidos/[id]/chat/route.ts" />.
- Backoff de errores: si un poll de mensajes nuevos falla, `OrderChat` duplica el tiempo de espera hasta un máximo de 8 veces el intervalo base (`NEXT_PUBLIC_CHAT_REFRESH_INTERVAL_MS`) para evitar saturar al servidor. El polling se retoma en el momento cuando el usuario vuelve a la pestaña (`visibilitychange` o `pageshow`).
- SSR de `/pedido/[id]/chat`: `dynamic = 'force-dynamic'` es suficiente para evitar cacheos de la página; no se requieren `unstable_noStore`, `revalidate = 0` ni `fetchCache = 'force-no-store'` adicionales.
- Rate limit del chat: `createRateLimiter` en `src/lib/rate-limit.ts` comparte el mismo store que el rate limit de pedidos públicos (`PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER`). La ventana y el máximo se configuran con `PUBLIC_CHAT_RATE_LIMIT_WINDOW_MS` y `PUBLIC_CHAT_RATE_LIMIT_MAX_REQUESTS`.
- Limpieza de adjuntos huérfanos: el cron `GET /api/cron/chat-attachments-cleanup` (configurado en `vercel.json` y protegido por `CRON_SECRET`) elimina archivos bajo el prefijo `chat/` que no tengan un `attachmentKey` asociado en `order_messages`.
- Variables relacionadas: `NEXT_PUBLIC_CHAT_REFRESH_INTERVAL_MS`, `NEXT_PUBLIC_CHAT_MAX_TEXT_LENGTH`, `NEXT_PUBLIC_CHAT_PAGE_SIZE`, `NEXT_PUBLIC_CHAT_IMAGE_MAX_SIZE_MB`, `NEXT_PUBLIC_CHAT_ALLOWED_IMAGE_MIME_TYPES`, `PUBLIC_CHAT_RATE_LIMIT_WINDOW_MS`, `PUBLIC_CHAT_RATE_LIMIT_MAX_REQUESTS`, `CHAT_ATTACHMENTS_CLEANUP_SCHEDULE`, `CRON_SECRET`, `LOCAL_STORAGE_PATH`, `CHAT_LOCAL_STORAGE_PATH`.
- WhatsApp sigue disponible como fallback cuando `NEXT_PUBLIC_WHATSAPP_NUMBER` está configurado.

### Lineamientos para futuros chats

Para evitar duplicación de código al agregar nuevos canales de chat o extender el existente:

- Reutilizar `src/lib/rate-limit.ts` con un scope propio (por ejemplo, `chat:` o `support:`) en lugar de crear un nuevo sistema de rate limit.
- Reutilizar `src/lib/chat-storage.ts` para cualquier adjunto de imagen; no crear un storage paralelo. Si se requieren tipos de archivo distintos, extender los MIME y la validación de tamaño en `src/config/chat.ts`.
- Extender el esquema `order_messages` (o crear una tabla específica con el mismo patrón de columnas) en lugar de duplicar tablas de mensajes genéricas.
- Reutilizar `src/components/chat/order-chat.tsx` parametrizando `chatApiUrl`, `readApiUrl`, `uploadApiUrl`, `isClient` y `readOnly`.
- Seguir el flujo `chatService` → `orderMessageRepository` → endpoints API → componente `OrderChat`. No replicar la lógica de envío/lectura en componentes o páginas.

## Consideraciones técnicas futuras

- `authService.ts` abstrae el almacenamiento de intentos fallidos mediante `RateLimitStore` (`src/lib/rate-limit-store.ts`). La implementación por defecto es `InMemoryRateLimitStore`. Para producción con múltiples instancias, usar `DbRateLimitStore` configurando `RATE_LIMIT_STORE_PROVIDER=db` (requiere la tabla `login_attempts`, ya existente en `src/db/schema.ts` y creada con la migración `0007_boring_scorpion.sql`).
- Los resúmenes de caja y cierre (`productsSummary`, `criticalSuppliesSummary`) ya se migraron a `jsonb` en `src/db/schema.ts` para aprovechar la validación nativa de PostgreSQL.
- El rate limit de pedidos públicos (`POST /api/public/pedido`) y del chat público soporta `PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER=db` para usar PostgreSQL como store compartida en producción con múltiples instancias. Ver la tabla `public_order_rate_limits` en `src/db/schema.ts`.
- Los adjuntos del chat almacenan `attachmentKey` en `order_messages`, lo que permite la limpieza periódica de archivos huérfanos mediante `GET /api/cron/chat-attachments-cleanup`. El cron debe reflejarse en `vercel.json` y protegerse con `CRON_SECRET`.
- `cashRegisters.closedBy` permanece como `varchar` y no como FK a `users`. El cierre automático usa el valor simbólico `AUTO_CLOSED_BY` definido en `src/config/caja.ts`. Si en el futuro se requiere trazabilidad estricta del usuario que cierra, se evaluará agregar un campo `closedByUserId` nullable manteniendo `closedBy` como label legible.
