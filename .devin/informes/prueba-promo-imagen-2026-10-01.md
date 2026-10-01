# Prueba — Promo con imagen y visibilidad en `/pedido`

**Estado:** completado. La tarea tenía desvíos reales: **3 bugs corregidos** (catálogo caído por URL de imagen, botón "Usar URL" inerte, magic bytes omitidos en providers remotos), más **3 endurecimientos** en la pasada de corroboración (race del form de promo, `imageUrl` suplantable con key reenviada, redirect roto del stream de video con blob). Se verificó el flujo completo bajo `local` y `vercel-blob`.
**Fecha:** 2026-10-01
**Alcance:** auditoría del spec + ejecución manual completa (Playwright MCP + scripts tsx contra la DB de dev) del alta/edición/baja de promos con imagen, casos negativos, flujo de URL externa y limpieza.
**Motivación:** verificar que una promo con imagen ilustrativa persista correctamente y sea visible en el catálogo público `/pedido`, bajo `STORAGE_PROVIDER=local` (dev/E2E) y `vercel-blob` (config real de `.env.local`).

---

## 0. Resumen ejecutivo

La implementación de la tarea era correcta en estructura (rutas, formulario, secuencia de guardado, permisos, borrado de archivos), pero **la imagen subida por archivo no se veía en `/pedido` bajo ningún provider**: `resolveProductImage` regeneraba la URL desde `image_key` produciendo valores no servibles por `next/image`, lo que **tumbaba el catálogo entero** (render vacío, no solo la card). Además el botón "Usar URL" no funcionaba sin imagen previa y la validación de magic bytes solo corría en el provider local. Los tres defectos fueron corregidos y re-verificados empíricamente.

### Bugs corregidos (esta sesión)

| # | Bug | Archivo(s) | Fix |
|---|-----|-----------|-----|
| B1 | `resolveProductImage` regeneraba URLs no servibles: `https://blob.vercel-storage.com/<key>` **fabricada** para vercel-blob (404 real, nunca sirve contenido) y `http://localhost:3000/...` absoluta para local (fuera de `remotePatterns`). `next/image` lanza `Invalid src prop` en render → **`/pedido` quedaba vacío por completo** ante cualquier promo con imagen subida. | `src/lib/product-image-storage.ts` | blob → usa `image_url` persistida (la real, `<storeId>.public.blob.vercel-storage.com`); local → ruta relativa `/api/productos/imagen/<key>?branchId=<id>`; además las URLs externas se filtran contra los orígenes renderizables y degradan a `null` (ícono) en vez de romper el catálogo. |
| B1b | Next 16 bloquea srcs locales con query string sin `images.localPatterns`. | `next.config.ts` | `localPatterns: [{ pathname: '/api/productos/imagen/**' }]`. |
| B2 | Botón "Usar URL" inerte cuando `source==='none'`: ambos branches de `handleModeChange` hacían `onChange({source:'none'})` y `mode` se derivaba del value → el input `#product-image-url` nunca aparecía sin imagen previa. El flujo de URL solo era alcanzable editando una promo que ya tuviera imagen. | `src/components/productos/product-image-uploader.tsx` | Estado `modeOverride` explícito; al pasar a modo URL desde 'none' el input aparece. Bonus: URLs inválidas ya no son borradas en silencio por el `onError` del preview (no se intenta cargar el `<img>` si no pasa la validación de cliente). |
| B3 | `assertFileSignature` (magic bytes) solo corría en `POST /api/productos/imagen/upload` (local). Con `vercel-blob`/`s3`/`r2` el archivo viaja directo al proveedor → un `.jpg` falso se **aceptaba y persistía**. | `src/lib/storage.ts`, `src/lib/product-image-storage.ts`, `src/application/services/productService.ts` | Nuevo `verifyUploadedProductImage(key, mimeType, productId, branchId)` invocado desde `updateProduct`/`createProduct` cuando llega `imageKey` nueva: lee el objeto en el store **por key** (sin SSRF: blob vía `get()` del SDK, S3/R2 vía `GetObjectCommand` con `Range`), verifica firma y pertenencia al producto, y devuelve la **URL canónica** que el servidor persiste (la `imageUrl` del cliente se ignora). Si falla → 400 y se borra el objeto huérfano del provider. |

### Evidencias visuales (`.devin/informes/shots/`)

- `promo-imagen-01-form-preview.png` — form de promo con vista previa del JPG seleccionado.
- `promo-imagen-02-catalogo-roto.png` — `/pedido` **vacío** antes del fix (B1 bajo provider local).
- `promo-imagen-03-editar-guardada.png` — edición con imagen guardada ("14.6 KB · image/jpeg").
- `promo-imagen-04-pedido-url-externa.png` — card en `/pedido` con imagen externa (Wikimedia) servida por `/_next/image`.
- `promo-imagen-05-pedido-upload-local.png` — card en `/pedido` con imagen subida en provider local (post-fix).

---

## 1. Criterios de aceptación

| Criterio | Estado | Evidencia |
|---|---|---|
| Promo se crea sin errores | ✅ | `POST /api/productos` → 201; redirect a `/productos`. IDs de prueba: 195, 196, 197, 198, 199. |
| Upload persiste `image_url`, `image_key`, `image_mime_type`, `image_size` | ✅ | promo 195: `image_url=http://localhost:3000/api/productos/imagen/product-images%2F195%2F….png?branchId=1`, `image_key=product-images/195/…png`, `image_mime_type=image/png`, `image_size=6833`. Promo 197 (blob): `image_url=https://xXpKdw0YlnCYqBjz.public.blob.vercel-storage.com/product-images/197/…jpg`, key/mime/size completos. |
| URL externa solo persiste `image_url` | ✅ | promo 198: `image_url=https://…blob.vercel-storage.com/…`, `image_key/mime/size = null`. |
| Aparece en `/productos` con tipo "Promo" y badge vendible | ✅ | Fila "Pancho completo QA" · Promo · "V"; la tabla no muestra imagen (confirmado, es lo esperado). |
| Imagen visible en `/pedido` | ✅ post-fix | Antes: catálogo vacío (B1). Ahora: 48 cards; la card 199 muestra `/_next/image?url=/api/productos/imagen/…&w=3840` con `naturalWidth=464`; la 197 igual vía blob. |
| URL responde 200 y MIME correcto | ✅ | `GET /api/productos/imagen/<key>?branchId=1` → 200 `image/jpeg`/`image/png`. Blob URL pública → 200. |
| URL local sin `branchId` → 400 | ✅ | `GET /api/productos/imagen/<key>` → 400 `{"error":"Falta el parámetro branchId."}` |
| URL de promo inactiva/eliminada → 404 | ✅ | Tras DELETE: la URL devuelve 404 aunque el archivo siga en disco (verificado post soft-delete de 195). |
| Edición muestra imagen guardada + Quitar/Subir/URL | ✅ | `/productos/195/editar` mostró preview real + "14.6 KB · image/jpeg" + los 3 botones. |
| Reemplazo borra archivo anterior | ✅ | 195: JPG→PNG, la key vieja desapareció de disco. 197 (blob): tras reemplazar, `head()` del store confirma la key vieja NO EXISTE (el 200 por curl era caché CDN). |
| "Quitar imagen" limpia campos y borra archivo | ✅ | 195: `image_* = null` en DB y archivo fuera de disco. |
| Tipo no permitido (.gif) → error sin crear | ✅ | Error cliente: "Tipo no permitido. Permitidos: image/jpeg, image/png, image/webp." |
| Tamaño > límite (6.3 MB) → error sin crear | ✅ | Error cliente: "El archivo supera el límite de 5.0 MB." |
| Falso `.jpg` → rechazado por magic bytes | ✅ local + ✅ remoto post-fix | local: `POST /imagen/upload` → 400 "El contenido del archivo no coincide con el tipo declarado." **blob post-fix**: el PUT a `vercel.com/api/blob` sube (200) pero `PUT /api/productos/197` → **400** mismo mensaje y el objeto huérfano queda borrado (`head` → no existe). |
| URL `http://` → rechazada en cliente | ✅ post-fix | "La URL debe comenzar con https://." visible y el valor se conserva (antes el `onError` del preview lo borraba sin mensaje). Servidor también rechaza: `http://…` → 400. |
| URL HTTPS de dominio permitido → se guarda y renderiza | ✅ | `upload.wikimedia.org` (var configurada en la corrida local) → PUT 200, card renderizó vía `/_next/image` (naturalWidth 217). Con blob: URL del propio store (host whitelisted por remotePatterns) → idem. |
| Dominio no listado → puede guardarse pero no mostrarse | ✅ post-fix, más estricto | Antes: se guardaba **y tumbaba todo el catálogo**. Ahora: `evil.example.com` se guarda (200, sin allowlist configurada) pero `resolveProductImage` lo filtra a `null` → card con ícono, catálogo intacto (48 cards). Además con `PRODUCT_IMAGE_ALLOWED_EXTERNAL_DOMAINS` configurada, el PUT rechaza directamente: `placehold.co` → 400. |

## 2. Secuencia de red observada

Feliz (upload local), promo 195 — orden exacto del spec:

```
201 POST /api/productos
200 POST /api/productos/imagen/preparar
200 POST /api/productos/imagen/upload
200 PUT  /api/productos/195
201 POST /api/recetas
```

Feliz (vercel-blob), promo 197 — el upload va directo a Vercel:

```
200 PUT  /api/productos/197            (datos del form)
200 POST /api/productos/imagen/preparar
200 PUT  https://vercel.com/api/blob/?pathname=product-images/197/…jpg
200 PUT  /api/productos/197            (campos de imagen; el server verifica firma y fija la URL canónica)
201 POST /api/recetas
```

Rechazo por magic bytes (local), promo 196:

```
201 POST /api/productos                ← promo creada
200 POST /api/productos/imagen/preparar
400 POST /api/productos/imagen/upload  ← firma inválida
(fin: sin PUT ni recetas → quedó sin imagen ni receta; se eliminó en limpieza)
```

Rechazo por magic bytes (vercel-blob, post-fix), promo 197:

```
200 PUT  /api/productos/197
200 POST /api/productos/imagen/preparar
200 PUT  https://vercel.com/api/blob/?pathname=…X0Ng3wkXSa7N5Zv6DSZa7.jpg
400 PUT  /api/productos/197            ← verifyUploadedProductImage rechaza
       → el objeto huérfano se borra del store (head → no existe)
       → la imagen previa queda intacta
```

## 3. Endurecimientos adicionales introducidos por el fix

Verificados vía `PUT /api/productos/<id>` con sesión admin:

- `imageKey` inexistente en el store → 400 "No se encontró la imagen subida en el almacenamiento remoto."
- `imageKey` de otro producto (`product-images/197/…` contra el 198) → 400 "La clave de imagen no corresponde al producto indicado."
- `imageUrl` suplantada junto a una key válida → la URL persistida es la **canónica resuelta por el servidor** (`blob.url` / URL derivada S3/R2 / URL local), no la del cliente.
- `imageKey` en `POST /api/productos` → 400 (las keys son `product-images/<id>/` y el id aún no existe en el alta).
- `imageKey` reenviada **sin cambios** junto a una `imageUrl` distinta → el servidor ignora la URL del cliente y conserva la persistida (la canónica ya verificada). Agregado en la pasada de corroboración: antes ese camino no re-validaba ni re-verificaba.
- **Backstop de huérfanos**: si la eliminación en el `catch` del PUT falla (p. ej. caída del proceso a mitad de request), el objeto queda sin referencia y el cron `GET /api/cron/chat-attachments-cleanup` ya lo barre — ejecuta `cleanupOrphanedProductImages()`, que lista claves `product-images/` no referenciadas en `products.image_key` y las borra. Verificado leyendo `cleanupService` y la route.

## 4. Desvíos del documento de tarea

1. **`STORAGE_PROVIDER=local` no estaba en `.env.local`** (usa `vercel-blob`). Se corrió con overrides de proceso sin tocar el archivo. Además, la spec asumía que `local` "es solo para dev/E2E" y funcionaba: en realidad el catálogo se rompía con cualquier imagen local (B1).
2. **"Rechazos sin persistir nada" no se cumple para magic bytes**: el `POST /api/productos` ya corrió → la promo persiste sin imagen **y sin receta** (la cadena aborta antes de `POST /api/recetas`). Confirmado con la promo 196. Es el comportamiento conocido documentado en la propia spec ("sin rollback") — la redacción del criterio es imprecisa, no un bug nuevo.
3. **"URL de dominio no listado puede guardarse pero no mostrarse (cae al ícono)"** era peor: no caía al ícono, **tumbaba `/pedido` entero** (B1). Post-fix sí cae al ícono.
4. **Badge de catálogo sin stock dice "Agotado"**, no "sin disponibilidad" (cosmético).
5. **La URL persistida para blob es la real** (`<storeId>.public.blob.vercel-storage.com`); la función `getProductImagePublicUrlForVercelBlob` fabricaba `blob.vercel-storage.com/<key>` que da 404 real — corregido usando `image_url`.
6. **Race en el form de promo** *(corregida en la pasada de corroboración)*: escribir `#promo-name` mientras `load()` (fetch de insumos) sigue en vuelo hacía que `setForm({...emptyForm})` pise el nombre → submit bloqueado por requerido. Causa exacta: cada invocación de `load()` escribía el form al resolver sin cancelación; el doble-effect de StrictMode (dev) o un cambio de `product` dejaba una carga obsoleta como último escritor. Fix: guardia `cancelled` en el `useEffect` (`promo-form.tsx`). `product-form.tsx` no la padece (inicializa el estado síncronamente desde props).
7. El endpoint `DELETE /api/productos/eliminadas` **vacía toda la papelera** del rango — no existe delete permanente por id vía API; por UI sí (diálogo por fila). No correr el endpoint a mano para limpiar datos puntuales.

## 5. Hallazgos fuera de alcance

- **Productos simples no tienen imagen** (pestaña "Producto" sin uploader) — confirmado; es comportamiento esperado según la spec, queda como decisión de negocio.
- **Videos/chat con URL fabricada — verificado en la pasada de corroboración:** chat NO está afectado (persiste la URL real del blob en el attachment y el cliente la usa directo; `GET /api/chat/attachment/[key]` devuelve 404 intencional en remoto). Videos tampoco se rompen en reproducción (`VideoPlayer` usa `fileUrl`, la URL real persistida). El único camino con la URL fabricada era el redirect de `GET /api/videos/<key>/stream` con provider remoto — latente, porque `file_url` remoto nunca es una key pelada — y quedó corregido: para `vercel-blob` resuelve el objeto con `get(key)` del SDK y redirige al `blob.url` real (404 si no existe). La firma `getPublicUrl` sigue fabricando `blob.vercel-storage.com/<key>` pero ya no quedan consumidores que la usen para blob.
- Errores de consola no relacionados (`/_vercel/insights/script.js` 404 en dev — script de Speed Insights no aplicable localmente).
- La caché HTTP del navegador (`Cache-Control: public, max-age=86400` en la ruta de imagen) puede servir 200 para imágenes de productos recién eliminados — el servidor ya devuelve 404; afecta solo a la verificación desde el mismo navegador.

## 6. Limpieza

- Promos de prueba 195–199: eliminadas permanentemente (`products` y `recipes` sin remanentes).
- Storage local `tmp/videos/product-images/`: vacío.
- Vercel Blob: las 3 keys de la promo 197 (fake, real, huérfana del rechazo) → `head()` confirma que no existen.
- Scripts temporales `scripts/tmp-*.ts`: eliminados tras el informe.
- Dev server: quedó corriendo en background (puerto 3000) con `STORAGE_PROVIDER=local` + `PRODUCT_IMAGE_ALLOWED_EXTERNAL_DOMAINS=upload.wikimedia.org` (overrides de proceso; `.env.local` intacto).

## 7. Archivos modificados

- `src/lib/product-image-storage.ts` — `resolveProductImage` reescrito (blob→image_url persistida, local→ruta relativa, filtro de hosts no renderizables); nuevo `verifyUploadedProductImage` + helpers `readStreamHeader`/`readS3R2ObjectHeader`.
- `src/lib/storage.ts` — exporta `SIGNATURE_READ_BYTES` y nuevo `assertBufferSignature` (reusado por `assertFileSignature`).
- `src/application/services/productService.ts` — verificación de imagen remota en `updateProduct` (solo cuando cambia la key; borra huérfano si falla; si la key no cambia ignora la `imageUrl` del cliente y conserva la persistida) y rechazo de `imageKey` en `createProduct`.
- `src/components/productos/product-image-uploader.tsx` — `modeOverride` (fix del botón "Usar URL") y preview que no intenta cargar URLs inválidas.
- `src/components/productos/promo-form.tsx` — guardia `cancelled` en el `useEffect` de carga (fix de la race que pisaba `#promo-name`).
- `src/app/api/videos/[id]/stream/route.ts` — con `vercel-blob` resuelve la URL real del objeto (`get(key)` → `blob.url`) en vez de redirigir a la URL fabricada.
- `next.config.ts` — `images.localPatterns` para `/api/productos/imagen/**`.
- `src/lib/product-image-storage.test.ts` — tests actualizados al nuevo contrato de `resolveProductImage` (+2 casos nuevos).
- `src/application/services/productService.test.ts` — +2 tests: URL canónica al cambiar key y conservación de `imageUrl` cuando la key no cambia.
- `src/app/api/videos/[id]/stream/route.test.ts` — redirect genérico pasa a `s3`; +2 tests para la resolución real con blob.

Verificación: `tsc --noEmit` limpio, `eslint` limpio en los archivos tocados, **128 tests** de los módulos afectados en verde (119 en las 8 suites de productos/imagen + 9 del stream de video).
