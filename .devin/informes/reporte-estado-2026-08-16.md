# Reporte de estado — Actualización de documentación y sincronización funcional

**Fecha:** 2026-08-16  
**Proyecto:** `pancheria`  
**Prompt base:** <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/auditoria-y-documentacion.md" />

---

## 1. Resumen ejecutivo

Se realizó una auditoría documental para alinear `AGENTS.md`, `README.md`, `.devin/environment.yaml` y `.devin/prompts/pancheria.prompt.md` con el estado real del proyecto. Se detectaron y corrigieron omisiones relacionadas con la funcionalidad de **videos, reproducción y Cast**, las **variables de entorno de almacenamiento**, las **tablas truncadas por los tests E2E** y el **estado de la tabla `login_attempts`**. No se modificó código de negocio. Las verificaciones automatizadas (`lint`, `tsc`, `build`) pasan sin errores.

---

## 2. Comandos ejecutados

| Paso | Comando | Resultado |
| ---- | ------- | --------- |
| 1 | `npm run lint` | Pasa (eslint exit 0) |
| 2 | `npx tsc --noEmit` | Pasa (sin errores de tipos) |
| 3 | `npm run build` | Build de producción exitoso (39 páginas) |
| — | `npm test` | No ejecutado en esta tarea documental |
| — | `npm run test:e2e` | No ejecutado (trunca tablas; requiere confirmación) |
| — | `npx tsx src/db/seeds.ts` | No ejecutado (modifica datos) |
| — | `npx drizzle-kit check` | No ejecutado (sin cambios de esquema) |

---

## 3. Alcance funcional vigente

| Dominio | Estado | Archivos de referencia |
| ------- | ------ | ---------------------- |
| Autenticación | Login con credenciales, sesión JWT, roles `admin`/`operator`, rate limiting, protección de rutas. | <ref_file file="C:/developer/paginas/pancheria/src/auth.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/application/services/authService.ts" /> |
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

## 4. Cambios aplicados

### 4.1 `AGENTS.md`

- Se agregó la sección **Videos, reproducción y Cast** con rutas, endpoints, proveedores de almacenamiento y tabla `videos`. <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- Se completó la lista de **variables de entorno**: `RATE_LIMIT_STORE_PROVIDER`, `NEXT_PUBLIC_CAST_RECEIVER_APP_ID`, `NEXT_PUBLIC_CAST_SENDER_SDK_URL`, `NEXT_PUBLIC_VIDEO_MAX_SIZE_MB`, `NEXT_PUBLIC_VIDEO_ALLOWED_MIME_TYPES`, `STORAGE_PROVIDER`, credenciales de Vercel Blob, S3, R2 y `LOCAL_STORAGE_PATH`. <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- Se corrigió la advertencia de tests E2E: `global-setup.ts` también trunca `videos`, `users` y `branches`. <ref_snippet file="C:/developer/paginas/pancheria/tests/e2e/global-setup.ts" lines="11-25" />
- Se aclaró que la tabla `login_attempts` ya existe en `src/db/schema.ts` y fue creada con la migración `0007_boring_scorpion.sql`; no es una tarea futura pendiente. <ref_snippet file="C:/developer/paginas/pancheria/src/db/schema.ts" lines="517-521" />

### 4.2 `README.md`

- Se agregó la sección **Videos, reproducción y Cast** con descripción de funcionalidad, endpoints y variables de entorno. <ref_file file="C:/developer/paginas/pancheria/README.md" />
- Se actualizó la estructura del proyecto para incluir `videos` en `src/config/` y `storage` en `src/lib/`. <ref_file file="C:/developer/paginas/pancheria/README.md" />

### 4.3 `.devin/environment.yaml`

- Se agregó el knowledge `videos` con rutas, endpoints, tabla, proveedores de almacenamiento y variables. <ref_file file="C:/developer/paginas/pancheria/.devin/environment.yaml" />
- Se actualizó `estructura` para incluir `src/app/(panel)/videos/` y `src/app/api/videos/`. <ref_file file="C:/developer/paginas/pancheria/.devin/environment.yaml" />
- Se corrigió `e2e` con la lista completa de tablas truncadas. <ref_file file="C:/developer/paginas/pancheria/.devin/environment.yaml" />
- Se actualizó `database` con `videos`, `login_attempts`, `RATE_LIMIT_STORE_PROVIDER` y variables de almacenamiento. <ref_file file="C:/developer/paginas/pancheria/.devin/environment.yaml" />
- Se actualizó `deploy` con las variables de videos y almacenamiento. <ref_file file="C:/developer/paginas/pancheria/.devin/environment.yaml" />

### 4.4 `.devin/prompts/pancheria.prompt.md`

- Se actualizó el contexto para incluir la gestión de videos con reproducción y Cast. <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/pancheria.prompt.md" />
- Se explicitó en la regla de oro que las credenciales de `STORAGE_PROVIDER` y URLs de Cast deben provenir de variables de entorno. <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/pancheria.prompt.md" />

### 4.5 Archivo histórico

- El informe anterior (`2026-08-15`) se archivó en `.devin/informes/archivados/reporte-estado-2026-08-15.md`. <ref_file file="C:/developer/paginas/pancheria/.devin/informes/archivados/reporte-estado-2026-08-15.md" />

---

## 5. Discrepancias documentales detectadas y resueltas

| Gravedad | Documento | Discrepancia | Estado |
| -------- | --------- | ------------ | ------ |
| Media | `AGENTS.md` | No documentaba la funcionalidad de videos, reproducción y Cast. | Resuelto: se agregó sección dedicada. |
| Media | `AGENTS.md` | Lista de variables de entorno incompleta: faltaban `RATE_LIMIT_STORE_PROVIDER`, variables de videos y almacenamiento. | Resuelto: se completó la lista. |
| Media | `AGENTS.md` | Lista de tablas truncadas por E2E incompleta. | Resuelto: se agregaron `videos`, `users` y `branches`. |
| Baja | `AGENTS.md` | `login_attempts` se presentaba como tabla futura a generar. | Resuelto: se aclaró que ya existe en el esquema y en la migración `0007`. |
| Media | `README.md` | No documentaba videos, reproducción ni variables de almacenamiento. | Resuelto: se agregó sección y variables. |
| Media | `.devin/environment.yaml` | No mencionaba videos, storage, `login_attempts`, `RATE_LIMIT_STORE_PROVIDER` ni tablas truncadas completas. | Resuelto: se agregó knowledge `videos` y se actualizaron `estructura`, `e2e`, `database` y `deploy`. |
| Baja | `.devin/prompts/pancheria.prompt.md` | El contexto no incluía videos ni almacenamiento. | Resuelto: se actualizó el contexto y la regla de oro sobre credenciales. |

---

## 6. Riesgos y acciones pendientes

| Riesgo / Acción | Descripción |
| ----------------- | ----------- |
| `npm run test:e2e` | Ejecutar en base de datos de prueba para validar flujos críticos de UI, incluyendo pedidos y videos. |
| `npx tsx src/db/seeds.ts` | No ejecutado. Es idempotente pero modifica datos. Ejecutar solo con confirmación. |
| `npx drizzle-kit check` | Ejecutar tras cambios de esquema futuros para validar consistencia. |
| Rate limiting de pedidos en producción | El rate limit por IP en `POST /api/public/pedido` vive en memoria. En múltiples instancias se recomienda una solución compartida. |
| Expiración automática de pedidos `pending` | Fase 8 del prompt archivado. No implementada. Considerar si el negocio lo requiere. |
| Variables de producción | Confirmar que `NEXTAUTH_URL` coincide con el dominio de Vercel, que `NEXT_PUBLIC_WHATSAPP_NUMBER` está configurado, que `DATABASE_URL` apunta a la base de producción y que las variables de videos/almacenamiento están correctas. |
| Monitoreo de streams | Verificar logs de Vercel para `/api/videos/[id]/stream` tras el deploy. |

---

## 7. Recomendaciones

1. **Mantener `AGENTS.md`, `README.md`, `.devin/environment.yaml` y `.devin/prompts/pancheria.prompt.md` sincronizados** con cada nueva feature, tabla o variable de entorno.
2. **Ejecutar `npm run test:e2e`** en una base de datos de prueba para validar el flujo completo, incluyendo videos.
3. **Revisar rate limiting** de pedidos públicos antes de escalar horizontalmente.
4. **Considerar la expiración automática** de pedidos `pending` si el negocio necesita liberar stock sin intervención manual.
5. **Verificar el proveedor de almacenamiento de videos en producción** (`STORAGE_PROVIDER`, credenciales y `NEXT_PUBLIC_*` de Cast) antes del deploy.

---

## 8. Conclusión

El proyecto `pancheria` mantiene su **estado estable y funcional**. La documentación principal ahora refleja correctamente el alcance de videos, reproducción, Cast, almacenamiento configurable, rate limiting de login y las tablas afectadas por los tests E2E. Las verificaciones `lint`, `tsc` y `build` pasan, por lo que los cambios documentales no introdujeron regresiones en el código. Quedan pendientes las recomendaciones habituales de tests E2E, monitoreo de streams y configuración de variables de producción.
