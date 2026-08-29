# Prompt: Imágenes ilustrativas para promos y catálogo público

> **Estado:** resuelto y archivado.  
> La funcionalidad está implementada en `main` con la migración `0021_ambiguous_mandarin.sql`, los endpoints `/api/productos/imagen/*`, el componente `product-image-uploader.tsx` y los tests de `product-image-storage`. Este prompt se conserva como registro histórico.

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja y cierre de caja con catálogo público de pedidos y chat por pedido.

Stack: Next.js 16.3.3, React 19.2.8, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM 0.45.2 con PostgreSQL (Neon), NextAuth v5, Jest, Playwright.

Documentación de referencia obligatoria:

- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/README.md" />

## Estado actual relevante

- Las promos son productos de tipo `compound`. Se crean/editan en <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/productos/nuevo/page.tsx" /> y <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/productos/[id]/editar/page.tsx" />, usando el componente <ref_file file="C:/developer/paginas/pancheria/src/components/productos/promo-form.tsx" />.
- El formulario de promo envía la receta y los datos del producto por separado, primero creando/actualizando el producto y luego guardando la receta vía <ref_file file="C:/developer/paginas/pancheria/src/config/api.ts" />.
- El catálogo público (`/pedido`) muestra productos con <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/product-card.tsx" />, sin imágenes.
- El esquema de `products` en <ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" /> no tiene campos de imagen.
- Ya existe infraestructura de almacenamiento de archivos en <ref_file file="C:/developer/paginas/pancheria/src/lib/storage.ts" /> (videos) y <ref_file file="C:/developer/paginas/pancheria/src/lib/chat-storage.ts" /> (adjuntos de chat), soportando los proveedores `local`, `vercel-blob`, `s3` y `r2` a través de variables de entorno.
- La CSP actual en <ref_file file="C:/developer/paginas/pancheria/next.config.ts" /> tiene `img-src 'self' data: blob:`.

## Objetivo

Permitir que el administrador agregue, cambie o elimine una imagen ilustrativa al crear o editar una promo. Esa imagen debe mostrarse en el catálogo público (`/pedido`) para mejorar la estética y ayudar al cliente a identificar cada promo.

En una primera versión se soportará **una imagen por producto**; el esquema y la arquitectura deben quedar preparados para extender a múltiples imágenes en el futuro sin rehacer la base.

## Reglas de negocio

1. Las imágenes son **opcionales** y tienen fines meramente ilustrativos; no afectan stock, precio, disponibilidad ni recetas.
2. Cada producto puede tener **una imagen principal**.
3. Solo el rol `admin` puede subir, cambiar o quitar la imagen.
4. La imagen debe mostrarse en el catálogo público cuando el producto sea vendible (<ref_file file="C:/developer/paginas/pancheria/src/lib/catalog.ts" />).
5. Si un producto no tiene imagen, el catálogo debe mostrar un fallback visual acorde (por ejemplo un ícono o placeholder) sin romper el layout.
6. El almacenamiento debe respetar el proveedor configurado en `STORAGE_PROVIDER` (`local`, `vercel-blob`, `s3`, `r2`). En producción no debe usarse `local` porque el filesystem de Vercel es efímero.
7. Tamaño máximo, tipos MIME y ruta local deben ser configurables por variables de entorno, con valores por defecto razonables y **nunca hardcodeados** en el código que consume expone APIs.
8. La URL pública de la imagen debe resolverse dinámicamente desde el campo `imageUrl` del producto.
9. El administrador debe poder elegir entre **subir un archivo** o **ingresar una URL externa** (por ejemplo de un CDN, Vercel Blob, S3, R2 u otro origen HTTPS). Si elige URL, no se almacena el archivo en el storage del sistema; solo se guarda y sirve la URL indicada.
10. Si la imagen se reemplaza o el producto se elimina, se debe evitar dejar archivos huérfanos en el storage local en la medida de lo posible.

## Implementación detallada

### Fase 1 — Esquema de base de datos y tipos

En <ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" />, agregar a la tabla `products`:

- `imageUrl: text('image_url')` — URL pública de la imagen (`null` si no hay).
- `imageKey: text('image_key')` — identificador interno en el storage, necesario para lectura/borrado local y para limpieza futura.
- `imageMimeType: varchar('image_mime_type', { length: 100 })` — tipo MIME de la imagen guardada.
- `imageSize: integer('image_size')` — tamaño en bytes.

Todos los campos deben ser `nullable` y no afectar el comportamiento cuando son `null`.

Actualizar el tipo <ref_file file="C:/developer/paginas/pancheria/src/domain/types.ts" /> (`ProductRow`) para reflejar los nuevos campos.

Generar la migración con:

```bash
npx drizzle-kit generate
```

Revisar el SQL generado y aplicar en desarrollo con:

```bash
npx drizzle-kit push
```

### Fase 2 — Configuración centralizada

Crear `src/config/product-images.ts` con getters puros que lean variables de entorno, siguiendo el patrón de <ref_file file="C:/developer/paginas/pancheria/src/config/chat.ts" /> y <ref_file file="C:/developer/paginas/pancheria/src/config/videos.ts" />:

- `getProductImageMaxSizeMb()` (default `5`).
- `getProductImageMaxSizeBytes()`.
- `getProductImageAllowedMimeTypes()` (default `image/jpeg`, `image/png`, `image/webp`).
- `getProductImageLocalStoragePath()` con fallback a `process.env.LOCAL_STORAGE_PATH` y luego a `tmp/videos/product-images`.
- `getProductImageAllowedExternalDomains()` — lista opcional de dominios permitidos para URLs externas (por ejemplo `cdn.example.com,blob.vercel-storage.com`). Si está vacía, se aceptan todos los dominios HTTPS.
- `getProductImageUrlMaxLength()` — longitud máxima de una URL externa (default `2048`).

Actualizar <ref_file file="C:/developer/paginas/pancheria/.env.example" /> documentando las nuevas variables:

- `NEXT_PUBLIC_PRODUCT_IMAGE_MAX_SIZE_MB`
- `NEXT_PUBLIC_PRODUCT_IMAGE_ALLOWED_MIME_TYPES`
- `PRODUCT_IMAGE_LOCAL_STORAGE_PATH`
- `PRODUCT_IMAGE_ALLOWED_EXTERNAL_DOMAINS`
- `PRODUCT_IMAGE_URL_MAX_LENGTH`

### Fase 3 — Capa de almacenamiento

Crear `src/lib/product-image-storage.ts` con responsabilidad única sobre imágenes de productos. Debe reutilizar la estrategia de proveedores ya existente, evitando duplicar la lógica de credenciales si es posible.

Interfaces y funciones mínimas:

- `validateProductImage(file: FileInfo)` — valida tamaño y MIME.
- `validateProductImageUrl(url: string)` — valida que la URL sea `https://`, que no use esquemas inseguros (`javascript:`, `data:`, etc.), que no exceda la longitud máxima y que, si está configurada, el dominio esté en la lista permitida.
- `prepareProductImageUpload(file, branchId, productId)` — devuelve `UploadInstructions` con key `product-images/{productId}/{nanoid}.{ext}`.
- `saveProductImage(file, productId)` — guarda el archivo y devuelve `{ key, publicUrl, mimeType, size }`.
- `readProductImage(key)` — lee el archivo local para el endpoint público.
- `deleteProductImage(key)` — elimina el archivo si es `local` (opcional, recomendado para reemplazo).
- `getProductImagePublicUrl(key)` — resuelve la URL pública según el proveedor.
- `resolveProductImage(product: ProductRow)` — devuelve la URL final a mostrar: si `imageKey` existe, `getProductImagePublicUrl(imageKey)`; si no, `imageUrl` directamente.

> **Nota técnica:** si el tiempo lo permite, considerar refactorizar <ref_file file="C:/developer/paginas/pancheria/src/lib/storage.ts" /> para soportar prefijos arbitrarios (`videos/`, `chat/`, `product-images/`) y que `chat-storage.ts` y `product-image-storage.ts` sean wrappers. Si no, documentar la deuda técnica y crear el wrapper específico sin copiar la lógica de credenciales innecesariamente.

### Fase 4 — API y servicios

1. **Preparar subida**
   - Server Action en `src/app/(panel)/productos/actions.ts` (o endpoint en `src/app/api/productos/imagen/preparar/route.ts`) autenticado y con rol `admin`, que reciba `{ name, type, size }` y devuelva `UploadInstructions`.
   - Usar `product-image-storage.prepareProductImageUpload`.

2. **Subida directa (solo `local`)**
   - `POST /api/productos/imagen/upload` en `src/app/api/productos/imagen/upload/route.ts`, autenticado con `admin`.
   - Recibe `key` y `file` en `FormData`, valida la clave, el tipo MIME y el tamaño, y guarda con `saveProductImage`.
   - Devuelve `{ url: publicUrl }`.

3. **Lectura pública**
   - `GET /api/productos/imagen/[key]` en `src/app/api/productos/imagen/[key]/route.ts`.
   - No requiere autenticación (es para el catálogo público).
   - Validar que el `key` pertenece a un producto activo, no eliminado y vendible; de lo contrario devolver `404`.
   - Leer el archivo con `readProductImage` y responder con `Content-Type` y `Cache-Control` adecuados.

4. **Servicios de producto**
   - Actualizar <ref_file file="C:/developer/paginas/pancheria/src/lib/zod-schemas.ts" /> (`productBaseSchema` y `productUpdateSchema`) para aceptar `imageUrl`, `imageKey`, `imageMimeType`, `imageSize` opcionales. `imageUrl` debe ser una URL válida cuando esté presente.
   - En `productService.createProduct` y `updateProduct`, si `imageUrl` viene sin `imageKey`, validar la URL con `validateProductImageUrl` antes de guardar. Opcionalmente realizar un `HEAD` para verificar que responde y obtener `imageMimeType`/`imageSize`.
   - Al reemplazar una imagen subida (`imageKey` existente) por una nueva subida o una URL, borrar el archivo local anterior si `STORAGE_PROVIDER=local`.
   - Actualizar <ref_file file="C:/developer/paginas/pancheria/src/application/services/productService.ts" /> para permitir crear/actualizar productos con esos campos.
   - Actualizar <ref_file file="C:/developer/paginas/pancheria/src/application/services/catalogService.ts" /> (`PublicCatalogProduct` y `toPublicCatalogProduct`) para incluir `imageUrl` en la respuesta pública.

### Fase 5 — Formulario de promo

En <ref_file file="C:/developer/paginas/pancheria/src/components/productos/promo-form.tsx" />:

- Agregar un componente interno o reutilizable `ProductImageUploader` que maneje dos modos:
  1. **Subir archivo:** input tipo `file` con `accept` dinámico desde `getProductImageAllowedMimeTypes()`, validación de tamaño y tipo en cliente, preview de la imagen seleccionada.
  2. **Usar URL externa:** input de texto para pegar una URL, validación de formato y dominio en cliente, preview cargando la URL en un `<img>`.
- Permitir alternar entre modos con un toggle o botones (radio/select). Al cambiar de modo, limpiar el valor del modo anterior.
- Estado adicional en `PromoForm`: `imageMode: 'upload' | 'url'`, `imageFile`, `imageUrlInput`, `imagePreview`.
- Flujo al crear una promo:
  1. Crear el producto base con `POST /api/productos` (sin imagen).
  2. Si el modo es `upload` y hay archivo, subirlo y obtener `imageUrl` + `imageKey` + `imageMimeType` + `imageSize`.
  3. Si el modo es `url` y hay valor, validarlo y usarlo como `imageUrl` (con `imageKey: null` y sin subida).
  4. Actualizar el producto con `PUT /api/productos/{id}` incluyendo los campos correspondientes.
  5. Guardar la receta con `POST /api/recetas`.
- Flujo al editar una promo:
  1. Si el modo es `upload` y hay nuevo archivo, subirlo.
  2. Si el modo es `url` y hay nueva URL, validarla.
  3. Actualizar el producto con `PUT` (incluyendo imagen nueva, cambio a URL o `imageUrl: null` si se quitó).
  4. Guardar la receta.
- Manejar errores de subida o URL inválida sin dejar el producto en un estado inconsistente: si falla la imagen, informar al usuario y permitir reintentar desde la edición.
- Si el producto ya tenía una imagen subida y se cambia a URL (o se quita la imagen), el componente debe indicar al servicio que elimine el archivo local anterior.

> **Alternativa (futura):** si se desea atomicidad, evaluar convertir `PromoForm` a Server Actions, de modo que toda la creación/edición + imagen + receta ocurra en un único `formAction`. Eso implica un refactor mayor y no es obligatorio para la primera entrega.

### Fase 6 — Catálogo público y panel

- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/product-card.tsx" />: agregar renderizado condicional de la imagen si `product.imageUrl` existe. Usar `object-cover`, alt con el nombre del producto y un fallback visual (ícono `ImageOff` de `lucide-react` o similar) cuando no haya imagen.
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-catalog-section.tsx" />: no requiere cambios si `ProductCard` ya recibe `imageUrl`.
- Opcional: en <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/productos/page.tsx" /> agregar una miniatura en la tabla de productos para confirmar visualmente que la imagen quedó guardada.

### Fase 7 — Seguridad y CSP

- Si se sirven imágenes locales a través de `/api/productos/imagen/[key]`, no se requiere modificar la CSP actual (`img-src 'self'` es suficiente).
- Para imágenes subidas a `vercel-blob`, `s3` o `r2`, el cliente accede directamente a URLs remotas. Se debe ampliar `img-src` en <ref_file file="C:/developer/paginas/pancheria/next.config.ts" /> para incluir los dominios de esos proveedores, **obtenidos dinámicamente de las variables de entorno en lugar de hardcodearlos**.
- Para URLs externas ingresadas por el administrador, se ofrecen dos estrategias:
  1. **Lista de dominios permitidos:** `PRODUCT_IMAGE_ALLOWED_EXTERNAL_DOMAINS` limita las URLs que se aceptan y, al mismo tiempo, `next.config.ts` lee esa misma variable para extender `img-src` en la CSP.
  2. **Proxy interno:** si se prefiere no tocar la CSP, crear `GET /api/productos/imagen/proxy?url=...` que valide la URL, descargue la imagen y la sirva bajo el dominio propio. Esto mantiene `img-src 'self'` pero agrega carga al servidor y latencia.
- El endpoint de lectura pública debe validar que el `key` corresponda a un producto activo, no eliminado y vendible; nunca exponer paths del filesystem.

### Fase 8 — Limpieza y extensiones futuras

- Opcional: agregar un cron `product-images-cleanup` (o reutilizar el esquema de <ref_file file="C:/developer/paginas/pancheria/src/app/api/cron/chat-attachments-cleanup/route.ts" />) que borre archivos locales bajo `product-images/` cuyo `imageKey` no esté asociado a ningún producto.
- Opcional futuro: migrar a tabla `product_images` si se necesitan múltiples imágenes por producto. En ese caso `products.imageUrl` pasaría a ser un `view` de la imagen marcada como principal.

### Fase 9 — Tests

#### Tests unitarios

- <ref_file file="C:/developer/paginas/pancheria/src/application/services/productService.test.ts" />: productos con imagen subida, con URL externa y sin imagen; update que cambia de una fuente a otra.
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/productos/route.test.ts" /> y <ref_file file="C:/developer/paginas/pancheria/src/app/api/productos/[id]/route.test.ts" />: POST/PUT con campos de imagen y rechazo de URLs no HTTPS o dominios no permitidos.
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/catalogo/route.test.ts" />: productos del catálogo incluyen `imageUrl`.
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/product-card.test.tsx" />: muestra la imagen cuando `imageUrl` existe; muestra fallback cuando no.
- Tests del nuevo `src/lib/product-image-storage.ts` con `jest.mock` de los proveedores y casos de validación de URLs externas.

#### Tests E2E

- Actualizar o agregar un test que cree una promo con imagen subida y verifique que aparece en `/pedido`.
- Agregar un test que cree una promo con una URL externa y verifique que el catálogo la renderiza.
- Ejecutar `npm run test:e2e` solo en una base de datos descartable (ver <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />).

### Fase 10 — Verificaciones finales

| Comando | Propósito |
| ------- | --------- |
| `npx tsc --noEmit` | Verificación de tipos |
| `npm run lint` | Estilo y calidad |
| `npm test` | Tests unitarios |
| `npm run build` | Build de producción |
| `npx drizzle-kit push` | Aplicar migraciones en desarrollo |
| `npm run test:e2e` | Tests E2E en base descartable |

## Consideraciones de seguridad y entorno

- No hardcodear credenciales, URLs de APIs ni parámetros sensibles. Usar variables de entorno y los getters de `src/config/product-images.ts`.
- Validar siempre que una URL externa use `https://` y rechazar esquemas como `javascript:`, `data:` o `vbscript:`.
- Si se permite cualquier dominio en URLs externas, considerar usar el proxy `/api/productos/imagen/proxy` para no ampliar indebidamente la CSP y evitar filtración de la IP del cliente en referrers.
- No usar `STORAGE_PROVIDER=local` en producción; el filesystem de Vercel es efímero y las imágenes pueden perderse.
- Ejecutar tests E2E solo en bases de datos descartables cuyo nombre termine en `test`, `e2e`, `testing`, `qa` o `staging`.
- Aplicar migraciones en producción siguiendo el flujo de `.devin/informes/entornos.md`.
- Mantener `.env.local` fuera del control de versiones y rotar credenciales si se expusieron.

## Referencias clave

- <ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/domain/types.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/lib/zod-schemas.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/productos/promo-form.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/product-card.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/catalogService.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/lib/storage.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/lib/chat-storage.ts" />
- <ref_file file="C:/developer/paginas/pancheria/next.config.ts" />
- <ref_file file="C:/developer/paginas/pancheria/.env.example" />
