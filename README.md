# Panchería - Sistema de Gestión

Sistema web para la gestión de stock, ventas, pedidos y contenido audiovisual de una panchería.

## Tecnologías

- Next.js 16.3.3
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- Drizzle ORM
- PostgreSQL (Neon)
- NextAuth v5

## Requisitos

- Node.js 20 LTS o superior (CI verifica en 22)
- PostgreSQL (recomendado Neon)

## Configuración

1. Copiar `.env.example` a `.env.local` y completar las variables. Las mínimas para levantar son `DATABASE_URL` (o `POSTGRES_URL`/`POSTGRES_PRISMA_URL`), `DATABASE_URL_UNPOOLED` (o `POSTGRES_URL_NON_POOLING`), `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `DEFAULT_BRANCH_NAME` y `NEXT_PUBLIC_WHATSAPP_NUMBER` (si se quiere el fallback de WhatsApp). Opcionalmente revisar las variables de caja (`CAJA_AUTO_CLOSE_HOURS`/`NEXT_PUBLIC_CAJA_AUTO_CLOSE_HOURS`, `CAJA_AUTO_CLOSED_BY`, `NEXT_PUBLIC_CAJA_CLOCK_INTERVAL_MS`, `CAJA_DEFAULT_HISTORY_DAYS`/`NEXT_PUBLIC_CAJA_DEFAULT_HISTORY_DAYS`), `TRUSTED_PROXY_IP_HEADER`, `RATE_LIMIT_STORE_PROVIDER`, `NEXT_PUBLIC_DASHBOARD_REFRESH_INTERVAL_MS`, `NEXT_PUBLIC_PAYMENT_DENOMINATIONS`, `NEW_BRANCH_NAME`/`NEW_BRANCH_USERNAME`/`NEW_BRANCH_PASSWORD`/`NEW_BRANCH_ADDRESS`/`NEW_BRANCH_PHONE`/`NEW_BRANCH_LOCATION`, `DEFAULT_BRANCH_ADDRESS`/`DEFAULT_BRANCH_PHONE`/`DEFAULT_BRANCH_LOCATION` y `NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS` según el entorno.
2. `AUTH_URL` (opcional) tiene prioridad sobre `NEXTAUTH_URL` en NextAuth v5; usar en producción para que coincida con el dominio de Vercel.
3. `NEXT_PUBLIC_APP_URL` (opcional) tiene prioridad sobre `NEXTAUTH_URL` para construir URLs locales de videos y adjuntos de chat cuando `STORAGE_PROVIDER=local`.
4. **Importante para dev/prod idénticos**: `DATABASE_URL` debe apuntar a la misma base de datos que Vercel. Si usás Vercel Postgres, también podés usar `POSTGRES_URL`/`POSTGRES_PRISMA_URL` porque `src/db/index.ts` las resuelve automáticamente.
5. Para migraciones (`drizzle-kit`) usar una URL sin pooler: `DATABASE_URL_UNPOOLED` o `POSTGRES_URL_NON_POOLING`.
6. Instalar dependencias: `npm install`
7. Generar migraciones: `npx drizzle-kit generate`
8. Empujar migraciones en desarrollo: `npx drizzle-kit push`
9. Para producción, ver `.devin/informes/entornos.md`
10. Ejecutar seed: `npx tsx src/db/seeds.ts`
11. Iniciar en desarrollo: `npm run dev`

Para correr tests E2E, `playwright.config.ts` carga `.env.e2e` después de `.env.local`. Si `.env.local` apunta a producción, levantar manualmente `npm run dev` con `NO_WEB_SERVER=1`.

## Tests end-to-end

1. Copiar `.env.e2e.example` a `.env.e2e` y completar `DATABASE_URL` con una base descartable (nunca producción).
2. `global-setup.ts` valida que `NODE_ENV=test`, que la base sea local o tenga un nombre de test/e2e/qa/staging, y que `LOCAL_STORAGE_PATH` sea seguro.
3. Correr `npm run test:e2e` levanta automáticamente `npm run dev:e2e` y ejecuta los tests.
4. Alternativa manual: `npm run dev:e2e` en una terminal y `NO_WEB_SERVER=1 npx playwright test` en otra.

> **Importante:** `global-setup.ts` trunca todas las tablas del negocio y re-ejecuta `src/db/seeds.ts`. No correr E2E contra una base con datos reales.

## Notas de seguridad y producción

- No commitear `.env.local` ni `.env.e2e`; `.env.e2e.example` es el template seguro para compartir.
- En producción definir `NEXT_PUBLIC_APP_URL` y `NEXTAUTH_URL` con el dominio real. De lo contrario, las URLs de videos, chat, imágenes de productos y WhatsApp caerán en `http://localhost:3000`.
- En producción usar `STORAGE_PROVIDER=vercel-blob`, `s3` o `r2` para videos, adjuntos de chat e imágenes de productos. `local` funciona en desarrollo pero pierde archivos en Vercel por el filesystem efímero.
- Si `.env.local` fue expuesto, rotar `NEXTAUTH_SECRET`, `ADMIN_PASSWORD`, `BLOB_READ_WRITE_TOKEN` y las credenciales de Neon.

## Comandos

- `npm run dev` — modo desarrollo
- `npm run build` — compilar
- `npm run start` — iniciar servidor de producción
- `npm run analyze` — analizar bundle
- `npm run lint` — lint
- `npx tsc --noEmit` — verificación de tipos
- `npm test` — tests unitarios
- `npm run test:e2e` (o `npx playwright test`) — tests end-to-end
- `npm run knip` — detectar exports, dependencias y archivos no usados
- `npx drizzle-kit generate` — generar migraciones
- `npx drizzle-kit push` — empujar migraciones
- `npx tsx src/db/seeds.ts` — ejecutar seed

## Estructura

- `src/app/` — páginas y rutas API, organizadas en `(panel)`, `(public)` y `(auth)`
- `src/application/` — servicios de aplicación (casos de uso y coordinación)
- `src/repositories/` — capa de repositorios
- `src/db/` — esquema, conexión y seeds de Drizzle
- `src/components/` — componentes React
- `src/config/` — constantes de configuración (APIs, caja, catálogo, chat, pedidos, paginación, videos, imágenes de productos, rutas)
  - `src/config/routes.ts` centraliza las rutas de navegación de la UI.
  - `src/config/caja.ts` expone getters para las variables de entorno de caja.
  - `src/config/product-images.ts` expone getters para las variables de entorno de imágenes de productos.
- `src/domain/` — tipos y errores de dominio
- `src/hooks/` — hooks personalizados de React
- `src/lib/` — utilidades: `cn`, `json`, `money`, `date`, `storage` (videos), `chat-storage`, `product-image-storage`, `product-image-upload-client`, `rate-limit`, `public-order-rate-limit-store`, `rate-limit-store` (login), `branch-resolver`, `branch-helpers`, `route-guard`, `fetch`, `whatsapp`, `auth`, `db-errors`, `with-auth.ts`, `public-url`, `api-handler`, `logger`, `pagination`, `validation-helpers`, `last-customer-name`, `last-customer-phone`, `recent-orders`, y helpers de productos/ventas/pedidos/stock/caja/pagos

## Panel de control

La raíz autenticada `/` es el panel de control. Muestra un resumen operativo de la sucursal activa:

- Estado de la caja (abierta/cerrada, total, efectivo, transferencia, cantidad de ventas).
- Pedidos por estado (`pending`, `in_process`, `paid`, `finished`, `cancelled`).
- Alertas de stock bajo.
- Nombre de la sucursal activa y usuario logueado.
- Accesos rápidos a las secciones principales, filtrados por rol.

Los datos se obtienen de `GET /api/panel/resumen` y se refrescan automáticamente cada 30 segundos. El archivo `src/components/panel/dashboard-client.tsx` contiene la interfaz y `src/hooks/useDashboard.ts` el hook de carga.

La navegación superior distingue ahora:

- **Historial de cajas** (`/ventas/historial`): historial de ventas por caja.
- **Caja y cierre** (`/cierre`): apertura, cierre y resumen de la caja.
- **Cierres diarios** (`/cierre/historial`): cierres diarios históricos.

## Guía interactiva

La app incluye un recorrido interactivo con `driver.js` que se adapta al rol del usuario. El tour se inicia manualmente desde el botón **Guía** del header (también disponible en el menú móvil). Una vez iniciado, continúa automáticamente al navegar entre las secciones habilitadas para cada rol y resalta `data-tour` en cada pantalla:

- **Administrador (`admin`)**: Panel, Ventas, Productos, Stock, Caja y cierre, Cierres diarios, Pedidos, Videos, Sucursales, Usuarios, Perfil y selector de sucursal.
- **Operador (`operator`)**: Panel, Ventas, Stock, Caja y cierre, Cierres diarios, Pedidos, Perfil y Catálogo, siempre dentro de su sucursal asignada.

El recorrido explica pagos mixtos, el flujo de pedidos (`pending` → `in_process` → `paid` → `finished` o `cancelled`), reservas, chat del pedido, imágenes de promos y videos. Se puede cerrar en cualquier momento con la cruz, la tecla `Escape`, el botón **Finalizar** o volviendo a presionar **Guía**.

## Multi-sucursal

El sistema soporta múltiples sucursales con aislamiento de datos:

- Cada usuario pertenece a una única sucursal (`users.branchId`).
- La sucursal se determina automáticamente al iniciar sesión a partir del usuario.
- Los operadores (`operator`) siempre trabajan en su sucursal asignada.
- Los administradores pueden cambiar la sucursal activa desde el selector del panel; la selección se guarda en la cookie `activeBranchId`.
- Productos, recetas, stock, cajas, ventas, movimientos y cierres diarios se filtran por la sucursal activa (`branchId`).
- Las páginas `/sucursales` y `/usuarios` permiten a los administradores crear nuevas sucursales y usuarios operador.

## Promos, recetas y snapshots

- Las promos (`compound`) pueden incluir insumos críticos, manuales y servicios.
- Los insumos críticos son obligatorios y descuentan stock automáticamente (`autoDiscount: true`).
- Los insumos manuales y servicios pueden configurarse como opcionales y preseleccionados por defecto; su precio y el de la promo no cambian al quitarlos.
- El cliente y el operador eligen los complementos desde `PromoOptionsDialog` en `/pedido` y `/ventas`.
- Cada venta y pedido persiste un snapshot de receta (`sale_item_recipes` / `order_item_recipes`) para descuentos, reintegros, reservas y resúmenes históricos.
- `orderService.createOrder` inserta un mensaje automático en el chat del pedido con el detalle de preparación.
- El seed usa `DEFAULT_BRANCH_NAME` para crear la sucursal inicial y asignarle el administrador (`ADMIN_USERNAME`).

## Roles y permisos

El sistema distingue dos roles: `admin` y `operator`.

- **Administrador (`admin`)**: se crea únicamente durante el seed a partir de `ADMIN_USERNAME` y `ADMIN_PASSWORD` (`.env.local`) y se asigna a la sucursal inicial (`DEFAULT_BRANCH_NAME`). Aunque en la tabla `users` figura asignado a una sucursal concreta, puede operar sobre cualquier sucursal mediante el selector del panel. Tiene acceso a todas las secciones: `Panel`, `Ventas`, `Historial de cajas`, `Productos`, `Stock`, `Caja y cierre`, `Cierres diarios`, `Pedidos`, `Sucursales`, `Usuarios`, `Videos`, `Catálogo` y `Perfil`. Desde `/usuarios` puede crear, editar, resetear la contraseña y eliminar usuarios `operator`.

- **Operador (`operator`)**: se crea exclusivamente desde `/usuarios` y siempre tiene rol `operator`. Puede acceder a `Panel`, `Ventas`, `Historial de cajas`, `Stock`, `Caja y cierre`, `Cierres diarios`, `Pedidos`, `Catálogo` y `Perfil`, y siempre opera dentro de la sucursal que el administrador le asignó. Dentro de `Stock` puede ajustar stock y consultar movimientos; dentro de `Caja y cierre` puede abrir, cerrar y consultar historial, así como generar cierres diarios de su sucursal. El nombre de su sucursal asignada se muestra en la navbar.

La página `/usuarios` lista siempre **todos** los usuarios del sistema para el administrador, mostrando la sucursal asignada de cada uno. No es posible crear más administradores desde la interfaz.

## Catálogo público, pedidos y chat

El sistema expone una ruta pública `/pedido` donde los clientes pueden acceder al catálogo. La raíz (`/`) es el panel de control; los usuarios no autenticados son redirigidos a `/pedido`, mientras que administradores y operadores autenticados acceden al panel.

- Ver el catálogo de productos vendibles de una sucursal.
- Armar un carrito con validación de disponibilidad en tiempo real.
- Hacer el pedido desde la app; si `NEXT_PUBLIC_WHATSAPP_NUMBER` está configurado, también se genera un enlace de WhatsApp como fallback.
- El pedido valida disponibilidad al crearlo, pero **no reserva ni descuenta stock**. El flujo del operador es:
  - **Recibir y reservar**: pasa de `pending` a `in_process` y reserva stock de insumos críticos.
  - **Confirmar pago**: pasa de `pending` o `in_process` a `paid`, convierte la reserva en descuento definitivo y genera la venta.
  - **Finalizar pedido**: pasa de `paid` a `finished` para marcar entrega/retiro.
  - **Cancelar**: libera la reserva si estaba en `in_process` y anula la venta si ya estaba `paid`.
- Al crear el pedido, el cliente puede ir al chat `/pedido/[id]/chat?token=...` para coordinar con la sucursal. El chat soporta texto e imágenes.
- El listado de pedidos del operador (`/pedidos`) puede hacer polling automático si se configura `NEXT_PUBLIC_PEDIDOS_REFRESH_INTERVAL_MS` con un valor mayor a 0 (deshabilitado por defecto) e incluye un botón de actualización manual. Muestra la cantidad de mensajes no leídos (`unreadCount`) por pedido.
- Los pedidos `pending` expiran automáticamente tras `ORDER_EXPIRATION_MS` (por defecto 1 hora; mínimo 1 minuto) al consultar el listado. La expiración no libera stock porque un pedido `pending` nunca reservó.

Variables de entorno relacionadas (ver `.env.example` para el listado completo):
`NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_WHATSAPP_MESSAGE_GREETING`, `NEXT_PUBLIC_WHATSAPP_MESSAGE_CLOSING`, `NEXT_PUBLIC_PEDIDO_REFETCH_INTERVAL_MS`, `NEXT_PUBLIC_PEDIDOS_REFRESH_INTERVAL_MS`, `NEXT_PUBLIC_DASHBOARD_REFRESH_INTERVAL_MS`, `NEXT_PUBLIC_API_TIMEOUT_MS`, `NEXT_PUBLIC_CHAT_REFRESH_INTERVAL_MS`, `NEXT_PUBLIC_CHAT_MAX_TEXT_LENGTH`, `NEXT_PUBLIC_CHAT_PAGE_SIZE`, `NEXT_PUBLIC_CHAT_IMAGE_MAX_SIZE_MB`, `NEXT_PUBLIC_CHAT_ALLOWED_IMAGE_MIME_TYPES`, `PUBLIC_CHAT_RATE_LIMIT_WINDOW_MS`, `PUBLIC_CHAT_RATE_LIMIT_MAX_REQUESTS`, `PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER`, `PUBLIC_ORDER_RATE_LIMIT_WINDOW_MS`, `PUBLIC_ORDER_RATE_LIMIT_MAX_REQUESTS`, `E2E_ENABLE_RATE_LIMIT`, `ORDER_EXPIRATION_MS`, `CRON_SECRET`, `TRUSTED_PROXY_IP_HEADER`, `LOCAL_STORAGE_PATH`, `CHAT_LOCAL_STORAGE_PATH`, `RATE_LIMIT_STORE_PROVIDER`, `NEXT_PUBLIC_CAJA_AUTO_CLOSE_HOURS`, `NEXT_PUBLIC_CAJA_DEFAULT_HISTORY_DAYS`, `DEFAULT_BRANCH_NAME`, `DEFAULT_BRANCH_ADDRESS`, `DEFAULT_BRANCH_PHONE`, `DEFAULT_BRANCH_LOCATION`, `NEW_BRANCH_NAME`, `NEW_BRANCH_USERNAME`, `NEW_BRANCH_PASSWORD`, `NEW_BRANCH_ADDRESS`, `NEW_BRANCH_PHONE`, `NEW_BRANCH_LOCATION`, `NEXT_PUBLIC_PAYMENT_DENOMINATIONS`.

## Videos, reproducción y Cast

El panel incluye una sección `/videos` para gestionar contenido audiovisual:

- Subir videos desde `/videos/nuevo`.
- Listar y reproducir videos desde `/videos` y `/videos/[id]`.
- Transmitir a dispositivos Chromecast mediante Google Cast SDK.
- Endpoints: `POST /api/videos/upload` y `GET /api/videos/[id]/stream`.

El almacenamiento es configurable a través de `STORAGE_PROVIDER`: `local` (desarrollo), `vercel-blob`, `s3` o `r2`. Cada proveedor requiere sus propias credenciales en `.env.local` (ver `.env.example`).

Variables de entorno relacionadas:
`NEXT_PUBLIC_APP_URL` (opcional, prioridad sobre `NEXTAUTH_URL` para URLs de videos en modo local), `NEXT_PUBLIC_CAST_RECEIVER_APP_ID`, `NEXT_PUBLIC_CAST_SENDER_SDK_URL`, `NEXT_PUBLIC_VIDEO_MAX_SIZE_MB`, `NEXT_PUBLIC_VIDEO_ALLOWED_MIME_TYPES`, `STORAGE_PROVIDER`, `BLOB_READ_WRITE_TOKEN`, `S3_*`, `R2_*`, `LOCAL_STORAGE_PATH`, `CHAT_LOCAL_STORAGE_PATH`, `NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS`.

## Imágenes de productos y promos

El panel permite agregar, cambiar o quitar una imagen ilustrativa al crear/editar una promo. La imagen se muestra en el catálogo público (`/pedido`) y en el panel de productos.

- El administrador sube un archivo o ingresa una URL externa desde el formulario de promo.
- Endpoints: `POST /api/productos/imagen/preparar`, `POST /api/productos/imagen/upload` (solo `local`) y `GET /api/productos/imagen/[key]`.
- El almacenamiento usa el mismo `STORAGE_PROVIDER` de videos/chat: `local`, `vercel-blob`, `s3` o `r2`.
- En producción se recomienda `vercel-blob`, `s3` o `r2`; `local` pierde archivos en Vercel.

Variables de entorno relacionadas:
`NEXT_PUBLIC_PRODUCT_IMAGE_MAX_SIZE_MB`, `NEXT_PUBLIC_PRODUCT_IMAGE_ALLOWED_MIME_TYPES`, `PRODUCT_IMAGE_LOCAL_STORAGE_PATH`, `PRODUCT_IMAGE_ALLOWED_EXTERNAL_DOMAINS`, `NEXT_PUBLIC_PRODUCT_IMAGE_URL_MAX_LENGTH`.

## Cron jobs

`vercel.json` define dos cron jobs diarios:

- `GET /api/cron/rate-limit-cleanup` — limpia entradas vencidas de `public_order_rate_limits`.
- `GET /api/cron/chat-attachments-cleanup` — elimina archivos de chat huérfanos comparando las keys almacenadas en `order_messages.attachmentKey`.

Ambos endpoints están protegidos por `CRON_SECRET`. Las expresiones `cron` se configuran en `vercel.json`; Vercel Cron Jobs no leen variables de entorno para el `schedule`.

## Notas

- El sistema crea un administrador inicial desde las variables de entorno (`ADMIN_USERNAME`).
- `src/proxy.ts` define `Content-Security-Policy` con nonce por request y `src/lib/csp-helpers.ts` resuelve los orígenes permitidos; `next.config.ts` mantiene el resto de los headers de seguridad.
- El esquema de base de datos incluye constraints `CHECK (stock >= 0)` y `CHECK (min_stock >= 0)` en `products`, además de índices recientes en `orders` y `order_messages`.
- Los insumos manuales (`manual_supply`) son informativos en recetas y no se descuentan automáticamente del stock en ventas.
- Los insumos críticos (pan, salchicha, bebida) se descuentan automáticamente.
- `src/db/index.ts` elige el driver correcto (Neon serverless o `pg`) según el host de la URL.
- La raíz `/` redirige a `/pedido` si no hay sesión y `/login` redirige a `/` si el usuario ya está autenticado, a través del proxy de NextAuth en `src/proxy.ts` y la lógica de `src/lib/route-guard.ts`. `src/app/(panel)/layout.tsx` y `src/app/(auth)/login/page.tsx` conservan redirecciones defensivas que duplican la lógica del proxy. `next.config.ts` no contiene un redirect estático de `/` a `/pedido`.
- El esquema incluye `order_messages`, `public_order_rate_limits` y `login_attempts`, además de las tablas de negocio principales.
