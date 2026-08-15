# Reporte de estado — Catálogo público, pedidos transaccionales y estabilidad del proyecto

**Fecha:** 2026-08-15  
**Proyecto:** `pancheria`  
**Prompt base:** <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/pancheria.prompt.md" />

---

## 1. Resumen ejecutivo

El proyecto se encuentra en **estado estable y funcional**.

- Se implementaron el catálogo público (`/pedido`), el flujo de pedidos por WhatsApp y la gestión de pedidos con reserva transaccional de stock (`/pedidos`).
- El stock de pedidos se descuenta al crearse, se reintegra al cancelarse y no se vuelve a descontar al convertirse en venta.
- Se agregaron tablas `orders` e `order_items`, se extendieron `stock_movements` con `order` y `order_cancellation`, y se refactorizó `saleService.ts` para compartir lógica de descuento/reintegro con `orderService.ts`.
- Todas las verificaciones seguras pasaron: `lint`, `tsc`, `npm test`, `npm run build` y `npx drizzle-kit check`.
- Los prompts `catalogo-whatsapp.md` y `pedido-stock-centralizado.md` están resueltos y se archivaron en `.devin/prompts/archivados/`.

---

## 2. Comandos ejecutados

| Paso | Comando | Resultado |
| ---- | ------- | --------- |
| 1 | `npm run lint` | Pasa (eslint exit 0) |
| 2 | `npx tsc --noEmit` | Pasa (sin errores de tipos) |
| 3 | `npm test` | 57 suites, 637 tests passed |
| 4 | `npm run build` | Build de producción exitoso (39 páginas) |
| 5 | `npx drizzle-kit check` | `Everything's fine` |
| — | `npm run test:e2e` | No ejecutado (trunca tablas; requiere confirmación) |
| — | `npx tsx src/db/seeds.ts` | No ejecutado (modifica datos) |

---

## 3. Alcance funcional vigente

| Dominio | Estado | Archivos de referencia |
| ------- | ------ | ---------------------- |
| Autenticación | Login con credenciales, sesión JWT, roles `admin`/`operator`, rate limiting, protección de rutas. | <ref_file file="C:/developer/paginas/pancheria/src/auth.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/application/services/authService.ts" /> |
| Multi-sucursal | Tabla `branches`, `branchId` en usuarios, productos, cajas, ventas, pedidos, movimientos de stock y cierres; páginas `/sucursales` y `/usuarios`; aislamiento de datos. | <ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/sucursales/page.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/usuarios/page.tsx" /> |
| Productos | CRUD con soft delete, tipos (`critical_supply`, `compound`, `manual_supply`, `service`), recetas. | <ref_file file="C:/developer/paginas/pancheria/src/application/services/productService.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/repositories/productRepository.ts" /> |
| Recetas | Asociación de promos con insumos críticos, auto-descuento, validaciones. | <ref_file file="C:/developer/paginas/pancheria/src/application/services/recipeService.ts" /> |
| Stock | Ajustes, restock, alertas de stock bajo, historial de movimientos, reservas de pedidos y reintegros. | <ref_file file="C:/developer/paginas/pancheria/src/application/services/stockService.ts" /> |
| Ventas | Terminal táctil, disponibilidad en tiempo real, carrito, medios de pago, anulación con reintegro. | <ref_file file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" /> |
| Pedidos públicos | Catálogo en `/pedido`, carrito con `localStorage`, reserva de stock, WhatsApp, rate limit por IP. | <ref_file file="C:/developer/paginas/pancheria/src/app/(public)/pedido/page.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/pedido/route.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" /> |
| Gestión de pedidos | Listado, detalle, confirmación como venta y cancelación desde `/pedidos`. | <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/pedidos/page.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/pedidos/[id]/page.tsx" /> |
| Caja | Apertura, cierre, auto-cierre, historial, papelera (soft delete, restore, hard delete). | <ref_file file="C:/developer/paginas/pancheria/src/application/services/cashRegisterService.ts" /> |
| Cierre diario | Generación por fecha, validación de duplicados, exportación CSV, historial. | <ref_file file="C:/developer/paginas/pancheria/src/application/services/closureService.ts" /> |
| Videos | Subida, listado, reproducción, streaming y soporte Cast. | <ref_file file="C:/developer/paginas/pancheria/src/application/services/videoService.ts" /> |
| Tour interactivo | Recorrido con `driver.js`, persistencia en `localStorage`, inicio desde el navbar. | <ref_file file="C:/developer/paginas/pancheria/src/components/tour/tour-context.tsx" /> |

---

## 4. Cambios aplicados

### 4.1 Catálogo público y pedidos

- <ref_file file="C:/developer/paginas/pancheria/src/app/(public)/layout.tsx" /> y <ref_file file="C:/developer/paginas/pancheria/src/app/(public)/pedido/page.tsx" />: layout y página públicos sin autenticación.
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/catalogo/route.ts" />: API pública de catálogo con disponibilidad opcional.
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/disponibilidad/route.ts" />: API pública de validación de carrito.
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/pedido/route.ts" />: creación de pedido con rate limit por IP y generación de mensaje de WhatsApp.
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/pedidos/route.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/app/api/pedidos/[id]/route.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/app/api/pedidos/[id]/confirmar/route.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/app/api/pedidos/[id]/cancelar/route.ts" />: APIs del panel para gestionar pedidos.
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" />: `createOrder`, `cancelOrder`, `convertOrderToSale`, `getPendingOrders`, `getOrders`.
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/product-card.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/cart-summary.tsx" />: UI del catálogo y carrito.
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/pedidos-list.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/pedido-detail.tsx" />: UI del panel de pedidos.
- <ref_file file="C:/developer/paginas/pancheria/src/lib/whatsapp.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/config/catalog.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/lib/catalog.ts" />: utilidades del catálogo y WhatsApp.
- <ref_file file="C:/developer/paginas/pancheria/src/hooks/useCart.ts" />: carrito con `localStorage` y validación de disponibilidad.

### 4.2 Esquema de base de datos

- <ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" />:
  - Enums `orderStatusEnum`, `deliveryTypeEnum` y valores `order`, `order_cancellation` en `stockMovementTypeEnum`.
  - Tablas `orders` e `order_items` con relaciones e índices.
  - `stock_movements` extiende `orderId` con FK a `orders.id`.
- <ref_file file="C:/developer/paginas/pancheria/src/domain/types.ts" />: tipos `OrderStatus`, `DeliveryType`, `StockMovementType` actualizados.
- <ref_file file="C:/developer/paginas/pancheria/src/lib/zod-schemas.ts" />: `orderSchema`, `orderConfirmSchema`, `orderCancellationSchema`.

### 4.3 Refactor de stock compartido

- <ref_file file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" />: extracción de `deductStockForItems`, `reintegrateStockForItems` y `updateCashRegisterSummary` para reutilización entre ventas y pedidos.
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" />: utiliza las funciones compartidas de `saleService.ts` con `movementType: 'order'` y `movementType: 'order_cancellation'`.

### 4.4 Configuración y variables de entorno

- <ref_file file="C:/developer/paginas/pancheria/.env.example" />: `NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_WHATSAPP_MESSAGE_GREETING`, `NEXT_PUBLIC_WHATSAPP_MESSAGE_CLOSING`, `NEXT_PUBLIC_PEDIDO_REFETCH_INTERVAL_MS`, `PUBLIC_ORDER_RATE_LIMIT_WINDOW_MS`, `PUBLIC_ORDER_RATE_LIMIT_MAX_REQUESTS`.
- <ref_file file="C:/developer/paginas/pancheria/src/config/routes.ts" />: `pedido`, `pedidos`, `pedidoDetalle`.
- <ref_file file="C:/developer/paginas/pancheria/src/config/api.ts" />: constantes para API públicas y de pedidos.

### 4.5 Tests

- <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.test.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/catalogService.test.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/pedido/route.test.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/pedidos/route.test.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/hooks/useCart.test.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/lib/catalog.test.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/lib/whatsapp.test.ts" />
- <ref_file file="C:/developer/paginas/pancheria/tests/e2e/pedido.spec.ts" />

---

## 5. Discrepancias documentales detectadas y resueltas

| Gravedad | Documento | Discrepancia | Estado |
| -------- | --------- | ------------ | ------ |
| Baja | `.devin/prompts/pancheria.prompt.md` | Listaba `catalogo-whatsapp.md` y `pedido-stock-centralizado.md` como pendientes. | Resuelto: se movieron a la sección de resueltos/archivados y se actualizaron las instrucciones. |
| Baja | `.devin/prompts/README.md` | Índice mostraba prompts de catálogo y pedidos como activos. | Resuelto: se archivaron y se redujo la lista de activos a `auditoria-y-documentacion.md`. |
| Baja | `README.md` (raíz) | No documentaba el catálogo público ni la gestión de pedidos. | Resuelto: se agregó la sección "Catálogo público y pedidos". |
| Baja | `.devin/environment.yaml` | No mencionaba variables ni flujo de pedidos. | Resuelto: se agregó sección `pedidos` y se actualizaron `database`, `e2e` y `deploy`. |
| Baja | `.devin/prompts/catalogo-whatsapp.md` | Prompt resuelto; seguía en directorio activo. | Resuelto: archivado en `.devin/prompts/archivados/`. |
| Baja | `.devin/prompts/pedido-stock-centralizado.md` | Prompt resuelto; estaba sin versionar en directorio activo. | Resuelto: archivado en `.devin/prompts/archivados/`. |

---

## 6. Lecciones aprendidas aplicables

| Lección | Estado |
| ------- | ------ |
| No hardcodear credenciales ni URLs de API | Aplicada; todas las variables sensibles provienen de entorno. |
| Jerarquía de variables de Vercel Postgres (`DATABASE_URL` → `POSTGRES_URL` → `POSTGRES_PRISMA_URL`) | Vigente en `src/db/index.ts`. |
| Server actions devuelven estado con `error` en lugar de lanzar | Aplicada en actions del panel. |
| Soft delete considerando el estado del padre | Aplicada en `productService.deleteProduct` y en validaciones de pedidos. |
| Cuidado con `findFirst` y registros activos/inactivos | Aplicada en repositorios y servicios de pedidos. |
| Tests de cobertura para registro inactivo | Aplicada; cobertura actual: 57 suites y 637 tests. |
| Rate limiting en memoria (`RateLimitStore`) | Vigente para login; la creación pública de pedidos usa un rate limit en memoria por IP. Considerar solución compartida en producción con múltiples instancias. |
| No duplicar lógica de descuento/reintegro de stock | Aplicada: `deductStockForItems` y `reintegrateStockForItems` compartidas entre `saleService` y `orderService`. |
| Idempotencia de pedidos y ventas | Aplicada con `idempotencyService` extendido a ambos dominios. |

---

## 7. Riesgos y acciones pendientes

| Riesgo / Acción | Descripción |
| ----------------- | ----------- |
| `npm run test:e2e` | Ejecutar en base de datos de prueba para validar flujos críticos de UI, incluyendo pedidos. |
| `npx tsx src/db/seeds.ts` | No ejecutado. Es idempotente pero modifica datos. Ejecutar solo con confirmación. |
| `drizzle/0008_faulty_black_tarantula.sql` | Migración generada pero no commiteada. Asegurar que se aplica con `npx drizzle-kit push` en la base de destino. |
| Rate limiting de pedidos en producción | El rate limit por IP en `POST /api/public/pedido` vive en memoria. En múltiples instancias se recomienda una solución compartida. |
| Expiración automática de pedidos `pending` | Fase 8 del prompt archivado. No implementada. Considerar si el negocio lo requiere. |
| Variables de producción | Confirmar que `NEXTAUTH_URL` coincide con el dominio de Vercel, que `NEXT_PUBLIC_WHATSAPP_NUMBER` está configurado y que `DATABASE_URL` apunta a la base de producción. |
| Monitoreo de streams | Verificar logs de Vercel para `/api/videos/[id]/stream` tras el deploy. |

---

## 8. Recomendaciones

1. **Commitear los cambios de código** del flujo de pedidos (migración, esquema, servicios, componentes, tests) en commits coherentes.
2. **Ejecutar `npm run test:e2e`** en una base de datos de prueba para validar el flujo completo de catálogo y pedidos.
3. **Empujar la migración `0008`** con `npx drizzle-kit push` en la base de datos de destino antes del deploy.
4. **Revisar rate limiting** de pedidos públicos antes de escalar horizontalmente.
5. **Mantener `pancheria.prompt.md`** como punto de entrada para futuras tareas; actualizarlo cuando se resuelva una nueva feature.
6. **Considerar la expiración automática** de pedidos `pending` si el negocio necesita liberar stock sin intervención manual.

---

## 9. Conclusión

El proyecto `pancheria` cumple con los objetivos del catálogo público y de los pedidos con reserva transaccional. Pasa las verificaciones automatizadas y está en condiciones de pasar a producción siempre que se apliquen las recomendaciones de migración, rate limiting, variables de entorno y tests E2E.
