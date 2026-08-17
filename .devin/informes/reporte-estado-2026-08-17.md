# Reporte de estado — Auditoría y sincronización de documentación

**Fecha:** 2026-08-17  
**Proyecto:** `pancheria`  
**Prompt base:** <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/auditoria-y-documentacion.md" />

---

## 1. Resumen ejecutivo

Se realizó una auditoría documental para verificar que `AGENTS.md`, `README.md`, `.env.example`, `.devin/environment.yaml`, `.devin/prompts/auditoria-y-documentacion.md` y los informes vigentes coincidan con el código implementado. Se encontraron **dos discrepancias documentales menores** relacionadas con variables de entorno (`NEXT_PUBLIC_APP_URL` y `RATE_LIMIT_STORE_PROVIDER`) y se aplicaron las correcciones correspondientes. No se modificó código de negocio. Las verificaciones automatizadas (`lint`, `tsc`, `test`, `build`) pasan sin errores.

El prompt de auditoría fue reescrito para ser más estructurado, contextual y accionable, y se guardó en `.devin/prompts/auditoria-y-documentacion.md`.

---

## 2. Comandos ejecutados

| Paso | Comando | Resultado |
| ---- | ------- | --------- |
| 1 | `npm run lint` | Pasa (eslint exit 0) |
| 2 | `npx tsc --noEmit` | Pasa (sin errores de tipos) |
| 3 | `npm test` | 61 suites, 682 tests pasan |
| 4 | `npm run build` | Build de producción exitoso (49 páginas) |
| — | `npx tsx src/db/seeds.ts` | No ejecutado (modifica datos) |
| — | `npx drizzle-kit check` | No ejecutado (sin cambios de esquema) |
| — | `npm run test:e2e` | No ejecutado (trunca tablas; requiere confirmación) |

---

## 3. Alcance funcional verificado

| Dominio | Estado | Archivos de referencia |
| ------- | ------ | ---------------------- |
| Autenticación | Login con credenciales, sesión JWT, roles `admin`/`operator`, rate limiting, protección de rutas. | <ref_file file="C:/developer/paginas/pancheria/src/auth.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/application/services/authService.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/lib/rate-limit-store.ts" /> |
| Multi-sucursal | Tabla `branches`, `branchId` en usuarios, productos, cajas, ventas, pedidos, movimientos de stock y cierres; aislamiento de datos. | <ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/sucursales/page.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/usuarios/page.tsx" /> |
| Productos | CRUD con soft delete, tipos (`critical_supply`, `compound`, `manual_supply`, `service`), recetas. | <ref_file file="C:/developer/paginas/pancheria/src/application/services/productService.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/repositories/productRepository.ts" /> |
| Recetas | Asociación de promos con insumos críticos, auto-descuento, validaciones. | <ref_file file="C:/developer/paginas/pancheria/src/application/services/recipeService.ts" /> |
| Stock | Ajustes, restock, alertas de stock bajo, historial de movimientos, reservas de pedidos y reintegros. | <ref_file file="C:/developer/paginas/pancheria/src/application/services/stockService.ts" /> |
| Ventas | Terminal táctil, disponibilidad en tiempo real, carrito, medios de pago, anulación con reintegro. | <ref_file file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" /> |
| Pedidos públicos | Catálogo en `/pedido`, carrito con `localStorage`, reserva de stock, WhatsApp, rate limit por IP. | <ref_file file="C:/developer/paginas/pancheria/src/app/(public)/pedido/page.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/pedido/route.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" /> |
| Gestión de pedidos | Listado, detalle, confirmación como venta y cancelación desde `/pedidos`. | <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/pedidos/page.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/pedidos/[id]/page.tsx" /> |
| Caja | Apertura, cierre, auto-cierre, historial, papelera (soft delete, restore, hard delete). | <ref_file file="C:/developer/paginas/pancheria/src/application/services/cashRegisterService.ts" /> |
| Cierre diario | Generación por fecha, validación de duplicados, exportación CSV, historial. | <ref_file file="C:/developer/paginas/pancheria/src/application/services/closureService.ts" /> |
| Videos | Subida, listado, reproducción, streaming y soporte Cast; almacenamiento configurable en `local`, `vercel-blob`, `s3` o `r2`. | <ref_file file="C:/developer/paginas/pancheria/src/application/services/videoService.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/lib/storage.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/config/videos.ts" /> |
| Tour interactivo | Recorrido con `driver.js`, persistencia en `localStorage`, inicio desde el navbar. | <ref_file file="C:/developer/paginas/pancheria/src/components/tour/tour-context.tsx" /> |

---

## 4. Hallazgos y acciones correctivas

| Gravedad | Discrepancia | Documentos afectados | Estado |
| -------- | ------------ | -------------------- | ------ |
| Menor | `NEXT_PUBLIC_APP_URL` se consume en `src/lib/storage.ts` para construir URLs locales de videos, pero no estaba documentado en `.env.example`, `AGENTS.md`, `README.md` ni `.devin/environment.yaml`. | <ref_file file="C:/developer/paginas/pancheria/.env.example" />, <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />, <ref_file file="C:/developer/paginas/pancheria/README.md" />, <ref_file file="C:/developer/paginas/pancheria/.devin/environment.yaml" /> | Resuelto: se agregó la variable como opcional y se aclaró que tiene prioridad sobre `NEXTAUTH_URL` para videos en modo `local`. |
| Menor | `RATE_LIMIT_STORE_PROVIDER` se documentaba con un default de `memory`, pero `src/lib/rate-limit-store.ts` elige `DbRateLimitStore` por defecto en producción cuando hay base de datos disponible. | <ref_file file="C:/developer/paginas/pancheria/.env.example" />, <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />, <ref_file file="C:/developer/paginas/pancheria/.devin/environment.yaml" /> | Resuelto: se ajustó la documentación para reflejar el comportamiento real (memory en dev/test, db por defecto en prod con DB). |
| Informativo | README y `AGENTS.md` ya describen correctamente `src/config/` incluyendo videos; `AGENTS.md` describe correctamente `login_attempts` y la migración `0007_boring_scorpion.sql`. | — | Confirmado: sin acciones. |

### Código de referencia

`src/lib/storage.ts` lee `NEXT_PUBLIC_APP_URL` con fallback a `NEXTAUTH_URL`: <ref_snippet file="C:/developer/paginas/pancheria/src/lib/storage.ts" lines="44-50" />.

`src/lib/rate-limit-store.ts` selecciona el proveedor según el entorno: <ref_snippet file="C:/developer/paginas/pancheria/src/lib/rate-limit-store.ts" lines="67-90" />.

---

## 5. Recomendaciones y consejos

1. **Revisar periódicamente las variables de entorno**: cada vez que se agregue un `process.env.*` en el código, actualizar `.env.example`, `AGENTS.md`, `README.md` (si es pública) y `.devin/environment.yaml` para evitar sorpresas en producción.
2. **Preferir explicitar defaults en el código y en la documentación**: variables como `RATE_LIMIT_STORE_PROVIDER` tienen comportamiento condicional; documentar el default por entorno reduce errores de operación.
3. **Ejecutar `npm run test:e2e` en una base de datos de prueba** para validar flujos críticos de UI, incluyendo videos y cambio de sucursal.
4. **Considerar la expiración automática** de pedidos `pending` si el negocio necesita liberar stock sin intervención manual (pendiente desde informes anteriores).
5. **Verificar el proveedor de almacenamiento de videos en producción** (`STORAGE_PROVIDER`, credenciales y `NEXT_PUBLIC_*` de Cast) antes del deploy.
6. **Mantener el prompt de auditoría actualizado**: el prompt mejorado en `.devin/prompts/auditoria-y-documentacion.md` puede reutilizarse para auditorías futuras.

---

## 6. Conclusión

La documentación principal del proyecto está alineada con el código implementado. Las únicas discrepancias detectadas fueron documentales y ya fueron corregidas. Las verificaciones automatizadas pasan, por lo que los cambios no introdujeron regresiones. Quedan pendientes las recomendaciones habituales de tests E2E, monitoreo de streams y configuración de variables de producción.
