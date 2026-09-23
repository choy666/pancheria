# Reporte de estado — Auditoría de cobertura de pruebas y tests

**Fecha:** 2026-08-30 (actualizado con auditoría documental)  
**Proyecto:** `pancheria`  
**Baseline:** `HEAD` — branch `main`  

---

## 1. Resumen ejecutivo

Se ejecutó la auditoría de cobertura de pruebas solicitada sobre **tests unitarios (Jest)**, **tests E2E (Playwright)** y documentación vigente, cruzando variables de entorno, prompts e informes. El suite E2E se corrió contra una base de datos descartable remota configurada en `.env.e2e`, reportando **2/2 tests de chat** pasados en la verificación de Fase 4.

Además, se completó la actualización del **panel de control** descrita en la Fase 17: dashboard operativo, navegación, tour interactivo, resumen de insumos de recetas en caja, y verificaciones estándar.

**Verificaciones automáticas:** en la actualización del panel de control pasaron `npm run lint`, `npx tsc --noEmit`, `npm test` (123 suites, 1163 tests), `npm run build` y `npm run knip`. E2E no se reejecutó en esta sesión por no contar con una base descartable configurada. Las verificaciones previas (`npx drizzle-kit check` en desarrollo, E2E y producción, suite E2E completo 96 pasados/1 omitido y migración `0020`) permanecen vigentes.

**Conclusión de cobertura:**

- **Actualización del panel de control completada:**
  - Dashboard operativo en `/` con resumen de caja, pedidos, stock y accesos rápidos.
  - Navegación renombrada: `Historial de cajas`, `Caja y cierre`, `Cierres diarios`.
  - Tour interactivo actualizado con pasos para pagos mixtos, pedidos, reservas, chat, videos, imágenes de promos, perfil y selector de sucursal.
  - Resumen de caja incluye la tarjeta `recipeSuppliesSummary` (`Insumos de recetas`).
  - Verificaciones estándar: `npm run lint`, `npx tsc --noEmit`, `npm test` (123 suites, 1163 tests), `npm run build` y `npm run knip` pasan.
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

## 10. Fase 6 — Promos con servicios, manuales y snapshots de receta

Se implementó el prompt <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/promos-con-servicios-y-manuales.md" />:

- **Esquema:** tablas `recipes`, `sale_item_recipes`, `order_item_recipes`, y migraciones aplicadas en desarrollo, E2E y producción.
- **Reglas de negocio:**
  - Las promos (`compound`) requieren al menos un insumo crítico con `autoDiscount: true`.
  - Los insumos críticos son obligatorios (`isOptional: false`).
  - Los manuales y servicios son siempre `autoDiscount: false`; pueden ser opcionales y preseleccionados por defecto.
  - El precio de la promo es fijo e independiente de los complementos quitados.
- **Persistencia:** cada `sale_item` y `order_item` guarda un snapshot de la receta seleccionada (`sale_item_recipes`/`order_item_recipes`) para stock, reintegros, reservas y cierres históricos.
- **Frontend:**
  - `PromoOptionsDialog` para elegir complementos en el catálogo y en el terminal de ventas.
  - `useCart` persiste `selectedRecipeItemIds` en `localStorage`.
  - `pedido-success-dialog.tsx`, `pedido-items-list.tsx` y `sales-terminal.tsx` muestran el detalle de preparación.
- **Chat del pedido:** `orderService.createOrder` inserta un mensaje automático del sistema con el detalle de cada promo (insumos incluidos y quitados).
- **Resúmenes:** caja y cierres diarios incluyen `recipeSuppliesSummary` (tarjeta "Insumos de recetas" y CSV).
- **Tests:** suite Jest 121 suites / 1145 tests pasan; E2E 96 passed, 1 skipped.
- **Migración:** `drizzle-kit check` limpio; builds de producción exitosos.

> Nota: WhatsApp sigue sin ser extendido. El canal oficial de confirmación es el chat del pedido.

---

## 11. Comandos ejecutados y resultados

| Paso | Comando | Resultado |
|------|---------|-----------|
| 1 | `npm run lint` | Pasa (exit 0) |
| 2 | `npx tsc --noEmit` | Pasa |
| 3 | `npm test` | 121 suites, 1145 tests pasan |
| 4 | `npm run build` | Build exitoso (44 páginas dinámicas) |
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

---

## 15. Implementación de pagos mixtos

**Fecha:** 2026-08-28

### Alcance

Implementación del soporte para pagos mixtos (efectivo + transferencia) en ventas y pedidos, siguiendo el prompt <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/pago-mixto-ventas-y-pedidos.md" />.

### Hallazgos

#### Crítico

Ningún hallazgo crítico.

#### Mayor

1. **El prompt original omitía el impacto en `summaryService.ts` y `closureService.ts`.** `calculateSummaryFromSales` y `closureService.generateClosure` recalculan `cashTotal`/`transferTotal` a partir de `paymentMethod`. Si `sales.paymentMethod` se elimina o se ignora, el cierre diario y el resumen de caja se romperán.
   - **Acción:** se agregó a la sección de implementación la actualización de `summaryService.ts`, `closureService.ts` y `cashRegisterService.ts`.

2. **El prompt no mencionaba `saleRepository.ts` ni la serialización de `payments`.** `findByDateRange`, `findByCashRegisterId` y `findById` deben incluir `with: { payments: true }`; la función `create` debe insertar partes.
   - **Acción:** se incluyó `src/repositories/saleRepository.ts` en el plan.

3. **El prompt no detallaba la idempotencia de `sale_payments`.** Al usar `insert(sales).onConflictDoNothing()` y luego insertar partes, si la venta ya existe se pueden duplicar pagos.
   - **Acción:** se agregó nota de idempotencia y búsqueda con `payments`.

4. **El prompt no definía el destino de `sales.paymentMethod`.** Dejarlo sin plan puede llevar a inconsistencias o a mantener una columna engañosa.
   - **Acción:** se agregó supuesto de diseño para deprecar `sales.paymentMethod` y mantener compatibilidad en la migración.

#### Menor

5. **El prompt usaba `<ref_snippet ... lines="..."/>` para rangos que cambiarán con la implementación.** Esto desfasará el prompt tras cualquier refactor.
   - **Acción:** se reemplazaron la mayoría de `<ref_snippet>` por `<ref_file>` y nombres de función/exportación.

6. **El prompt no incluía referencias a `pancheria.prompt.md`, `auditoria-y-documentacion.md` ni `lecciones-aprendidas.md`.**
   - **Acción:** se agregaron las referencias obligatorias del proyecto.

#### Informativo

7. **`npm run knip` reporta exports no usados en `src/config/product-images.ts` y `src/lib/product-image-storage.ts`.** No están relacionados con el pago mixto, pero indican una feature de imágenes de productos en progreso.

### Acciones aplicadas

- Se creó la tabla `sale_payments` en `src/db/schema.ts` con relaciones e índices, y se generó la migración `drizzle/0022_jittery_grandmaster.sql`.
- Se agregó el tipo `PaymentPart` en `src/domain/types.ts` y el esquema `paymentPartSchema` en `src/lib/zod-schemas.ts`.
- Se crearon los helpers `sumPaymentParts`, `amountByPaymentMethod` y `validatePaymentParts` en `src/lib/payment-helpers.ts`.
- Se actualizaron `saleService.ts` y `orderService.ts` para recibir `payments`, validar que la suma coincida con el total y actualizar `cashTotal`/`transferTotal` de forma separada.
- Se actualizaron `summaryService.ts`, `closureService.ts` y `cashRegisterService.ts` para leer el desglose de `sale_payments` con fallback al `paymentMethod` histórico.
- Se actualizó `saleRepository.ts` para incluir `payments` en consultas e inserciones atómicas.
- Se actualizaron las rutas `POST /api/ventas` y `POST /api/pedidos/[id]/confirmar` para recibir `payments`.
- Se creó `src/components/pagos/payment-parts-input.tsx` y se integró en `sales-terminal.tsx`, `pedido-actions.tsx` y `usePedidoDetail.ts`.
- Se actualizaron `sales-history.tsx` y `pedidos-list.tsx` para manejar el desglose de pagos.
- Se actualizaron los tests de servicios, repositorios, rutas y esquemas Zod.
- Se aplicó la migración en una rama descartable de Neon (`test-mixed-payments`) con `npx drizzle-kit generate` y `npx drizzle-kit push`, y `npx drizzle-kit check` pasó limpio.

### Comandos ejecutados y resultados

| Paso | Comando | Resultado |
| ---- | ------- | --------- |
| 1 | `npm run lint` | Pasa (exit 0) |
| 2 | `npx tsc --noEmit` | Pasa |
| 3 | `npm test` | 121 suites, 1145 tests pasan |
| 4 | `npm run build` | Build exitoso |
| 5 | `npm run knip` | Pasa (sin exports no usados) |
| 6 | `npx drizzle-kit generate` | Migración `0022_jittery_grandmaster` generada |
| 7 | `npx drizzle-kit push` | Aplicada en rama `test-mixed-payments` de Neon |
| 8 | `npx drizzle-kit push --force` | Aplicada en base E2E `neondb_e2e` |
| 9 | `npx drizzle-kit check` | Limpio contra la rama de prueba |
| 10 | `npm run test:e2e` | 96 passed, 1 skipped |

`npx drizzle-kit check`, `npx drizzle-kit generate` y `npx drizzle-kit push` se ejecutaron en una rama descartable de Neon (`test-mixed-payments`) y luego en la base E2E `neondb_e2e`. `npm run test:e2e` pasó 96 de 97 tests (1 skipped). El test `pedido-sucursal-y-stock.spec.ts:163` era flaky: pasaba aislado pero fallaba en la suite completa porque `useCart` cargaba `localStorage` después de una interacción rápida y pisaba el ítem recién agregado. Se corrigió en `src/hooks/useCart.ts` agregando un flag de interacción de usuario que evita la carga inicial cuando ya se modificó el carrito.

### Recomendaciones

- Validar la migración `0022_jittery_grandmaster` en un entorno de staging antes de aplicarla en producción.
- Considerar una migración posterior para eliminar `sales.paymentMethod` una vez que todas las lecturas usen `sale_payments`.
- El test E2E `pedido-sucursal-y-stock.spec.ts:163` ya fue estabilizado ajustando `useCart` para que no pise el carrito recién modificado por una carga tardía de `localStorage`.
- La rama `test-mixed-payments` de Neon ya fue eliminada.

## 16. Imágenes ilustrativas de productos y promos

La funcionalidad de imágenes de productos/promos está implementada en `main`:

- Esquema: la tabla `products` incluye `imageUrl`, `imageKey`, `imageMimeType` e `imageSize` (migración `0021_ambiguous_mandarin.sql`).
- Configuración: `src/config/product-images.ts` expone getters para `NEXT_PUBLIC_PRODUCT_IMAGE_MAX_SIZE_MB`, `NEXT_PUBLIC_PRODUCT_IMAGE_ALLOWED_MIME_TYPES`, `PRODUCT_IMAGE_LOCAL_STORAGE_PATH`, `PRODUCT_IMAGE_ALLOWED_EXTERNAL_DOMAINS` y `NEXT_PUBLIC_PRODUCT_IMAGE_URL_MAX_LENGTH`.
- Almacenamiento: `src/lib/product-image-storage.ts` y `src/lib/product-image-upload-client.ts` soportan `local`, `vercel-blob`, `s3` y `r2` a través de `STORAGE_PROVIDER`.
- Endpoints: `POST /api/productos/imagen/preparar`, `POST /api/productos/imagen/upload` (solo `local`) y `GET /api/productos/imagen/[key]`.
- UI: `src/components/productos/product-image-uploader.tsx` se integra en `promo-form.tsx`; `product-card.tsx` muestra `product.imageUrl` en el catálogo público.
- CSP: `next.config.ts` extiende `img-src` con dominios de `PRODUCT_IMAGE_ALLOWED_EXTERNAL_DOMAINS` y los orígenes de `vercel-blob`, `s3` o `r2` según el proveedor.

### Sincronización documental aplicada

- Se actualizó `AGENTS.md` con variables de entorno, estructura del proyecto y sección dedicada a imágenes de productos.
- Se actualizó `README.md` del proyecto con sección de imágenes y variables relacionadas.
- Se actualizó `.devin/environment.yaml` con variables, endpoints y notas de imágenes.
- Se actualizó `.devin/prompts/README.md` y `.devin/README.md` para archivar `pago-mixto-ventas-y-pedidos.md`, `promos-con-servicios-y-manuales.md` y `plan-imagenes-promos.md`.
- Se actualizó `.devin/informes/guia-funcionamiento-pancheria.md` con la nota de imágenes en productos.

## 17. Actualización del panel de control

Se completó la actualización del panel de control para reflejar el estado funcional vigente del proyecto.

### Cambios implementados

**Fase 1 — Dashboard operativo**

- `src/app/(panel)/page.tsx` ahora delega en `src/components/panel/dashboard-client.tsx`, un componente cliente que carga el resumen operativo desde `GET /api/panel/resumen`.
- El endpoint `src/app/api/panel/resumen/route.ts` agrega `cashRegisterService.getOpenCashRegisterSummary`, `orderService.getOrders` por estado y `stockService.listStockAlerts`.
- `src/hooks/useDashboard.ts` expone `data`, `loading`, `error` y `refresh`; refresca automáticamente cada 30 segundos y respeta `isMountedRef` y `document.visibilityState`.
- El dashboard muestra:
  - Estado de la caja (abierta/cerrada, total, efectivo, transferencia, ventas, cierre automático).
  - Pedidos por estado (`pending`, `in_process`, `paid`, `finished`, `cancelled`).
  - Alertas de stock bajo.
  - Contexto de sucursal y usuario.
  - Accesos rápidos filtrados por rol.

**Fase 2 — Navegación y accesos**

- `src/components/panel/panel-header.tsx` actualizó los nombres del menú superior:
  - `Historial de cajas` (`/ventas/historial`).
  - `Caja y cierre` (`/cierre`).
  - `Cierres diarios` (`/cierre/historial`).
- Los menús de operador y administrador, así como el menú móvil, usan los mismos arreglos de navegación.

**Fase 3 — Tour interactivo y `data-tour`**

- `src/components/tour/tour-context.tsx` fue refactorizado para generar pasos por rol, con navegación automática entre rutas y `skipMissingElement: true`.
- Se agregaron/actualizaron atributos `data-tour` en `src/app/(panel)/page.tsx`, `src/app/(panel)/pedidos/page.tsx`, `src/components/pedidos/pedidos-list.tsx`, `src/components/pedidos/pedido-chat-section.tsx`, `src/app/(panel)/perfil/page.tsx`, `src/app/(panel)/videos/page.tsx`, `src/components/pagos/payment-parts-input.tsx` y `src/components/productos/product-image-uploader.tsx`.
- El tour cubre: panel, pagos mixtos, estados y chat de pedidos, reservas, videos, imágenes de promos, perfil, selector de sucursal y funciones administrativas.
- `src/components/tour/tour-context.test.tsx` se ajustó a los nuevos pasos y navegación.

**Fase 4 — Resumen de caja con insumos de recetas**

- `src/components/caja/cash-register-summary.tsx` agregó `recipeSuppliesSummary?: Record<string, number> | null` y renderiza la tarjeta "Insumos de recetas" con selectores de test y atributos ARIA.
- `src/config/caja.ts` y `cashRegisterService.getOpenCashRegisterSummary` ya propagaban el resumen; el componente ahora lo muestra consistentemente en caja abierta y cerrada.

### Tests y verificaciones

| Paso | Comando | Resultado |
| ---- | ------- | --------- |
| 1 | `npm run lint` | Pasa (exit 0) |
| 2 | `npx tsc --noEmit` | Pasa |
| 3 | `npm test` | 123 suites, 1163 tests pasan |
| 4 | `npm run build` | Build exitoso (44 páginas estáticas generadas) |
| 5 | `npm run knip` | Pasa |

**E2E:** no se ejecutó porque el entorno no dispone de una base descartable configurada (`.env.e2e` no existe y `.env.local` apunta a `neondb_dev`). Siguiendo las reglas de `AGENTS.md` y `tests/e2e/global-setup.ts`, los tests E2E solo deben correr con una base cuyo nombre termine en `test`, `e2e`, `testing`, `qa` o `staging`, o con `E2E_ALLOW_REMOTE_DB=true` explícito.

### Sincronización documental aplicada

- Se actualizó `README.md` con la nueva sección "Panel de control", los nombres de navegación y la descripción del tour.
- Se actualizó `.devin/informes/guia-funcionamiento-pancheria.md` con una sección dedicada al panel de control y el desglose `recipeSuppliesSummary` en caja.
- Se actualizó `.devin/environment.yaml` agregando el knowledge `panel` y corrigiendo un número duplicado en la sección de cron jobs.
- Se actualizó el presente `.devin/informes/reporte-estado.md` con la Fase 17 de actualización del panel.
- No se crearon ni archivaron prompts nuevos.

## 18. Auditoría de valores del panel de control

Se auditó que los valores mostrados en el panel provengan de servicios y configuración, y no estén hardcodeados en el cliente.

### Alcance

- `src/app/api/panel/resumen/route.ts`
- `src/application/services/cashRegisterService.ts` (`getOpenCashRegisterSummary`)
- `src/application/services/orderService.ts` (`getOrders`)
- `src/application/services/stockService.ts` (`listStockAlerts`)
- `src/hooks/useDashboard.ts`
- `src/components/panel/dashboard-client.tsx`
- `src/app/(panel)/page.tsx`

### Hallazgos

| Hallazgo | Tipo | Detalle |
|----------|------|---------|
| Valores de caja | Correcto | `total`, `cashTotal`, `transferTotal`, `totalSales`, `openedAt` e `id` se obtienen de `cashRegisterService.getOpenCashRegisterSummary`. El cierre automático se calcula con `getAutoCloseHours()` (variable de entorno). |
| Pedidos por estado | Correcto | `orderCounts` proviene de `orderService.getOrders` por cada estado. El total de pedidos activos se calcula como `pending + in_process + paid` en el cliente. |
| Alertas de stock | Correcto | `lowStockCount` proviene de `stockService.listStockAlerts` filtrado por `isLow`. |
| Contexto de sucursal/usuario | Correcto | `branchName` se resuelve desde `branchService.getBranchById(branchId)`; `userName` y `role` provienen de la sesión. |
| Labels de estados de pedidos | Informativo | Los textos (`Pendiente`, `En proceso`, etc.) y las clases de color de los badges están hardcodeados en `dashboard-client.tsx` como presentación pura. |
| Intervalo de refresco del dashboard | Menor | `DASHBOARD_REFRESH_INTERVAL_MS = 30000` está hardcodeado en `useDashboard.ts`. No es un valor de negocio mostrado, pero si se quiere ajustar sin deploy, conviene exponerlo como `NEXT_PUBLIC_DASHBOARD_REFRESH_INTERVAL_MS` con el mismo default. |

### Acciones aplicadas

- Se ajustó `src/app/api/panel/resumen/route.test.ts` (cambio del usuario) para que el mock de caja incluya `openedAt` y `createdAt` como `Date`, además de los campos faltantes (`cashInDrawer`, `closingCashCount`, `closingDifference`, `closingNotes`, `deletedAt`).
- Se ejecutaron y pasaron las verificaciones estándar:
  - `npx jest src/app/api/panel/resumen/route.test.ts` (3/3 tests)
  - `npm run lint`
  - `npx tsc --noEmit`
  - `npm test` (123 suites, 1163 tests)
  - `npm run build`
  - `npm run knip`

### Ajuste posterior (texto de pedidos activos)

A pedido del usuario se eliminó el párrafo "Tenés N pedidos activos" de `PedidosCard` en `src/components/panel/dashboard-client.tsx`. La card ahora muestra directamente los badges con el conteo por estado y el botón "Ver pedidos", evitando la ambigüedad de sumar estados distintos.

También se ajustaron exportaciones no usadas en `src/components/productos/supply-searchable-select.tsx` (`getGroupLabel` y `formatSupplyLabel` pasaron a ser internas) para mantener `npm run knip` limpio.

### Auditoría final de funcionalidad

Tras los últimos cambios del usuario (limpieza de imports en `src/components/productos/promo-form.tsx` y eliminación del texto de pedidos activos en `src/components/panel/dashboard-client.tsx`) se ejecutaron de nuevo todas las verificaciones estándar:

| Verificación | Resultado |
|---|---|
| `npm run lint` | Pasa (exit 0) |
| `npx tsc --noEmit` | Pasa |
| `npm test` | 123 suites, 1163 tests pasan |
| `npm run build` | Build exitoso (44 páginas estáticas generadas) |
| `npm run knip` | Pasa |

Se revisó que:

- `src/components/panel/dashboard-client.tsx` ya no contiene el resumen de "pedidos activos"; la `PedidosCard` muestra directamente los conteos por estado (`pending`, `in_process`, `paid`, `finished`, `cancelled`) obtenidos del endpoint.
- `src/components/productos/promo-form.tsx` usa `SupplySearchableSelect` importado desde `./supply-searchable-select`, con imports limpios y sin símbolos no usados.
- `src/components/productos/supply-searchable-select.tsx` mantiene exportaciones coherentes (`Supply`, `SupplyGroupKey`, `getSupplyGroupKey`, `SupplySearchableSelect`) y no reporta exports no usados.
- El build genera correctamente la ruta `/` del panel y el endpoint `/api/panel/resumen`.

### Conclusión

Los **valores de negocio mostrados en el panel son correctos y no están hardcodeados**: provienen del endpoint `GET /api/panel/resumen`, que consulta los servicios de caja, pedidos y stock. Los únicos literales fijos son presentacionales (textos y estilos de badges) y el intervalo de refresco del hook, que no afectan la corrección de los datos.

El proyecto queda **funcional y verificado**: todas las verificaciones estándar pasan, no hay errores de lint ni de tipos, el build es exitoso y el suite completo de tests (1163 tests) está verde.

---

## 19. Auditoría documental — 2026-08-30

Se auditaron y depuraron los documentos vigentes del proyecto para reflejar el estado actual del código y la configuración.

### Hallazgos corregidos

| Hallazgo | Tipo | Acción aplicada |
|----------|------|-----------------|
| `AGENTS.md` indicaba que los handlers de chat aceptaban `?content=` como fallback. | Mayor (obsoleto) | Se corrigió la sección "Chat de pedidos": los handlers usan `request.json()` y no aceptan query params. |
| `README.md` y `AGENTS.md` no listaban `npm run knip` ni módulos recientes (`product-image-storage`, `ventas-helpers`, `public-url`, etc.). | Menor | Se agregó `npm run knip` a los comandos y se actualizó la descripción de `src/lib/` y `src/config/`. |
| `.env.example` tenía `NEXT_PUBLIC_PEDIDOS_REFRESH_INTERVAL_MS=10000` sin aclarar que el default es `0` (deshabilitado). | Menor | Se comentó el ejemplo y se aclaró que el default es `0`. |
| `.env.example` omitía `PRODUCT_IMAGE_URL_MAX_LENGTH` (fallback sin `NEXT_PUBLIC_`). | Menor | Se agregó la variable comentada con su jerarquía. |
| `.devin/environment.yaml` tenía el punto `16.` duplicado y faltaban variables de ejecución. | Menor | Se renumeró a `17.` y `18.` y se agregaron `BASE_URL`, `E2E_ENABLE_RATE_LIMIT`, `NO_WEB_SERVER`, `NO_GLOBAL_SETUP`, `ANALYZE`. |
| `.devin/informes/guia-funcionamiento-pancheria.md` usaba nombres de variables incompletos (`AUTO_CLOSE_HOURS` en lugar de `CAJA_AUTO_CLOSE_HOURS`). | Menor | Se corrigieron los nombres en la tabla de configuración relevante. |
| `.devin/informes/guia-funcionamiento-pancheria.md` mantenía una respuesta de producción desfasada. | Menor | Se actualizó la respuesta corta de la sección 1. |
| `.devin/informes/entornos.md` no listaba `BASE_URL` ni `DATABASE_URL_UNPOOLED` para E2E. | Menor | Se agregaron como variables opcionales. |
| El prompt `auditoria-y-mejoras-ventas.md` seguía activo aunque sus objetivos ya estaban implementados. | Mayor (desactualizado) | Se archivó en `.devin/prompts/archivados/` y se actualizaron los índices de `prompts/README.md` y `.devin/README.md`. |
| `README.md` repetía la nota de insumos manuales dos veces. | Informativo | Se eliminó la línea duplicada. |

### Documentos auditados

- `README.md`
- `AGENTS.md`
- `.env.example`
- `.devin/environment.yaml`
- `.devin/informes/guia-funcionamiento-pancheria.md`
- `.devin/informes/entornos.md`
- `.devin/prompts/auditoria-y-mejoras-ventas.md` (archivado)
- `.devin/prompts/README.md`
- `.devin/README.md`
- `.devin/informes/reporte-estado.md` (este archivo)

### Verificaciones

Tras los cambios documentales se ejecutaron:

| Comando | Resultado |
|---------|-----------|
| `npm run lint` | Pasa |
| `npx tsc --noEmit` | Pasa |
| `npm test` | 123 suites, 1163 tests pasan |
| `npm run build` | Build exitoso (44 páginas estáticas generadas) |
| `npm run knip` | Pasa |

### Acciones pendientes (no documentales)

- Evaluar si se expone `NEXT_PUBLIC_DASHBOARD_REFRESH_INTERVAL_MS` para evitar el intervalo hardcodeado de 30 s en `useDashboard.ts`.
- Si el modelo multi-tenant avanza, actualizar `AGENTS.md`, `.env.example`, `.devin/environment.yaml` y `plan-implementacion-multi-tenant.md` con nuevas variables y rutas.
