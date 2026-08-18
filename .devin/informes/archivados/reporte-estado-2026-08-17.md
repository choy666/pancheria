# Reporte de estado — Auditoría y limpieza de `.devin`

**Fecha:** 2026-08-17  
**Proyecto:** `pancheria`

---

## 1. Resumen ejecutivo

Se consolidaron los informes de estado y se realizó una limpieza del directorio `.devin` para que sea más eficaz como ayuda para futuros prompts. Se corrigieron referencias rotas, se actualizaron índices, se eliminaron reportes duplicados en la raíz de `informes/` y se reescribió `reporte-estado.md` como único informe vigente. No se modificó código de negocio. Las verificaciones automatizadas (`lint`, `tsc`, `test`, `build`) pasan sin errores.

---

## 2. Comandos ejecutados

| Paso | Comando | Resultado |
| ---- | ------- | --------- |
| 1 | `npm run lint` | Pasa |
| 2 | `npx tsc --noEmit` | Pasa |
| 3 | `npm test` | 61 suites, 682 tests pasan |
| 4 | `npm run build` | Build de producción exitoso (39 páginas) |
| — | `npx tsx src/db/seeds.ts` | No ejecutado (modifica datos) |
| — | `npx drizzle-kit check` | No ejecutado (sin cambios de esquema) |
| — | `npm run test:e2e` | No ejecutado (trunca tablas; requiere confirmación) |

---

## 3. Alcance funcional vigente

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

## 4. Hallazgos documentales recientes

| Gravedad | Discrepancia | Documentos afectados | Estado |
| -------- | ------------ | -------------------- | ------ |
| Menor | `NEXT_PUBLIC_APP_URL` se consume en `src/lib/storage.ts` para construir URLs locales de videos, pero no estaba documentado en `.env.example`, `AGENTS.md`, `README.md` ni `.devin/environment.yaml`. | <ref_file file="C:/developer/paginas/pancheria/.env.example" />, <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />, <ref_file file="C:/developer/paginas/pancheria/README.md" />, <ref_file file="C:/developer/paginas/pancheria/.devin/environment.yaml" /> | Resuelto. |
| Menor | `RATE_LIMIT_STORE_PROVIDER` se documentaba con default `memory`, pero `src/lib/rate-limit-store.ts` elige `DbRateLimitStore` por defecto en producción cuando hay base de datos. | <ref_file file="C:/developer/paginas/pancheria/.env.example" />, <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />, <ref_file file="C:/developer/paginas/pancheria/.devin/environment.yaml" /> | Resuelto. |
| Informativo | `README` y `AGENTS.md` ya describen correctamente `src/config/` incluyendo videos; `AGENTS.md` describe correctamente `login_attempts` y la migración `0007_boring_scorpion.sql`. | — | Confirmado. |

---

## 5. Limpieza de `.devin` realizada

### 5.1 Prompts

- Se actualizó `.devin/prompts/pancheria.prompt.md` para que referencie `guia-funcionamiento-pancheria.md`, aclare el manejo de `ForbiddenError` en Server Components y actualice las reglas de `setState` en `useEffect`.
- Se actualizó `.devin/prompts/README.md` para corregir el índice de prompts activos, eliminar el enlace roto a `pedidos-publicos-sucursal-y-stock.md` en la raíz (ya está en `archivados/`) y advertir que los prompts archivados pueden tener referencias a líneas desfasadas.
- Se mantiene `auditoria-y-documentacion.md` como prompt reutilizable de auditoría.

### 5.2 Informes

- Se consolidó la información de `reporte-estado-2026-08-16.md` y `reporte-estado-2026-08-17.md` en un único `reporte-estado.md` vigente.
- Se eliminaron los reportes fechados duplicados de la raíz de `.devin/informes/`.
- Se actualizó `.devin/informes/README.md` para apuntar a `reporte-estado.md`, `guia-funcionamiento-pancheria.md` y el archivo de informes históricos.
- Se actualizó `.devin/informes/lecciones-aprendidas.md` eliminando el punto duplicado sobre `setState` en `useEffect` y consolidando la guía de pedidos.

### 5.3 Referencias

- Se corrigieron las referencias en `pancheria.prompt.md` y `prompts/README.md` para que apunten a archivos vigentes.
- Se aconseja no usar `<ref_snippet ... lines="..."/>` en prompts activos a menos que el rango sea estable; preferir `<ref_file .../>` o nombres de función/exportación.

---

## 6. Riesgos y acciones pendientes

| Riesgo / Acción | Descripción |
| ----------------- | ----------- |
| `npm run test:e2e` | Ejecutar en base de datos de prueba para validar flujos críticos de UI, incluyendo pedidos y videos. |
| `npx tsx src/db/seeds.ts` | No ejecutado. Es idempotente pero modifica datos. Ejecutar solo con confirmación. |
| `npx drizzle-kit check` | Ejecutar tras cambios de esquema futuros para validar consistencia. |
| Rate limiting de pedidos en producción | El rate limit por IP en `POST /api/public/pedido` vive en memoria. En múltiples instancias se recomienda una solución compartida. |
| Expiración automática de pedidos `pending` | No implementada. Considerar si el negocio lo requiere. |
| Variables de producción | Confirmar que `NEXTAUTH_URL` coincide con el dominio de Vercel, que `NEXT_PUBLIC_WHATSAPP_NUMBER` está configurado, que `DATABASE_URL` apunta a la base de producción y que las variables de videos/almacenamiento están correctas. |
| Monitoreo de streams | Verificar logs de Vercel para `/api/videos/[id]/stream` tras el deploy. |

---

## 7. Recomendaciones

1. **Mantener `AGENTS.md`, `README.md`, `.devin/environment.yaml` y `.devin/prompts/pancheria.prompt.md` sincronizados** con cada nueva feature, tabla o variable de entorno.
2. **Ejecutar `npm run test:e2e`** en una base de datos de prueba para validar el flujo completo, incluyendo videos.
3. **Revisar rate limiting** de pedidos públicos antes de escalar horizontalmente.
4. **Considerar la expiración automática** de pedidos `pending` si el negocio necesita liberar stock sin intervención manual.
5. **Verificar el proveedor de almacenamiento de videos en producción** (`STORAGE_PROVIDER`, credenciales y `NEXT_PUBLIC_*` de Cast) antes del deploy.
6. **No duplicar informes de estado**: generar un único `reporte-estado.md` vigente y archivar los anteriores.
7. **Revisar los prompts archivados** antes de usarlos; sus referencias a líneas pueden estar desfasadas.

---

## 8. Conclusión

La documentación del proyecto y el directorio `.devin` están ahora más cohesionados. El informe de estado es único, los índices apuntan a archivos vigentes y se eliminaron duplicados. Las verificaciones automatizadas pasan, por lo que los cambios no introdujeron regresiones. Quedan pendientes las recomendaciones habituales de tests E2E, monitoreo de streams y configuración de variables de producción.
