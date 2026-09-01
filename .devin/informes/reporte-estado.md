# Reporte de estado — Proyecto Panchería

**Fecha:** 2026-09-01  
**Proyecto:** `pancheria`  
**Baseline:** `HEAD` — branch `main`  
**Histórico:** las fases previas quedan archivadas en `.devin/informes/archivados/reporte-estado-historico-2026-08-30.md`.

---

## 1. Resumen ejecutivo

El proyecto se encuentra en estado operativo. El build de producción, la verificación de tipos, los tests unitarios, el lint, Knip y el suite E2E pasan correctamente. La funcionalidad principal cubre ventas con pagos mixtos, pedidos con reservas de stock, chat con adjuntos, caja/cierre diario, panel de control, catálogo público, imágenes de productos/promos y videos con soporte de múltiples proveedores de almacenamiento.

La última auditoría documental depuró `README.md`, `AGENTS.md`, `.env.example`, `.devin/environment.yaml`, informes vigentes e índices, y archivó el prompt de mejoras de ventas (`auditoria-y-mejoras-ventas.md`) porque sus objetivos ya estaban implementados.

## 2. Stack y arquitectura

- Next.js `16.3.3` (App Router + Turbopack)
- React `19.2.8`
- TypeScript `5.x`
- Tailwind CSS `4`
- shadcn/ui
- Drizzle ORM `0.45.2`
- PostgreSQL (Neon / `pg`)
- NextAuth v5 (`5.0.0-beta.32`)
- Jest `30.x` (tests unitarios)
- Playwright `1.62.x` (tests E2E)
- Vercel (despliegue recomendado)

## 3. Estado funcional

- **Panel de control (`/`)**: resumen de caja, pedidos por estado, alertas de stock y accesos rápidos filtrados por rol.
- **Ventas (`/ventas`)**: terminal con productos, carrito, pagos mixtos (`cash` + `transfer`), historial y anulaciones.
- **Pedidos**: flujo `pending` → `in_process` → `paid` → `finished` / `cancelled`, con reservas de stock y chat integrado.
- **Productos/promos**: tipos `critical_supply`, `manual_supply`, `compound`, `service`; imágenes ilustrativas en catálogo público.
- **Stock y caja**: movimientos con razones, cierre automático, cierres diarios históricos.
- **Chat de pedidos**: texto e imágenes, paginación con cursores, polling y estados de entrega/lectura.
- **Almacenamiento**: `local`, `vercel-blob`, `s3` y `r2` para videos, adjuntos de chat e imágenes de productos.
- **Multi-sucursal**: aislamiento por `branchId`; admin puede operar sobre cualquier sucursal.

## 4. Verificaciones automáticas

| Comando | Resultado |
|---------|-----------|
| `npm run lint` | Pasa |
| `npx tsc --noEmit` | Pasa |
| `npm test` | 118 suites, 1147 tests pasan |
| `npm run build` | Build exitoso, incluye `/productos/eliminados` y `/videos/eliminados` |
| `npm run knip` | Pasa |
| `npm run test:e2e` | **98 passed** en base descartable |

> **Nota:** la falla anterior de login se debía a que el servidor de E2E no estaba utilizando la base descartable correctamente. Tras verificar la propagación de `DATABASE_URL` y `ADMIN_PASSWORD` (ver <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/archivados/implementar-pendientes-hard-delete-cache.md" />), la suite completa pasó.

## 5. Hallazgos resueltos recientemente

| Hallazgo | Clasificación | Acción aplicada |
|----------|---------------|-----------------|
| `productService.deleteProduct` borraba imagen y recetas durante el soft delete, impidiendo la restauración completa | Mayor | Se corrigió: el soft delete solo marca `deletedAt` e `isActive`; la imagen y las recetas se conservan y se liberan solo en el hard delete. |
| No existía hard delete individual con liberación de archivos para productos y videos | Mayor | Se agregaron `productRepository.hardDelete`, `productService.permanentlyDeleteProduct`, `videoRepository.hardDelete` y `videoService.permanentlyDeleteVideo`. El hard delete de base de datos ocurre antes de liberar el archivo; se validan dependencias históricas. |
| No había UI de papelera para productos y videos | Mayor | Se agregaron las páginas `/productos/eliminados` y `/videos/eliminados`, con Server Actions para restaurar y eliminar permanentemente. |
| Los cachés en memoria de rate limit no se limpiaban al eliminar usuarios o sucursales | Menor | Se agregó `remove` a `RateLimitStore` y su uso en `userService.deleteUser` y `branchService.deleteBranch`. Se expuso un singleton `getRateLimitStore`. |
| `InMemoryPublicOrderRateLimitStore` acumulaba registros expirados | Menor | Se invoca `cleanupExpired` periódicamente dentro de `recordRequest` (cada 100 requests). |
| `VideoList` eliminaba/restauraba videos sin diálogo de confirmación | Menor | Se agregó `ConfirmDialog` a `src/components/videos/video-list.tsx` para eliminar, restaurar y eliminar permanentemente. |
| Nombre confuso `activeProducts` en papelera de productos | Menor | Se renombró a `deletedProducts` en `src/app/(panel)/productos/eliminados/page.tsx`. |
| `deleteByCompoundProductId` en `recipeRepository` no se usaba en producción | Menor | Se eliminó la función y su test; el borrado de recetas al cambiar el tipo de producto sigue manejado en `productService.updateProduct`. |
| Corregir y completar `npm run test:e2e` | Mayor | La suite E2E ahora pasa con 98 tests. Se resolvieron diálogos de confirmación en videos, revalidación de rutas y filtrado de la papelera de videos. |

## 6. Hallazgos resueltos adicionales

| Hallazgo | Clasificación | Acción aplicada |
|----------|---------------|-----------------|
| `AGENTS.md` indicaba fallback `?content=` en chat que ya no existe | Mayor | Se corrigió: los handlers usan `request.json()` y no aceptan query params. |
| Prompt `auditoria-y-mejoras-ventas.md` seguía activo pese a estar resuelto | Mayor | Se archivó en `.devin/prompts/archivados/` y se actualizaron los índices. |
| Variables `NEXT_PUBLIC_PEDIDOS_REFRESH_INTERVAL_MS` y `PRODUCT_IMAGE_URL_MAX_LENGTH` documentadas de forma imprecisa | Menor | Se ajustó `.env.example` y se aclararon defaults/fallbacks. |
| Punto `16.` duplicado en `.devin/environment.yaml` | Menor | Se renumeró y se agregaron variables de ejecución. |
| `README.md` y `AGENTS.md` con `src/lib/` y comandos desactualizados | Menor | Se agregó `npm run knip` y se listaron módulos recientes. |
| `deleteBranch` no eliminaba pedidos, videos ni archivos asociados, lo que generaba FK conflicts y archivos huérfanos | Mayor | Se corrigió: `branchService.deleteBranch` borra `orders` en cascada, `videos`, imágenes de productos, adjuntos de chat y sus archivos en `local`, `vercel-blob`, `s3` y `r2`. Se agregaron `orders` y `videos` al resumen de eliminación. |
| `localStorage` del cliente conservaba datos de sucursales eliminadas (carrito, pedidos recientes, tour) | Mayor | Se corrigió: `usePedidoClient` detecta una sucursal guardada que ya no existe y limpia `pancheria-branch-id`, `pancheria-cart-v1`, pedidos recientes y claves del tour. |
| Nombres de variables en guía de funcionamiento incompletos | Menor | Se corrigieron `CAJA_AUTO_CLOSE_HOURS` y `CAJA_AUTO_CLOSED_BY`. |
| Tests E2E de caja fallaban por `clearSession` insuficiente y el test de rate limit devolvía `201` en lugar de `429` | Mayor | Se agregó `clearSession(page)` a `tests/e2e/helpers.ts`, se robusteció `loginAs` y se configuraron `E2E_ENABLE_RATE_LIMIT=true`, `PUBLIC_ORDER_RATE_LIMIT_ENABLE_IN_DEV=true`, `PUBLIC_ORDER_RATE_LIMIT_MAX_REQUESTS=2` y `TRUSTED_PROXY_IP_HEADER=X-Forwarded-For` en `.github/workflows/ci.yml` y `.env.e2e.example`. Suite E2E: 96 passed. |

## 7. Acciones pendientes recomendadas

| Recomendación | Prioridad | Razón |
|---------------|-----------|-------|
| Evaluar exponer `NEXT_PUBLIC_DASHBOARD_REFRESH_INTERVAL_MS` para evitar el intervalo hardcodeado de 30 s en `useDashboard.ts` | Menor | Reduce la necesidad de deploy para ajustar el refresco del panel. |
| Archivar o resumir fases 1-18 del `reporte-estado.md` previo (ya copiado a `archivados/`) | Menor | Mantiene el informe vigente conciso sin perder histórico. |
| Si avanza el modelo multi-tenant, actualizar `AGENTS.md`, `.env.example` y `.devin/environment.yaml` con variables y rutas del tenant | Futuro | El sistema actual es multi-sucursal, no multi-tenant. |



## 8. Enlaces relevantes

- `README.md` — punto de entrada del repositorio.
- `AGENTS.md` — reglas y convenciones para agentes.
- `.devin/README.md` — índice de `.devin/`.
- `.devin/prompts/README.md` — índice de prompts activos y archivados.
- `.devin/informes/entornos.md` — procedimientos de entornos y credenciales.
- `.devin/informes/guia-funcionamiento-pancheria.md` — conceptos de negocio y flujos.
- `.devin/informes/lecciones-aprendidas.md` — decisiones técnicas y regresiones evitadas.
- `.devin/informes/archivados/reporte-estado-historico-2026-08-30.md` — snapshot completo de fases anteriores.
