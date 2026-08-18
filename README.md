# Panchería - Sistema de Gestión

Sistema web para la gestión de stock y ventas de una panchería.

## Tecnologías

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- Drizzle ORM
- PostgreSQL (Neon)
- NextAuth v5

## Requisitos

- Node.js 20 LTS o superior
- PostgreSQL (recomendado Neon)

## Configuración

1. Copiar `.env.example` a `.env.local` y completar las variables.
2. **Importante para dev/prod idénticos**: `DATABASE_URL` debe apuntar a la misma base de datos que Vercel. Si usás Vercel Postgres, también podés usar `POSTGRES_URL`/`POSTGRES_PRISMA_URL` porque `src/db/index.ts` las resuelve automáticamente.
3. Para migraciones (`drizzle-kit`) usar una URL sin pooler: `DATABASE_URL_UNPOOLED` o `POSTGRES_URL_NON_POOLING`.
4. Instalar dependencias: `npm install`
5. Generar y empujar migraciones: `npx drizzle-kit push`
6. Ejecutar seed: `npx tsx src/db/seeds.ts`
7. Iniciar en desarrollo: `npm run dev`

## Comandos

- `npm run dev` — modo desarrollo
- `npm run build` — compilar
- `npm run start` — iniciar servidor de producción
- `npm run analyze` — analizar bundle
- `npm run lint` — lint
- `npx tsc --noEmit` — verificación de tipos
- `npm test` — tests unitarios
- `npm run test:e2e` (o `npx playwright test`) — tests end-to-end
- `npx drizzle-kit generate` — generar migraciones
- `npx drizzle-kit push` — empujar migraciones
- `npx tsx src/db/seeds.ts` — ejecutar seed

## Estructura

- `src/app/` — páginas y rutas API
- `src/application/` — servicios de aplicación (casos de uso y coordinación)
- `src/repositories/` — capa de repositorios
- `src/db/` — esquema, conexión y seeds de Drizzle
- `src/components/` — componentes React
- `src/config/` — constantes de configuración (APIs, caja, paginación, videos)
- `src/domain/` — tipos y errores de dominio
- `src/hooks/` — hooks personalizados de React
- `src/lib/` — utilidades (`cn`, `json`, `money`, `date`, `storage`, etc.)

## Guía interactiva

La app incluye un recorrido interactivo con `driver.js` que se adapta al rol del usuario. El tour se inicia manualmente desde el botón **Guía** del header (también disponible en el menú móvil). Una vez iniciado, continúa automáticamente al navegar entre las secciones habilitadas para cada rol:

- **Administrador (`admin`)**: Panel, Ventas, Productos, Stock, Caja, Historial de cierres, Sucursales y Usuarios. También se destaca el selector de sucursal.
- **Operador (`operator`)**: Panel, Ventas, Stock, Caja e Historial de cierres, siempre dentro de su sucursal asignada.

El recorrido se puede cerrar en cualquier momento con la cruz, la tecla `Escape`, el botón **Finalizar** o volviendo a presionar **Guía**.

## Multi-sucursal

El sistema soporta múltiples sucursales con aislamiento de datos:

- Cada usuario pertenece a una única sucursal (`users.branchId`).
- La sucursal se determina automáticamente al iniciar sesión a partir del usuario.
- Los operadores (`operator`) siempre trabajan en su sucursal asignada.
- Los administradores pueden cambiar la sucursal activa desde el selector del panel.
- Productos, recetas, stock, cajas, ventas, movimientos y cierres diarios se filtran por la sucursal activa (`branchId`).
- Las páginas `/sucursales` y `/usuarios` permiten a los administradores crear nuevas sucursales y usuarios operador.
- El seed usa `DEFAULT_BRANCH_NAME` para crear la sucursal inicial y asignarle el administrador (`ADMIN_USERNAME`).

## Roles y permisos

El sistema distingue dos roles: `admin` y `operator`.

- **Administrador (`admin`)**: se crea únicamente durante el seed a partir de `ADMIN_USERNAME` y `ADMIN_PASSWORD` (`.env.local`) y se asigna a la sucursal inicial (`DEFAULT_BRANCH_NAME`). Aunque en la tabla `users` figura asignado a una sucursal concreta, puede operar sobre cualquier sucursal mediante el selector del panel. Tiene acceso a todas las secciones: `Panel`, `Ventas`, `Historial`, `Productos`, `Stock`, `Caja`, `Sucursales` y `Usuarios`. Desde `/usuarios` puede crear, editar, resetear la contraseña y eliminar usuarios `operator`.

- **Operador (`operator`)**: se crea exclusivamente desde `/usuarios` y siempre tiene rol `operator`. Solo puede acceder a `Panel`, `Ventas`, `Historial`, `Stock` y `Caja`, y siempre opera dentro de la sucursal que el administrador le asignó. Dentro de `Stock` puede ajustar stock y consultar movimientos; dentro de `Caja` puede abrir, cerrar y consultar historial, así como generar cierres diarios de su sucursal. El nombre de su sucursal asignada se muestra en la navbar.

La página `/usuarios` lista siempre **todos** los usuarios del sistema para el administrador, mostrando la sucursal asignada de cada uno. No es posible crear más administradores desde la interfaz.

## Catálogo público y pedidos

El sistema expone una ruta pública `/pedido` donde los clientes pueden:

- Ver el catálogo de productos vendibles de una sucursal.
- Armar un carrito con validación de disponibilidad en tiempo real.
- Enviar el pedido por WhatsApp a un número configurable.
- El pedido valida disponibilidad, pero **no reserva ni descuenta stock**. El stock se descuenta únicamente al confirmar el pedido desde el panel.

Los administradores y operadores gestionan los pedidos desde `/pedidos`:

- Listar pedidos `pending` de la sucursal.
- Ver detalle de un pedido.
- Confirmar el pedido como venta (requiere caja abierta).
- Cancelar el pedido. No modifica stock porque el pedido nunca lo reservó.

Las variables de entorno relacionadas están en `.env.example`:
`NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_WHATSAPP_MESSAGE_GREETING`, `NEXT_PUBLIC_WHATSAPP_MESSAGE_CLOSING`, `NEXT_PUBLIC_PEDIDO_REFETCH_INTERVAL_MS`, `PUBLIC_ORDER_RATE_LIMIT_WINDOW_MS`, `PUBLIC_ORDER_RATE_LIMIT_MAX_REQUESTS`.

## Videos, reproducción y Cast

El panel incluye una sección `/videos` para gestionar contenido audiovisual:

- Subir videos desde `/videos/nuevo`.
- Listar y reproducir videos desde `/videos` y `/videos/[id]`.
- Transmitir a dispositivos Chromecast mediante Google Cast SDK.
- Endpoints: `POST /api/videos/upload` y `GET /api/videos/[id]/stream`.

El almacenamiento es configurable a través de `STORAGE_PROVIDER`: `local` (desarrollo), `vercel-blob`, `s3` o `r2`. Cada proveedor requiere sus propias credenciales en `.env.local` (ver `.env.example`).

Variables de entorno relacionadas:
`NEXT_PUBLIC_APP_URL` (opcional, prioridad sobre `NEXTAUTH_URL` para URLs de videos en modo local), `NEXT_PUBLIC_CAST_RECEIVER_APP_ID`, `NEXT_PUBLIC_CAST_SENDER_SDK_URL`, `NEXT_PUBLIC_VIDEO_MAX_SIZE_MB`, `NEXT_PUBLIC_VIDEO_ALLOWED_MIME_TYPES`, `STORAGE_PROVIDER`, `BLOB_READ_WRITE_TOKEN`, `S3_*`, `R2_*`, `LOCAL_STORAGE_PATH`.

## Notas

- El sistema crea un administrador inicial desde las variables de entorno (`ADMIN_USERNAME`).
- Los insumos críticos (pan, salchicha, bebida) se descuentan automáticamente.
- Los insumos manuales son informativos en recetas.
- `src/db/index.ts` elige el driver correcto (Neon serverless o `pg`) según el host de la URL.
