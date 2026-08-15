# Prompt: Página de administración para videos con reproducción y soporte Cast

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja y cierre de caja.

Stack: Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM con PostgreSQL (Neon), NextAuth v5.

Documentación de referencia:
- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-estado-2026-08-13.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/README.md" />

## Estado actual relevante

El panel administrativo protege rutas con `role === 'admin'` y usa `PanelHeader` con navegación dinámica. El esquema de base de datos soporta `branchId`, soft delete, timestamps y roles. No existe aún una sección de videos ni integración con Cast SDK.

<ref_snippet file="C:/developer/paginas/pancheria/src/config/routes.ts" lines="1-11" />
<ref_snippet file="C:/developer/paginas/pancheria/src/components/panel/panel-header.tsx" lines="35-44" />
<ref_snippet file="C:/developer/paginas/pancheria/src/db/schema.ts" lines="49-70" />
<ref_snippet file="C:/developer/paginas/pancheria/src/db/schema.ts" lines="72-107" />

## Objetivo

Agregar una sección `/videos` accesible solo para administradores que permita:

1. Subir videos con título, descripción y archivo.
2. Listar, ver, activar/desactivar y eliminar (soft delete) videos por sucursal.
3. Reproducir videos en el navegador.
4. Enviar la reproducción a un dispositivo remoto mediante Google Cast (Chromecast), con el SDK cargado dinámicamente y configurable para desarrollo y producción.

## Reglas de negocio

1. **Solo administradores** pueden acceder a `/videos` y gestionar videos. Los operadores no ven el menú ni la ruta.
2. **Aislamiento por sucursal**: cada video pertenece a un `branchId`. Un admin ve y carga videos de la sucursal activa.
3. **Almacenamiento externo o servido por API**: no guardar archivos en `public/` ni en el filesystem local en producción. Preferir un bucket configurado por variables de entorno (Vercel Blob, S3, Cloudflare R2, etc.). La URL pública se almacena en base de datos.
4. **No enviar archivos binarios por server action**: el límite de body de server actions (1 MB por defecto) y de funciones serverless en Vercel (4.5 MB) impide subir videos de hasta 100 MB. El flujo debe ser: (1) server action o API que entrega URL/token de subida directa, (2) el cliente sube el archivo al proveedor, (3) server action que persiste los metadatos con `fileUrl`.
5. **Sin valores hardcodeados**: el app ID del Cast receiver, la URL del SDK, el proveedor de almacenamiento, el límite de tamaño y los tipos MIME deben provenir de `process.env` o `src/config/videos.ts`. Las variables usadas en el cliente deben comenzar con `NEXT_PUBLIC_`.
6. **Soft delete**: los videos eliminados marcan `deletedAt`; no se borran físicamente salvo justificación explícita.
7. **Validación de archivos**: tipos MIME `video/mp4`, `video/webm`, `video/ogg`; tamaño máximo configurable (por defecto 100 MB); título obligatorio.
8. **Estado activo/inactivo**: un video puede estar inactivo (`isActive = false`) sin eliminarse.
9. **Cast**: debe funcionar con el Google Cast Default Media Receiver en desarrollo si no se configura otra app (`CC1AD845`), y permitir configurar un receiver propio en producción. Si no hay dispositivos disponibles, mostrar el botón deshabilitado con un mensaje informativo.

## Implementación detallada

### Base de datos

En `src/db/schema.ts`:

- Crear tabla `videos` siguiendo la convención de nombres de columna de Drizzle:
  - `id: serial('id').primaryKey()`
  - `branchId: integer('branch_id').notNull().references(() => branches.id, { onDelete: 'restrict' })`
  - `title: varchar('title', { length: 255 }).notNull()`
  - `description: text('description')`
  - `fileUrl: text('file_url').notNull()` — URL pública del video (del proveedor de almacenamiento o ruta de stream).
  - `mimeType: varchar('mime_type', { length: 100 }).notNull()`
  - `size: integer('size')` — tamaño en bytes (puede ser `null` si no se reporta).
  - `isActive: boolean('is_active').default(true).notNull()`
  - `createdAt: timestamp('created_at').defaultNow().notNull()`
  - `updatedAt: timestamp('updated_at').defaultNow().notNull()`
  - `deletedAt: timestamp('deleted_at')`
- Agregar la tabla como tercer argumento de `pgTable` con índices:
  - `branchIdIdx: index('videos_branch_id_idx').on(table.branchId)`
  - `branchActiveDeletedIdx: index('videos_branch_active_deleted_idx').on(table.branchId, table.isActive, table.deletedAt)`
- Agregar relaciones:
  - `videosRelations` con `branch: one(branches, { fields: [videos.branchId], references: [branches.id] })`.
  - Actualizar `branchesRelations` para incluir `videos: many(videos)`.
- Generar migración con `npx drizzle-kit generate` y aplicar con `npx drizzle-kit push` en una base de prueba.
- Actualizar `tests/e2e/global-setup.ts` para truncar la tabla `videos` (antes de `branches` por la FK).

### Tipos de dominio

En `src/domain/types.ts`:

- Agregar `VideoRow` y `Video` con los campos de la tabla `videos`, siguiendo el patrón de `ProductRow`.

### Esquemas Zod

En `src/lib/zod-schemas.ts`:

- `videoBaseSchema` con `title`, `description`, `fileUrl`, `mimeType`, `size` e `isActive`.
- `videoSchema` (insert) y `videoUpdateSchema` (`videoBaseSchema.partial()`).
- `videoFileSchema` para validación del archivo en el cliente si aplica.

### Configuración de videos

Crear `src/config/videos.ts`:

- `DEFAULT_VIDEO_MAX_SIZE_MB = 100`
- `DEFAULT_VIDEO_ALLOWED_MIME_TYPES = ['video/mp4', 'video/webm', 'video/ogg']`
- `DEFAULT_CAST_RECEIVER_APP_ID = 'CC1AD845'` (Default Media Receiver)
- `DEFAULT_CAST_SENDER_SDK_URL = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1'`
- Funciones que lean `process.env.NEXT_PUBLIC_VIDEO_MAX_SIZE_MB`, `NEXT_PUBLIC_VIDEO_ALLOWED_MIME_TYPES`, `NEXT_PUBLIC_CAST_RECEIVER_APP_ID` y `NEXT_PUBLIC_CAST_SENDER_SDK_URL`, con fallback a los defaults.
- `getStorageProvider()` que lea `STORAGE_PROVIDER` (`vercel-blob`, `s3`, `r2`, `local`).

### Almacenamiento

Crear `src/lib/storage.ts`:

- Proveer una abstracción `StorageProvider` con al menos:
  - `prepareUpload(file: File, branchId: number): Promise<{ url?: string; token?: string; fields?: Record<string, string>; method?: 'POST' | 'PUT' }>` — genera la URL/token para que el cliente suba el archivo directamente.
  - `getPublicUrl(keyOrUrl: string): string`.
- Las credenciales (`BLOB_READ_WRITE_TOKEN`, `S3_*`, `R2_*`) deben venir de `process.env`.
- Soportar Vercel Blob (`@vercel/blob`), S3/R2 y un modo `local` para desarrollo (guardar en un directorio temporal no trackeado, nunca en `public/`).
- En producción, el binario nunca pasa por el servidor; se sube directamente al bucket y solo se persiste `fileUrl` en base de datos.

### Backend

<ref_file file="C:/developer/paginas/pancheria/src/repositories/productRepository.ts" />
- `src/repositories/videoRepository.ts`: `findAll`, `findActive`, `findById`, `create`, `update`, `softDelete`, `restore`. Filtrar siempre por `branchId`, `deletedAt` e `isActive` y ordenar por `title`. Definir `VideoInsert` y `VideoUpdate` usando los esquemas Zod.

<ref_file file="C:/developer/paginas/pancheria/src/application/services/productService.ts" />
- `src/application/services/videoService.ts`: validaciones con Zod, lógica de negocio, manejo de `DomainError` y `NotFoundError`. El límite de tamaño y los tipos permitidos deben leerse de `src/config/videos.ts`. Separar la preparación de subida de la creación de metadatos.

<ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/sucursales/actions.ts" />
- `src/app/(panel)/videos/actions.ts`: server actions con `useActionState`. Usar `requireAdmin()` y `getCurrentBranchId(session)` (pasar la sesión para evitar un segundo llamado a `auth()`). Devolver `{ error: string } | null` para errores de dominio; lanzar errores no controlados.
  - `prepareUploadAction` — recibe nombre/tipo del archivo y devuelve el token/URL de subida directa.
  - `createVideoAction`, `updateVideoAction`, `toggleVideoStatusAction`, `deleteVideoAction` (soft delete), `restoreVideoAction`.

- `src/app/api/videos/[id]/stream/route.ts` (opcional, solo si `STORAGE_PROVIDER=local` o se usa como proxy): servir el archivo con `Content-Type`, `Accept-Ranges` y soporte para `206 Partial Content`. Si el video está en almacenamiento externo, redirigir a `fileUrl`.

### Frontend

- `src/config/routes.ts`: agregar `videos: '/videos'`, `videosNuevo: '/videos/nuevo'` y `videoDetalle: '/videos/[id]'`.
- `src/components/panel/panel-header.tsx`: agregar `{ href: routes.videos, label: 'Videos' }` a `adminNavItems`.
- `src/app/(panel)/videos/page.tsx`: listado con tabla, acciones y protección para admin (redirección a `/` si no es admin).
- `src/app/(panel)/videos/nuevo/page.tsx`: formulario de subida. Flujo:
  1. El usuario selecciona el archivo.
  2. Se llama a `prepareUploadAction` y se sube el archivo directamente al proveedor.
  3. Se envía `createVideoAction` con título, descripción, `fileUrl`, `mimeType` y `size`.
- `src/app/(panel)/videos/[id]/page.tsx`: reproductor y detalles del video.
- `src/components/videos/video-form.tsx`, `video-list.tsx`, `video-player.tsx`, `cast-button.tsx`: componentes reutilizables con shadcn/ui.
- `src/hooks/useCast.ts`: hook para cargar dinámicamente el script desde `getCastSenderSdkUrl()`, inicializar `cast.framework.CastContext`, descubrir dispositivos, lanzar media y controlar estado. Usar `useRef` para evitar `setState` tras desmontaje, siguiendo el patrón de `AGENTS.md`.

### Variables de entorno

Actualizar `.env.example` (y luego `.env.local`):

- `NEXT_PUBLIC_CAST_RECEIVER_APP_ID` — ID del Cast receiver (default `CC1AD845`).
- `NEXT_PUBLIC_CAST_SENDER_SDK_URL` — URL del SDK de Google Cast CAF (default `https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1`).
- `NEXT_PUBLIC_VIDEO_MAX_SIZE_MB` — límite de tamaño permitido (default 100).
- `NEXT_PUBLIC_VIDEO_ALLOWED_MIME_TYPES` — tipos MIME permitidos, separados por coma.
- `STORAGE_PROVIDER` — `vercel-blob`, `s3`, `r2` o `local`.
- Variables del proveedor de almacenamiento (`BLOB_READ_WRITE_TOKEN`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, etc.).

> Si se elige Vercel Blob, instalar `@vercel/blob`. Para S3/R2, instalar los SDKs correspondientes (`@aws-sdk/client-s3`, `@aws-sdk/s3-presigned-post`, etc.).

### Tests

- `src/repositories/videoRepository.test.ts`: aislamiento por sucursal, registro inactivo, soft delete y restore.
- `src/application/services/videoService.test.ts`: validaciones, permisos, soft delete, límite de tamaño y tipos MIME.
- `tests/e2e/videos.spec.ts`: flujo de subida, listado, reproducción y cast.
- Actualizar `tests/e2e/global-setup.ts` para truncar `videos` junto con las demás tablas.

## Consideraciones de seguridad y entorno

- No hardcodear credenciales, app IDs de Cast, URLs de storage ni parámetros sensibles. Todos deben provenir de variables de entorno.
- El SDK de Google Cast requiere HTTPS o `localhost`. En desarrollo usar `npm run dev`; en producción funciona en Vercel.
- No ejecutar `npx drizzle-kit push` ni `npx tsx src/db/seeds.ts` contra bases de datos con datos reales.
- `.env.local` no debe commitearse.
- En producción, los videos deben servirse directamente desde el bucket con headers de streaming correctos. Si se usa un proxy, implementar `Accept-Ranges` y `206`.

## Verificaciones

| Comando | Propósito |
| ------- | --------- |
| `npm run lint` | Estilo y calidad |
| `npx tsc --noEmit` | Verificación de tipos |
| `npm test` | Tests unitarios |
| `npm run build` | Build de producción |
| `npm run test:e2e` | Tests E2E en base de prueba |
| `npx drizzle-kit push` | Aplicar migraciones en base de prueba |
