# Plan de implementación — Hard delete individual y limpieza de cachés en memoria

> **Estado:** resuelto y archivado en `.devin/informes/archivados/`.  
> **Resumen:** el hard delete individual de productos y videos, la UI de papelera, la limpieza de cachés de rate limit y los ajustes de E2E fueron implementados. El estado final se consolidó en `.devin/informes/reporte-estado.md` y `.devin/informes/lecciones-aprendidas.md`.

**Fecha:** 2026-09-01  
**Proyecto:** `pancheria`  
**Motivación:** cubrir los pendientes documentados en `reporte-estado.md` (sección "Acciones pendientes recomendadas") sobre hard delete con liberación de archivos para productos/videos fuera del flujo de eliminación de sucursal, e invalidación de cachés en memoria del servidor.

**Estado tras auditoría:** ninguno de los objetivos principales está implementado. Existe soft delete/restore básico para productos y videos, pero faltan hard delete individual, liberación de archivos en el momento correcto, UI de papelera y limpieza de cachés.

**Estado tras implementación (resuelto el 2026-09-01):**
- `productService.deleteProduct` ya no borra imagen ni recetas durante el soft delete.
- `productRepository.hardDelete`, `productService.permanentlyDeleteProduct`, `permanentlyDeleteProductAction` y página `/productos/eliminados` implementados.
- `videoRepository.hardDelete`, `videoService.permanentlyDeleteVideo`, `permanentlyDeleteVideoAction` y página `/videos/eliminados` implementados.
- `RateLimitStore` extiende `remove`; `userService.deleteUser` y `branchService.deleteBranch` limpian entradas de rate limit.
- `InMemoryPublicOrderRateLimitStore` ejecuta `cleanupExpired` periódicamente.
- Tests unitarios actualizados y validaciones pasan (`tsc`, `lint`, `npm test`, `npm run build`, `npm run knip`).
- Tests E2E de papelera de productos/videos y rate limit están escritos y pasan: `npm run test:e2e` reporta 98 passed.

---

## 1. Hard delete individual con limpieza de archivos

### 1.1 Hallazgos de la auditoría

| Entidad | Soft delete actual | Hard delete actual | Liberación de archivos | Observaciones |
|---------|-------------------|--------------------|------------------------|---------------|
| **Productos** | `productService.deleteProduct` → `productRepository.softDelete` | No existe | `deleteProductImage(product.imageKey)` se ejecuta **dentro del soft delete** (`src/application/services/productService.ts`, líneas 179-181). Además, `deleteProduct` borra recetas asociadas (líneas 184-185 y 218-220). | Inconsistente: el soft delete destruye la imagen y las recetas, por lo que al restaurar el producto no se recuperan. |
| **Videos** | `videoService.deleteVideo` → `videoRepository.softDelete` | No existe | No se borra el archivo en ningún momento. | El archivo permanece indefinidamente mientras el video esté en papelera. Solo se libera al eliminar la sucursal. La UI de videos (`src/components/videos/video-list.tsx`) ya muestra videos eliminados y un botón "Restaurar", pero no "Eliminar permanentemente". |
| **Cajas** | `cashRegisterService.deleteCashRegister` → `cashRegisterRepository.softDelete` | `permanentlyDeleteCashRegister` y `emptyTrash` vía API | No aplica | No tiene archivos asociados. El flujo de papelera ya está completo y puede usarse como referencia de UX. |

### 1.2 Objetivos

1. **Corregir `productService.deleteProduct`** para que solo realice el soft delete (`deletedAt` y `isActive: false`); **no debe** borrar la imagen ni las recetas. Las recetas deben conservarse porque `recipes.compoundProductId` y `recipes.supplyId` usan `onDelete: 'cascade'`: al hard delete de un producto compuesto se eliminarán en cascada, y el hard delete de un supply usado en recetas de otro producto será bloqueado por la FK. La validación de promos activas debe seguir en el soft delete.
2. **Agregar `productService.permanentlyDeleteProduct` y `productRepository.hardDelete`** que:
   - Requieran que el producto esté en soft delete (`deletedAt` no nulo). Usar `findById(..., includeDeleted = true)`.
   - Realicen el hard delete en base de datos **antes** de liberar el archivo, para evitar perder la referencia de la imagen si una FK `onDelete: 'restrict'` falla.
   - Borren la imagen con `deleteProductImage(imageKey)` (soporta `local`, `vercel-blob`, `s3`, `r2`) solo después de confirmar el hard delete.
   - Validen o capturen restricciones de FK: `sale_items.productId`, `order_items.productId`, `sale_item_recipes.supplyId`, `order_item_recipes.supplyId`, `order_stock_reservations.productId` y `stock_movements.productId` tienen `onDelete: 'restrict'`. Si existe alguna referencia histórica, no se puede borrar definitivamente; se recomienda mantener el producto en papelera y mostrar un mensaje claro.
3. **Agregar `videoService.permanentlyDeleteVideo` y `videoRepository.hardDelete`** que:
   - Requieran que el video esté en soft delete.
   - Realicen el hard delete en base de datos primero.
   - Borren el archivo con `deleteVideoFileByUrl(fileUrl)` después del commit, si el video lo tenía.
   - Ejecuten hard delete de la fila (los videos no tienen dependencias fuertes que referencien a la tabla `videos`).
4. **Exponer Server Actions**:
   - `permanentlyDeleteProductAction` y `restoreProductAction` en `src/app/(panel)/productos/actions.ts` (actualmente solo existe `deleteProduct`).
   - `permanentlyDeleteVideoAction` en `src/app/(panel)/videos/actions.ts` (ya existe `restoreVideoAction`).
5. **Agregar UI de papelera**:
   - `/productos/eliminados` (página Server Component) y/o modo de listado con `includeDeleted=true` en `/productos`, con botones "Restaurar" y "Eliminar permanentemente".
   - `/videos/eliminados` (página Server Component) y/o modo de listado con `includeDeleted=true` en `/videos`. El componente `VideoList` ya admite eliminados; solo falta agregar el botón de hard delete y una ruta/página de papelera.
   - Tomar como referencia el patrón de cajas (`/ventas/historial/eliminadas` y `src/components/caja/caja-history.tsx` con `deletedOnly`), adaptándolo a Server Actions o API routes según la convención de cada módulo.
6. **Actualizar `src/config/routes.ts`** con las nuevas rutas de papelera, por ejemplo `productosEliminados` y `videosEliminados`.
7. **Agregar tests**:
   - Unitarios para `permanentlyDeleteProduct` (casos con y sin imagen, con y sin ventas/pedidos/historial/stock, con proveedores locales y remotos).
   - Unitarios para `permanentlyDeleteVideo` (casos con y sin archivo, con proveedores locales y remotos).
   - Unitarios para `productRepository.hardDelete` y `videoRepository.hardDelete`.
   - Tests de componentes y E2E para la papelera de productos y videos.

### 1.3 Orden de implementación sugerido

1. `videoRepository.hardDelete` y `videoService.permanentlyDeleteVideo` (más simple, sin dependencias).
2. `permanentlyDeleteVideoAction` y ruta `/videos/eliminados` con `VideoList` extendido.
3. Corregir `productService.deleteProduct` para no borrar imagen ni recetas en soft delete.
4. `productRepository.hardDelete` y `productService.permanentlyDeleteProduct`.
5. `permanentlyDeleteProductAction`, `restoreProductAction`, página `/productos/eliminados` y botones de papelera.
6. Actualizar `routes.ts`.
7. Tests (unitarios, componentes, E2E).

### 1.4 Riesgos y mitigaciones

- **Productos con historial de ventas/pedidos/movimientos**: múltiples tablas (`sale_items`, `order_items`, `sale_item_recipes`, `order_item_recipes`, `order_stock_reservations`, `stock_movements`) referencian `products.id` con `onDelete: 'restrict'`. El hard delete fallará si existe cualquier referencia. Mitigación: prevalidar en el servicio o capturar el error de FK y relanzarlo como `ValidationError` con un mensaje que indique que el producto tiene historial y no puede eliminarse.
- **Recetas asociadas**: el soft delete actual destruye recetas. Si no se corrige, la restauración de un producto compuesto no recupera su receta. Mitigación: no borrar recetas en soft delete; confiar en la cascada de FK en el hard delete.
- **Imagen compartida**: si dos productos compartieran el mismo `imageKey`, borrarla afectaría al otro. En la práctica `imageKey` se genera con `productId/nanoid`, pero para mayor seguridad se puede validar que ningún otro producto activo o en papelera use la misma clave antes de borrar el archivo. Si se detecta uso compartido, no eliminar el archivo físico.
- **Orden de liberación de archivos**: si se borra el archivo antes del hard delete y luego falla una FK, se pierde la referencia y el producto/video sigue en base. Mitigación: hard delete de fila primero, luego liberación de archivo.
- **Archivo de video inexistente**: `deleteVideoFileByUrl` ya es idempotente (ignora errores). Mantenerlo así.
- **Transacciones y archivos remotos**: el borrado de archivos no debe estar dentro de la transacción de base de datos porque no es reversible. Ejecutarlo después del commit.

---

## 2. Invalidación de cachés en memoria del servidor

### 2.1 Hallazgos de la auditoría

| Caché | Ubicación | Comportamiento actual | Problema |
|-------|-----------|----------------------|----------|
| `InMemoryRateLimitStore` | `src/lib/rate-limit-store.ts` | `Map<string, { count, lastAttempt }>` | No hay limpieza general de registros expirados. `recordSuccessfulAttempt` borra el usuario específico, pero si un usuario nunca vuelve a intentar o es eliminado, el registro permanece. `authService.ts` mantiene una instancia creada con `createRateLimitStore()`. |
| `DbRateLimitStore` | `src/lib/rate-limit-store.ts` | Misma tabla `login_attempts` | Al eliminar un usuario, las filas de `login_attempts` asociadas a su `username` quedan huérfanas. |
| `InMemoryPublicOrderRateLimitStore` | `src/lib/public-order-rate-limit-store.ts` | `Map<string, { count, resetAt }>` | Tiene `cleanupExpired()` pero nunca se invoca en producción (el cron `rate-limit-cleanup` usa `DbPublicOrderRateLimitStore`). Las IPs inactivas permanecen en el `Map` y cada ruta pública que llama a `createRateLimiter` crea su propia instancia del store. |
| Singletones de proveedores de almacenamiento | `src/lib/storage.ts` | `localProvider`, `vercelProvider`, `s3Provider`, `r2Provider` | No son cachés de contenido, son instancias sin estado del negocio. No acumulan datos y no requieren invalidación. |
| `recent-orders.ts` | `src/lib/recent-orders.ts` | `cachedOrders` / `cachedRaw` | Es un caché de módulo, pero se invalida con `saveOrders` y `cleanupRecentOrdersForBranches`. Además, se usa principalmente en el cliente. No requiere acciones adicionales. |

### 2.2 Objetivos

1. **Agregar `remove(username: string): Promise<void>` a la interfaz `RateLimitStore`** y a ambas implementaciones (`InMemoryRateLimitStore` y `DbRateLimitStore`).
2. **Compartir la instancia del `RateLimitStore`** entre `authService` y los servicios de eliminación para que `remove` funcione en modo `memory`. Opciones:
   - Exportar una función `getRateLimitStore()` desde `authService` (o un módulo compartido) que devuelva el store existente.
   - O convertir `createRateLimitStore()` en un singleton en `rate-limit-store.ts` si no se requiere crear instancias distintas en tests (ajustar los tests con `setRateLimitStore` o reset manual).
3. **Invocar `remove` al eliminar un usuario**:
   - `userService.deleteUser` (hard delete).
   - `branchService.deleteBranch` (obtener los `username` de los usuarios de la sucursal antes del `DELETE`, e invocar `remove` por cada uno fuera de la transacción de base de datos o dentro si se usa `DbRateLimitStore`).
   - `deleteUserAction` continúa llamando al servicio; no requiere cambios.
4. **Limpiar `InMemoryPublicOrderRateLimitStore` periódicamente**:
   - Invocar `cleanupExpired()` dentro de `recordRequest` cada N llamadas para evitar crecimiento del `Map`. Definir una constante interna (p. ej. `CLEANUP_INTERVAL = 100`).
   - Documentar que `PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER=db` es el único modo escalable con múltiples instancias; `memory` es solo para desarrollo/tests o despliegues de una sola función.
5. **No invalidar singletones de proveedores de almacenamiento**:
   - Confirmar en documentación que son instancias sin caché de contenido y no requieren invalidación.
6. **Tests**:
   - Unitarios para `remove` en `InMemoryRateLimitStore` y `DbRateLimitStore`.
   - Unitarios para `cleanupExpired` invocado periódicamente en `InMemoryPublicOrderRateLimitStore`.
   - Verificar que `deleteBranch` y `deleteUser` limpien los intentos de rate limit.

### 2.3 Orden de implementación sugerido

1. Agregar `remove` a `RateLimitStore`, exportar mecanismo de acceso al store y tests.
2. Integrar `remove` en `userService.deleteUser` y `branchService.deleteBranch` y tests.
3. Agregar limpieza periódica en `InMemoryPublicOrderRateLimitStore.recordRequest` y tests.
4. Documentar recomendación de `db` provider en `AGENTS.md` y actualizar `reporte-estado.md`.

### 2.4 Riesgos

- **Rate limit en memoria con múltiples instancias**: `InMemoryRateLimitStore` e `InMemoryPublicOrderRateLimitStore` no comparten estado entre instancias de Vercel. Esto ya está documentado en `AGENTS.md` y `lecciones-aprendidas.md`, pero conviene reforzar la recomendación de usar `db` provider en producción.
- **Borrado de intentos de un usuario que no existe**: `remove` en `DbRateLimitStore` simplemente no borra nada si no hay registro. Es idempotente.
- **Inconsistencia si `remove` se llama con store en memoria distinto**: si `userService` crea una instancia nueva en lugar de compartir la de `authService`, el `Map` en memoria no se limpia. Mitigación: asegurar que se use el mismo singleton de store en toda la aplicación.

---

## 3. Verificaciones requeridas tras la implementación

- `npx tsc --noEmit`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run test:e2e` (base descartable; ver `AGENTS.md` y `.devin/informes/entornos.md`)

---

## 4. Documentación a actualizar

- `AGENTS.md` — agregar notas sobre papelera de productos/videos, rate limit en memoria y recomendación de `PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER=db` en producción.
- `guia-funcionamiento-pancheria.md` — extender sección de eliminación de sucursal con papelera de productos/videos, y agregar nota sobre hard delete individual.
- `reporte-estado.md` — mover los ítems de "Acciones pendientes recomendadas" (hard delete individual y cachés en memoria) a una sección de hallazgos resueltos una vez implementados, o archivarlos si se prefiere mantener el informe vigente conciso.
- `.devin/informes/lecciones-aprendidas.md` — si se toman decisiones nuevas (por ejemplo, no borrar recetas/imagen en soft delete, orden de liberación de archivos, singleton de rate limit), documentarlas.

---

## 5. Refinamientos posteriores resueltos

Durante el seguimiento del plan se aplicaron las siguientes correcciones menores:

1. **UX consistente en videos**: `src/components/videos/video-list.tsx` ahora muestra un diálogo de confirmación antes de eliminar, restaurar o eliminar permanentemente un video, igual que `ProductActions` y `ProductTrashActions`.
2. **Nombre descriptivo en la papelera de productos**: en `src/app/(panel)/productos/eliminados/page.tsx` se renombró `activeProducts` a `deletedProducts` para reflejar que el listado filtra productos con `deletedAt !== null`.
3. **Código muerto eliminado**: se eliminó `deleteByCompoundProductId` de `src/repositories/recipeRepository.ts` y su test, porque `productService.updateProduct` maneja el borrado de recetas directamente dentro de la transacción.
