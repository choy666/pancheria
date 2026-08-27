# Reporte de estado — Auditoría de cobertura de pruebas y tests

**Fecha:** 2026-08-27 (actualizado con Fase 3)  
**Proyecto:** `pancheria`  
**Baseline:** `HEAD` — branch `main`  

---

## 1. Resumen ejecutivo

Se ejecutó la auditoría de cobertura de pruebas solicitada sobre **tests unitarios (Jest)**, **tests E2E (Playwright)** y documentación vigente, cruzando variables de entorno, prompts e informes. El suite E2E se corrió contra una base de datos descartable remota configurada en `.env.e2e`, reportando **2/2 tests de chat** pasados en la verificación de Fase 4.

**Verificaciones automáticas:** `npm run lint`, `npx tsc --noEmit`, `npm test` (120 suites, 1127 tests), `npm run build`, `npm run knip`, `npx drizzle-kit check` en desarrollo, E2E y producción pasan; suite E2E completo: 96 pasados, 1 omitido, 0 fallidos; migración `0020` aplicada en los tres entornos.

**Conclusión de cobertura:**

- **Fase 4 completada (chat con estados de mensaje y tildes):**
  - Columna `delivered_at` en `order_messages` con migración `drizzle/0019_hard_morbius.sql`.
  - `orderMessageRepository.markAllAsDeliveredByOrderAndSender` marca entregados los mensajes del remitente opuesto.
  - `chatService.listClientMessages` y `listOperatorMessages` marcan mensajes como entregados al listar.
  - `chat-message-list.tsx` muestra tildes simple (enviado), doble (entregado) y doble azul (leído) con tooltips de accesibilidad.
  - Tests unitarios de `orderMessageRepository`, `chatService` y `order-chat` ajustados y E2E de chat pasados.
  - Migración `drizzle/0019_hard_morbius.sql` aplicada en desarrollo y E2E.
- **Fase 3 completada (nuevos estados de pedido, reserva transaccional de stock y flujo recibir-pagar-finalizar):**
  - Nuevos estados `pending`, `in_process`, `paid`, `finished`, `cancelled` en `order_status` y en `OrderStatus` de dominio.
  - Nueva tabla `order_stock_reservations` con migración `drizzle/0018_black_vin_gonzales.sql`.
  - `orderService.receiveOrder` (`pending` → `in_process`) reserva stock de insumos críticos y bebidas sin descontarlos físicamente.
  - `orderService.convertOrderToSale` (`pending`/`in_process` → `paid`) valida disponibilidad considerando reservas ajenas, borra la reserva del pedido y descuenta el stock exactamente una vez.
  - `orderService.finishOrder` (`paid` → `finished`) finaliza el pedido.
  - `orderService.cancelOrder` libera reservas de pedidos `in_process`, anula la venta de pedidos `paid` y rechaza cancelar pedidos `finished`.
  - `validateCartAvailability` en `src/lib/product-helpers.ts` descuenta reservas activas de otros pedidos `in_process` del stock disponible.
  - Nuevos endpoints `POST /api/pedidos/[id]/recibir` y `POST /api/pedidos/[id]/finalizar`; `/api/pedidos/[id]/confirmar` adaptado al flujo de pago.
  - UI de pedidos con botones "Recibir y reservar", "Confirmar pago" y "Finalizar pedido", y badges de estado actualizados.
  - Chat habilitado mientras el pedido no esté `finished` o `cancelled`.
  - Tests unitarios y E2E ajustados; nuevo spec `pedido-reserva-flujo.spec.ts`.
  - Migración `drizzle/0018_black_vin_gonzales.sql` aplicada en desarrollo y producción.
- **Fase 2 completada (horarios de sucursal y bloqueo de pedidos con caja cerrada):**
  - Nueva columna `opening_hours` JSONB en `branches` con migración `drizzle/0017_unknown_energizer.sql`.
  - Helpers de zona horaria en `src/lib/branch-helpers.ts` (`isBranchOpen`, `getCurrentOrNextOpening`, `validateOpeningHours`).
  - `branchService` y UI de sucursales permiten crear/editar horarios.
  - `orderService.createOrder` rechaza pedidos si la caja de la sucursal está cerrada, devolviendo el horario de apertura.
  - Nuevo endpoint `GET /api/public/caja/estado?branchId={id}` para consulta pública de estado de caja.
  - `pedido-client.tsx` muestra advertencia de caja cerrada en el checkout sin bloquear el armado del carrito.
  - Tests unitarios y E2E ajustados; nuevo spec `pedido-caja-cerrada.spec.ts`.
  - Migración `drizzle/0017_unknown_energizer.sql` aplicada en desarrollo y producción; verificado que `opening_hours` existe con default `[]` en la base productiva.
- **Fase 5 completada (gaps de integración y pulido):**
  - `customerPhone` incluido en el mensaje de WhatsApp (`src/lib/whatsapp.ts`).
  - Último teléfono del cliente persistido en `localStorage` (`src/lib/last-customer-phone.ts`, `order-tracker.tsx`).
  - Horarios por defecto en `src/db/seeds.ts`.
  - Test unitario de `chat-message-list.tsx` cubriendo tildes enviado/entregado/leído.
  - `receiveOrder` protegido con `FOR UPDATE` sobre productos/insumos.
  - `npx drizzle-kit check` verificado limpio en desarrollo, E2E y producción.
  - Tipos `reserve` y `reserve_release` agregados a `stock_movement_type`; movimientos registrados al recibir, pagar, cancelar y anular pedidos; historial de stock muestra reservas y liberaciones.
- **Repositorios y servicios de aplicación** tienen cobertura unitaria completa (repositorios 100%, servicios 100%).
- **Rutas API** tienen cobertura completa: 43 de 43 con test.
- **`src/lib`** tiene 27 de 33 archivos con test; la infraestructura crítica está cubierta.
- **Configuración con variables de entorno** tiene tests para `caja`, `chat`, `orders`, `catalog` y `videos`.
- **Tests E2E** crecieron a 28 specs; se agregaron flujos de cambio de contraseña, búsqueda/filtro/paginación de pedidos, edición/eliminación de promos con recetas, expiración automática de pedidos, cierre automático de caja, rate limit de pedidos y confirmación/cancelación de pedidos desde el panel.
- **Componentes y páginas** del panel siguen sin tests unitarios; la cobertura depende de E2E.

---

## 2. Alcance y metodología

La auditoría siguió el prompt <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/auditoria-cobertura-de-pruebas.md" />.

1. **Inventario de tests existentes** con `npx jest --listTests`, `npm test` y `npx playwright test --list`.
2. **Inventario de código a cubrir** comparando `src/app/**/route.ts`, `src/application/services/*.ts`, `src/repositories/*.ts`, `src/lib/*.ts`, `src/components/**/*.tsx`, `src/hooks/*`, `src/app/(panel)/**/page.tsx` y `src/app/(public)/**/page.tsx` con sus tests correspondientes.
3. **Cruce con variables de entorno** buscando `process.env.*` en `src/` y comparando con `.env.example` y `AGENTS.md`.
4. **Evaluación de calidad de tests E2E** buscando selectores frágiles y dependencias del seed.
5. **Sincronización de `.devin`** — prompts, informes, `environment.yaml` e índices.

---

## 3. Conteos de tests

| Métrica | Valor |
|---------|-------|
| Suites unitarias (Jest) | 120 |
| Tests unitarios | 1127 |
| Archivos de test unitario | ~120 |
| Specs E2E | 29 |
| Tests E2E listados | 95 |
| Rutas API | 43 |
| Rutas API con test | 43 |
| Rutas API sin test | 0 |
| Servicios de aplicación | 14 |
| Servicios con test | 14 |
| Servicios sin test | 0 |
| Repositorios | 10 |
| Repositorios con test | 10 |
| Repositorios sin test | 0 |
| Archivos `src/lib/*.ts` | 33 |
| `src/lib/*.ts` con test | 27 |
| `src/lib/*.ts` sin test | 6 |

---

## 4. Cobertura por sector relevante

| Sector | Unitarios | E2E | Observación |
|--------|-----------|-----|-------------|
| Autenticación y autorización | Sí (`authService`, `route-guard`, `rate-limit-store`) | Sí (`login`, `roles-y-sucursales`, `perfil-cambio-contrasena`) | Cubierto en ambas capas. |
| Catálogo público y pedidos | Sí (`catalogService`, `orderService`, `public/pedido/*`, `pedidos/[id]/confirmar`, `pedidos/[id]/cancelar`) | Sí (`pedido`, `pedido-sucursal-y-stock`, `pedido-cancelacion-panel`, `pedido-busqueda-filtros`, `pedido-expiracion`) | Cubierto en ambas capas. |
| Ventas y terminal | Sí (`saleService`, `ventas/*`) | Sí (`ventas-*`) | Cubierto en ambas capas. |
| Productos y recetas | Sí (`productService`, `recipeService`, `productos/*`, `summaryService`) | Sí (`productos-y-recetas`) | Selectores robustecidos; edición/eliminación de promos con recetas cubierta. |
| Stock | Sí (`stockService`, `stock/*`) | Sí (`stock-y-movimientos`) | Cubierto en ambas capas. |
| Caja y cierres | Sí (`cashRegisterService`, `cierre/*`, `caja/historial`, `caja/abrir`, `caja/cerrar`, `caja/resumen`) | Sí (`caja-*`, `validaciones-y-papelera`, `caja-cierre-automatico`) | Cierre automático cubierto con manipulación controlada de `openedAt` en la base E2E. |
| Sucursales y usuarios | Sí (`branchService`, `userService`) | Sí (`roles-y-sucursales`) | Cubierto en ambas capas. |
| Videos y almacenamiento | Sí (`videoService`, `storage.ts`, `videos/upload`, `videos/[id]/stream`) | Sí (`videos`) | Cobertura unitaria completa de storage y rutas de video. |
| Rate limiting y seguridad | Sí (`public-order-rate-limit-store`, `rate-limit.ts`, `rate-limit-store.ts`) | Sí (`rate-limit-pedidos`) | Rate limit configurable vía `E2E_ENABLE_RATE_LIMIT=true` y `PUBLIC_ORDER_RATE_LIMIT_*` para el entorno E2E. |
| Cron jobs y limpieza | Sí (`cron/*`) | No | Cubierto unitariamente. |
| Utilidades transversales | Sí (`public-url.ts`, `api-handler.ts`, `summaryService.ts`, `storage.ts`) | No | Infraestructura crítica cubierta. |
| Configuración y variables de entorno | Sí (`caja.ts`, `chat.ts`, `orders.ts`, `catalog.ts`, `videos.ts`) | No | Variables configurables principales testeadas. |

---

## 5. Tests unitarios — estado y gaps

### 5.1 Funcionalidades clave cubiertas

| Funcionalidad | Test | Estado |
|---------------|------|--------|
| `convertOrderToSale` | `src/application/services/orderService.test.ts` | Cubierto (feliz, errores, idempotencia, precios históricos, stock). |
| Rate limit store público | `src/lib/public-order-rate-limit-store.test.ts` | Cubierto (`memory` y `db`). |
| Rate limit core | `src/lib/rate-limit.test.ts` | Cubierto (`getClientIp`, `createRateLimiter`, `PUBLIC_ORDER_RATE_LIMIT_ENABLE_IN_DEV`). |
| Rate limit login | `src/lib/rate-limit-store.test.ts` | Cubierto (`InMemoryRateLimitStore`, `DbRateLimitStore`, `createRateLimitStore`). |
| `withApiErrorHandling` | `src/lib/api-handler.test.ts` | Cubierto (401, 400, 403, 404, 409, 503, 499, 500, Zod). |
| `getPublicBaseUrl` | `src/lib/public-url.test.ts` | Cubierto (browser/servidor, producción, `HOST`/`PORT`, fallback). |
| Storage | `src/lib/storage.test.ts`, `src/config/videos.test.ts` | Cubierto (`local`, `vercel-blob`, `s3`, `r2`, variables de video). |
| Resumen de caja | `src/application/services/summaryService.test.ts` | Cubierto. |
| Soft delete productos/cajas | `src/application/services/productService.test.ts`, `src/application/services/cashRegisterService.test.ts` | Cubierto. |
| Idempotencia de ventas | `src/application/services/saleService.test.ts` | Cubierto. |
| Chat adjuntos y storage | `src/lib/chat-storage.test.ts` | Cubierto (local, Vercel Blob). |
| Refresco de pedidos | `src/config/orders.test.ts` | Cubierto (`NEXT_PUBLIC_PEDIDOS_REFRESH_INTERVAL_MS`: deshabilitado por defecto, forzar a 10000 ms si es < 1000, deshabilitar con 0). |

### 5.2 Archivos de producción sin test (gaps restantes)

#### `src/lib/*`

- `src/lib/logger.ts` — observabilidad (baja prioridad; en test no emite salida).
- `src/lib/with-auth.ts` — wrapper de endpoints autenticados (media prioridad; cubierto indirectamente por tests de rutas).
- `src/lib/pagination.ts`, `src/lib/validation-helpers.ts` — utilidades (baja prioridad).

#### Rutas API sin test

- Ninguna: todas las 43 rutas API tienen test unitario asociado.

#### Componentes y páginas

- Ninguna página de `src/app/(panel)/**/page.tsx` tiene test unitario.
- La mayoría de los componentes de negocio no tienen test unitario. Esto es aceptable si se cubren con E2E, pero conviene priorizar los críticos.

---

## 6. Tests E2E — estado y riesgos

### 6.1 Especificaciones encontradas

Se encontraron **29 specs** en <ref_file file="C:/developer/paginas/pancheria/tests/e2e" />:

| Spec | Flujo |
|------|-------|
| `login.spec.ts` | Login y redirecciones |
| `productos-y-recetas.spec.ts` | Creación, edición y eliminación de productos, promos y recetas |
| `roles-y-sucursales.spec.ts` | Roles, sucursales y usuarios |
| `pedido.spec.ts` | Catálogo, carrito y creación de pedido |
| `pedido-chat.spec.ts` | Chat de pedidos |
| `pedido-chat-adjuntos.spec.ts` | Adjuntos en el chat |
| `pedido-sucursal-y-stock.spec.ts` | Sucursal, carrito, stock y confirmación de pedido |
| `pedido-cancelacion-panel.spec.ts` | Confirmación y cancelación de pedidos desde el panel |
| `pedido-busqueda-filtros.spec.ts` | Búsqueda, filtrado y paginación de pedidos |
| `pedido-expiracion.spec.ts` | Expiración automática de pedidos |
| `pedido-caja-cerrada.spec.ts` | Bloqueo de pedido y mensaje con horario cuando la caja está cerrada |
| `ventas-disponibilidad.spec.ts` | Disponibilidad en terminal |
| `ventas-historial.spec.ts` | Venta, cierre e historial |
| `ventas-stock-compartido.spec.ts` | Promos con insumos compartidos |
| `stock-y-movimientos.spec.ts` | Ajustes y movimientos de stock |
| `caja-aislamiento-y-trazabilidad.spec.ts` | Aislamiento de cajas por sucursal |
| `caja-cierre-vacios.spec.ts` | Caja sin ventas |
| `caja-cierre-automatico.spec.ts` | Cierre automático de cajas por vencimiento |
| `flujo-diario.spec.ts` | Flujo completo de operación |
| `smoke.spec.ts` | Smoke de páginas protegidas |
| `tour.spec.ts` | Recorrido interactivo |
| `videos.spec.ts` | Videos, subida y reproducción |
| `responsive.spec.ts` | Responsividad móvil |
| `validaciones-y-papelera.spec.ts` | Validaciones y papelera de cajas |
| `perfil-cambio-contrasena.spec.ts` | Cambio de contraseña del usuario actual |
| `rate-limit-pedidos.spec.ts` | Rate limit de creación de pedidos públicos |
| `paso3.spec.ts`, `paso4.spec.ts` | Flujos guiados de operador |
| `prod-login-and-tour.spec.ts` | Smoke de producción |

### 6.2 Riesgos identificados y acciones aplicadas

| Riesgo | Gravedad | Evidencia / Acción |
|--------|----------|--------------------|
| **Uso de `data-slot` de shadcn/ui** | Mayor | 0 usos restantes en specs. Se reemplazaron por `[data-testid="product-card"]`, `[role="listbox"]`, `[role="option"]` y `getByRole('button', { name: 'Close' })`. Se agregaron `data-testid` en `sales-terminal.tsx`, `closure-panel.tsx` y `productos/page.tsx`. |
| **Selectores por posición (`td:nth-child`)** | Menor | 0 usos restantes en specs. Se reemplazaron por `data-testid` en filas y badges. |
| **Uso de `.first()`, `.last()`, `.nth()` sin selectores estables** | Menor | 55 usos restantes. Se redujo desde 57; algunos son necesarios para listas dinámicas. |

### 6.3 `data-testid` expuestos pero no usados en E2E

- `empty-trash`
- `restore-cash-register-{id}`, `permanent-delete-cash-register-{id}`, `delete-cash-register-{id}`
- `branch-select-label`, `single-branch-indicator`
- `whatsapp-icon`, `order-summary`
- `recent-orders-banner`
- `checkout-button`

> Nota: `chat-file-input`, `chat-attachment-image` y `active-branch-name` sí se usan en tests E2E (`pedido-chat-adjuntos.spec.ts`, `roles-y-sucursales.spec.ts`).

### 6.4 Flujos críticos no cubiertos por E2E

Los flujos priorizados en la auditoría fueron implementados y cubiertos por E2E. Los gaps residuales son:

- **Chat como operador/respuestas rápidas**: el chat de pedidos se cubre desde el lado cliente en `pedido-chat` y `pedido-chat-adjuntos`, pero no hay un flujo dedicado de respuestas del operador con plantillas.
- **Rate limit de chat público**: el spec `rate-limit-pedidos` cubre pedidos; el chat comparte el mismo store y lógica, pero no tiene spec dedicado.
- **Google Cast y reproducción de video en segundo plano**: se cubre el streaming, no la experiencia de Cast.
- **Restauración/permanente de cajas desde la UI**: los `data-testid` existen pero no hay spec E2E que los use.

---

## 7. Variables de entorno — cobertura

Se identificaron **56 variables configurables** en `.env.example` y `AGENTS.md`. Del análisis de `process.env.*` en `src/`:

| Variable | Uso | Test de comportamiento |
|----------|-----|------------------------|
| `NEXTAUTH_SECRET` / `AUTH_SECRET` | Autenticación | Sí (validación en `global-setup.ts`) |
| `DATABASE_URL` y aliases Postgres | Conexión a DB | Sí (validación en `global-setup.ts`) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Seed y login | Sí (validación en `global-setup.ts`) |
| `DEFAULT_BRANCH_NAME` | Sucursal por defecto | Sí (`branch-resolver.test.ts`) |
| `CRON_SECRET` | Protección de cron | Sí (`cron/*/*.test.ts`) |
| `NEXT_PUBLIC_CHAT_MAX_TEXT_LENGTH` | Límite de mensaje | Sí (`chat.test.ts`) |
| `ORDER_EXPIRATION_MS` | Expiración de pedidos | Sí (`orders.test.ts`) |
| `LOCAL_STORAGE_PATH` / `CHAT_LOCAL_STORAGE_PATH` | Storage local | Sí (`chat-storage.test.ts`) |
| `STORAGE_PROVIDER` / `BLOB_READ_WRITE_TOKEN` | Storage | Sí (`storage.test.ts`, `videos.test.ts`) |
| `NEXT_PUBLIC_APP_URL` / `NEXTAUTH_URL` | URLs públicas | Sí (`public-url.test.ts`) |
| `CAJA_AUTO_CLOSE_HOURS` / `NEXT_PUBLIC_CAJA_AUTO_CLOSE_HOURS` | Cierre automático de cajas | Sí (`caja.test.ts`) |
| `CAJA_AUTO_CLOSED_BY` | Etiqueta de cierre automático | Sí (`caja.test.ts`) |
| `NEXT_PUBLIC_CAJA_CLOCK_INTERVAL_MS` | Reloj de caja | Sí (`caja.test.ts`) |
| `CAJA_DEFAULT_HISTORY_DAYS` / `NEXT_PUBLIC_CAJA_DEFAULT_HISTORY_DAYS` | Historial de caja | Sí (`caja.test.ts`) |
| `NEXT_PUBLIC_CAJA_REFRESH_INTERVAL_MS` | Refresco de panel de caja | Sí (`caja.test.ts`) |
| `RATE_LIMIT_STORE_PROVIDER` | Store de rate limit login | Sí (`rate-limit-store.test.ts`) |
| `PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER` | Store de rate limit pedidos | Sí (`public-order-rate-limit-store.test.ts`) |
| `TRUSTED_PROXY_IP_HEADER` | Header de IP confiable | Sí (`rate-limit.test.ts`) |
| `PUBLIC_ORDER_RATE_LIMIT_WINDOW_MS` / `PUBLIC_ORDER_RATE_LIMIT_MAX_REQUESTS` | Rate limit pedidos | Sí (`orders.test.ts`) |
| `PUBLIC_ORDER_RATE_LIMIT_ENABLE_IN_DEV` | Activa rate limit en desarrollo | Sí (`rate-limit.test.ts`) |
| `PUBLIC_CHAT_RATE_LIMIT_WINDOW_MS` / `PUBLIC_CHAT_RATE_LIMIT_MAX_REQUESTS` | Rate limit chat | Sí (`chat.test.ts`) |
| `NEXT_PUBLIC_CHAT_REFRESH_INTERVAL_MS` | Refresco del chat | Sí (`chat.test.ts`) |
| `NEXT_PUBLIC_CHAT_PAGE_SIZE` | Paginación del chat | Sí (`chat.test.ts`) |
| `NEXT_PUBLIC_CHAT_IMAGE_MAX_SIZE_MB` | Tamaño de imagen en chat | Sí (`chat.test.ts`) |
| `NEXT_PUBLIC_CHAT_ALLOWED_IMAGE_MIME_TYPES` | Tipos MIME de chat | Sí (`chat.test.ts`) |
| `NEXT_PUBLIC_BRANCH_TIMEZONE` | Zona horaria para horarios de apertura | Sí (`branch-helpers.test.ts`) |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Número de WhatsApp | Sí (`catalog.test.ts`) |
| `NEXT_PUBLIC_WHATSAPP_MESSAGE_GREETING` / `CLOSING` | Mensaje de WhatsApp | Sí (`catalog.test.ts`) |
| `NEXT_PUBLIC_PEDIDO_REFETCH_INTERVAL_MS` | Refresco del catálogo | Sí (`catalog.test.ts`) |
| `NEXT_PUBLIC_PEDIDOS_REFRESH_INTERVAL_MS` | Refresco de pedidos del operador | Sí (`orders.test.ts`) |
| `NEXT_PUBLIC_API_TIMEOUT_MS` | Timeout de API cliente | Sí (`fetch.test.ts`) |
| `NEXT_PUBLIC_VIDEO_MAX_SIZE_MB` | Tamaño de video | Sí (`videos.test.ts`) |
| `NEXT_PUBLIC_VIDEO_ALLOWED_MIME_TYPES` | Tipos MIME de video | Sí (`videos.test.ts`) |
| `NEXT_PUBLIC_CAST_RECEIVER_APP_ID` / `NEXT_PUBLIC_CAST_SENDER_SDK_URL` | Google Cast | Sí (`videos.test.ts`) |
| `HOST` / `PORT` | Fallback de desarrollo de URL pública | Sí (`public-url.test.ts`) |
| `NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS` | Analytics | Sí (`conditional-analytics.test.tsx`) |
| Credenciales `S3_*` / `R2_*` | Storage remoto | Sí (`storage.test.ts` con mocks; no se recomienda testear con credenciales reales). |

---

## 8. Hallazgos y recomendaciones

### Crítico

Ningún hallazgo crítico que afecte build o seguridad. No se encontraron credenciales expuestas.

### Mayor

#### 8.1 Faltan tests de rutas API remanentes

Las rutas `caja/[id]` (detalle de caja) y `pedidos/[id]` (detalle de pedido) no tienen tests unitarios. Son menos críticas que las ya cubiertas, pero deberían tener cobertura.

**Recomendación:** Crear tests para estas rutas, priorizando `pedidos/[id]`.

### Menor

#### 8.2 Selectores `.first()`, `.last()`, `.nth()` restantes

Se redujeron a 55 usos en specs. Algunos son necesarios para listas dinámicas, pero otros pueden reemplazarse por `getByTestId` o selectores estables.

**Recomendación:** Revisar los 55 usos restantes y reemplazar los que dependen de posición por selectores semánticos o `data-testid`.

### Informativo

#### 8.3 Cobertura de componentes/páginas del panel

No hay tests unitarios para páginas del panel; la cobertura se delega a E2E. Esto es aceptable en este stack si los flujos E2E son robustos.

---

## 9. Sincronización de `.devin`

Acciones aplicadas en esta sesión:

- Se actualizó `.devin/prompts/README.md` para reflejar los prompts activos y archivados existentes.
- Se archivó `auditoria-rate-limit-429.md` y se actualizó su descripción.
- Se eliminó del índice de informes la referencia a `informe-estrategico-franquicia-saas.md` (no existe).
- Se actualizó `AGENTS.md` para eliminar `CHAT_ATTACHMENTS_CLEANUP_SCHEDULE` y documentar `PUBLIC_ORDER_RATE_LIMIT_ENABLE_IN_DEV`.
- Se actualizó `.devin/informes/guia-funcionamiento-pancheria.md` para eliminar `CHAT_ATTACHMENTS_CLEANUP_SCHEDULE` y aclarar el polling manual de `/pedidos`.
- Se actualizó `.devin/informes/lecciones-aprendidas.md` con las lecciones de polling y rate limit en desarrollo.
- Se actualizó `.devin/environment.yaml` con `PUBLIC_ORDER_RATE_LIMIT_ENABLE_IN_DEV` y el polling deshabilitado por defecto.
- Se actualizó `.devin/informes/entornos.md` con el paso a paso para identificar y usar las URLs de base de datos de desarrollo, producción y E2E, incluyendo tablas de variables, comandos de Playwright y reglas de seguridad.
- Se actualizó `AGENTS.md` con una sección resumen de bases de datos y entornos que remite a `entornos.md`.
- Se actualizó el presente `reporte-estado.md` con el baseline, conteos y comandos vigentes.

---

## 10. Comandos ejecutados y resultados

| Paso | Comando | Resultado |
|------|---------|-----------|
| 1 | `npm run lint` | Pasa (exit 0) |
| 2 | `npx tsc --noEmit` | Pasa |
| 3 | `npm test` | 120 suites, 1127 tests pasan |
| 4 | `npm run build` | Build exitoso (42 páginas dinámicas) |
| 5 | `npm run knip` | Pasa |

|| 6 | `npm run test:e2e` | 96 passed, 1 skipped, 0 failed (con `--retries=2` y base `pancheria_e2e`) |

> `npx drizzle-kit push` / `npx drizzle-kit generate` y `npx tsx src/db/seeds.ts` no fueron necesarios porque `tests/e2e/global-setup.ts` maneja el esquema y el seed de forma automática en la base E2E.

---

## 12. Fase 5 — Gaps menores y recomendaciones

Tras completar las Fases 1 a 4, se resolvieron los 7 gaps del orden recomendado. La Fase 5 queda completada.

| # | Gap | Riesgo | Contexto técnico | Recomendación | Verificación propuesta |
|---|-----|--------|-------------------|---------------|------------------------|
| 1 | `src/db/seeds.ts` define horarios por defecto. | Bajo | Resuelto. El seed ahora inserta franjas horarias de lunes a sábado 10:00-22:00 y domingo 18:00-23:00. | Ninguna. | Ejecutar `npx tsx src/db/seeds.ts` en base limpia y confirmar `branches.opening_hours`. |
| 2 | Persistencia del último teléfono del cliente. | Medio | Resuelto. Se creó `src/lib/last-customer-phone.ts` y se integró en `order-tracker.tsx`. | Ninguna. | Tests unitarios de `order-tracker.test.tsx` pasan. |
| 3 | El mensaje de WhatsApp incluye `customerPhone`. | Bajo | Resuelto. `src/lib/whatsapp.ts` agrega `Teléfono:` cuando el campo está presente. | Ninguna. | `src/lib/whatsapp.test.ts` pasa. |
| 4 | El enum `order_status` de PostgreSQL podría conservar el valor legacy `converted`. | Medio | Verificado: `drizzle-kit check` está limpio en desarrollo, E2E y producción. El enum no conserva `converted`. | Ninguna. | `npx drizzle-kit check` limpio contra la base productiva. |
| 5 | Trazabilidad de reservas como movimientos de stock. | Bajo | Resuelto. `receiveOrder` inserta movimientos `reserve`; `convertOrderToSale` y `cancelOrder` insertan `reserve_release`; `stock-history.tsx` muestra los nuevos tipos. | Ninguna. | `stock_movements` contiene movimientos `reserve`/`reserve_release`; tests de `orderService.test.tsx` pasan; migración `0020` aplicada. |
| 6 | Posible condición de carrera en `receiveOrder`. | Medio | Resuelto. `receiveOrder` bloquea los insumos con `FOR UPDATE` antes de `validateCartAvailability` e `insertReservations`. | Ninguna. | Tests de `orderService.test.ts` y build pasan. |
| 7 | Test unitario de `chat-message-list.tsx`. | Bajo | Resuelto. Se creó `src/components/chat/chat-message-list.test.tsx` cubriendo estados enviado, entregado y leído. | Ninguna. | `npm test -- chat-message-list.test.tsx` pasa. |

---

## 13. Análisis de impacto/riesgo detallado — gaps de Fase 5

A continuación se profundiza en cada gap menor documentado, ordenado por el criterio de esfuerzo/beneficio y riesgo técnico solicitado.

### 13.1. Gap 3 — Incluir `customerPhone` en el mensaje de WhatsApp (`whatsapp.ts`)

- **Archivos**: <ref_file file="C:/developer/paginas/pancheria/src/lib/whatsapp.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/lib/whatsapp.test.ts" />.
- **Riesgo**: Bajo.
- **Impacto de negocio**: El operador recibe el mensaje de WhatsApp con cliente, entrega, dirección, total y enlace al chat, pero no el teléfono. Debe abrir el panel para contactar al cliente, lo que agrega fricción operativa.
- **Impacto técnico**: Nulo. No hay cambios de esquema ni estructuras.
- **Viabilidad de solución**: Muy alta. Se agrega `customerPhone?: string` a `PublicOrder` y una línea condicional en `buildWhatsAppMessage`.
- **Consecuencias de no corregir**: Pequeña fricción operativa; el chat del pedido compensa parcialmente.
- **Recomendación**: Implementar de inmediato. Es el gap con mejor relación esfuerzo/beneficio.
- **Verificación**: Test unitario que contenga `Teléfono:` en el mensaje cuando se provee.

### 13.2. Gap 2 — Persistir el último teléfono del cliente en `order-tracker.tsx`

- **Archivos**: <ref_file file="C:/developer/paginas/pancheria/src/lib/last-customer-name.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/order-tracker.tsx" />.
- **Riesgo**: Medio.
- **Impacto de negocio**: El tracker ya recuerda el nombre con `useSyncExternalStore` y `localStorage`, pero no el teléfono. El cliente debe reingresar ambos campos en cada consulta, lo que empeora la experiencia móvil y aumenta el riesgo de errores de tipeo.
- **Impacto técnico**: Bajo. Requiere un nuevo helper análogo y un hook en el componente.
- **Viabilidad de solución**: Alta. Patrón ya establecido en `last-customer-name.ts`.
- **Consecuencias de no corregir**: UX repetitiva; consultas de seguimiento menos fluidas.
- **Recomendación**: Implementar junto con el Gap 3, ya que ambos reutilizan helpers de `localStorage`.
- **Verificación**: Test E2E o unitario que recargue `/pedido/seguimiento` y mantenga el teléfono.

### 13.3. Gap 1 — `seeds.ts` sin horarios por defecto

- **Archivos**: <ref_file file="C:/developer/paginas/pancheria/src/db/seeds.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/lib/branch-helpers.ts" />.
- **Riesgo**: Bajo.
- **Impacto de negocio**: En desarrollo y E2E, la sucursal creada por seed tiene `openingHours = []`, por lo que `isBranchOpen` devuelve `false` siempre. Esto puede mostrar mensajes de "sucursal cerrada" en el catálogo público aunque la caja esté abierta, confundiendo a quien prueba localmente.
- **Impacto técnico**: Bajo. El seed deja la sucursal en estado funcional pero sin horarios. No afecta producción si allí se configuran franjas manualmente.
- **Viabilidad de solución**: Alta. Agregar `openingHours` al `insert` de `seedDefaultBranch` (y `seedOptionalBranch`) con un horario comercial por defecto, o una variable de entorno.
- **Consecuencias de no corregir**: Frustración en dev/E2E; posibles tests frágiles si dependen de `isBranchOpen`.
- **Recomendación**: Implementar con un horario conservador (por ejemplo, lunes a sábado 10:00-22:00, domingo 18:00-23:00) o permitir sobreescribirlo por variable.
- **Verificación**: Ejecutar `npx tsx src/db/seeds.ts` en base limpia y confirmar que `isBranchOpen` devuelve `true` dentro del horario.

### 13.4. Gap 7 — Test unitario de `chat-message-list.tsx`

- **Archivos**: <ref_file file="C:/developer/paginas/pancheria/src/components/chat/chat-message-list.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/components/chat/order-chat.test.tsx" />.
- **Riesgo**: Bajo.
- **Impacto de negocio**: Nulo. Es cobertura de regresión.
- **Impacto técnico**: Bajo. `order-chat.test.tsx` cubre la integración, pero no los estados visuales (tildes enviado/entregado/leído).
- **Viabilidad de solución**: Alta. Renderizar mensajes con distintos `deliveredAt`/`readAt` y verificar iconos/títulos.
- **Consecuencias de no corregir**: Riesgo de regresión visual silenciosa si se modifica `MessageStatusIcon`.
- **Recomendación**: Implementar como cobertura complementaria de Fase 4.
- **Verificación**: `npm test -- src/components/chat/chat-message-list.test.tsx` pasa.

### 13.5. Gap 6 — `receiveOrder` sin `FOR UPDATE` sobre insumos

- **Archivos**: <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" lines="380-456" />, <ref_file file="C:/developer/paginas/pancheria/src/lib/product-helpers.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/repositories/orderStockReservationRepository.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/repositories/productRepository.ts" lines="87-109" />.
- **Riesgo**: Medio.
- **Impacto de negocio**: Bajo concurrencia, dos pedidos `pending` que comparten insumos críticos podrían reservar más stock del disponible. Al intentar pagar uno de ellos, `convertOrderToSale` fallaría por falta de stock, generando una mala experiencia y pérdida de venta.
- **Impacto técnico**: Alto en integridad. `receiveOrder` usa `executeInTransaction`, bloquea los productos del pedido con `buildProductContext(..., { dbOrTx: tx })`, pero no bloquea los **insumos** de las recetas. `validateCartAvailability` calcula disponibilidad con reservas ajenas, pero entre el cálculo y la inserción de `order_stock_reservations`, otro pedido puede insertar reservas concurrentes.
- **Viabilidad de solución**: Media. Se requiere calcular todos los `productId` e `insumos` a bloquear y ejecutar `SELECT ... FOR UPDATE` antes de `validateCartAvailability`. Hay que cuidar no romper el flujo de venta (`convertOrderToSale`) que también necesita bloqueos.
- **Consecuencias de no corregir**: Sobrereservas, pedidos que luego no se pueden pagar, inconsistencias de stock difíciles de reproducir y depurar.
- **Recomendación**: Priorizar junto con Gap 4. Es el riesgo operativo más importante de Fase 5.
- **Verificación**: Test de concurrencia con dos `receiveOrder` simultáneos sobre stock crítico justo.

### 13.6. Gap 4 — Limpiar el enum `order_status` de PostgreSQL (`converted` legacy)

- **Archivos**: <ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" lines="47-54" />, <ref_file file="C:/developer/paginas/pancheria/drizzle/0018_black_vin_gonzales.sql" />.
- **Riesgo**: Medio.
- **Impacto de negocio**: Nulo directo; `converted` ya no se usa. El problema es la salud del esquema y la capacidad de futuras migraciones.
- **Impacto técnico**: Medio. `drizzle-kit check` en producción puede reportar divergencia si el enum de la base productiva aún conserva `converted`. En desarrollo y E2E actualmente pasa limpio (`Everything's fine`), lo que indica que esas bases ya están alineadas.
- **Viabilidad de solución**: Media a compleja. PostgreSQL no soporta `ALTER TYPE ... DROP VALUE`. Para eliminar `converted` hay que recrear el enum: crear uno nuevo sin `converted`, alterar las columnas `orders.status` (y otras que usen el enum) al nuevo tipo, borrar el viejo y renombrar. Requiere una migración manual cuidadosa.
- **Consecuencias de no corregir**: `drizzle-kit check` puede fallar en producción; generación de migraciones futuras más compleja.
- **Recomendación**: Ejecutar `npx drizzle-kit check` contra la base productiva. Si es limpio, no hacer nada. Si falla, planificar migración `0020` de limpieza de enum en ventana de mantenimiento.
- **Verificación**: `npx drizzle-kit check` limpio contra producción.

### 13.7. Gap 5 — Trazabilidad de reservas en `stock_movements`

- **Archivos**: <ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" lines="62-68" />, <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" />.
- **Riesgo**: Bajo.
- **Impacto de negocio**: No afecta la operación diaria. Afecta la capacidad de auditar por qué un pedido `in_process` disminuye la disponibilidad de un insumo sin descontar stock físico.
- **Impacto técnico**: Medio. Requiere extender `stock_movement_type` (por ejemplo, agregar `reserve` y `reserve_release`) e insertar movimientos al reservar, pagar y cancelar. También hay que revisar resúmenes y reportes de stock para que no traten las reservas como descontes reales.
- **Viabilidad de solución**: Media. No es complejo en código, pero es una decisión de producto/auditoría.
- **Consecuencias de no corregir**: Menor trazabilidad. Depuración de disponibilidad más difícil.
- **Recomendación**: Decidir con el equipo si se necesita auditoría formal. Si no, documentar en `AGENTS.md` que la reserva se traza en `order_stock_reservations` y no en `stock_movements`.
- **Verificación**: Si se implementa, test que verifique `stock_movements.type = 'reserve'` tras `receiveOrder`.

---

## 14. Enlaces relevantes

- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/README.md" />
- <ref_file file="C:/developer/paginas/pancheria/.env.example" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/entornos.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/auditoria-cobertura-de-pruebas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/archivados/plan-de-accion-2026-08-27.md" />
- <ref_file file="C:/developer/paginas/pancheria/package.json" />
- <ref_file file="C:/developer/paginas/pancheria/jest.config.ts" />
- <ref_file file="C:/developer/paginas/pancheria/playwright.config.ts" />
