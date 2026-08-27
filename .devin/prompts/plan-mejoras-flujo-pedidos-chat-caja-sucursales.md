# Prompt: Plan de mejoras — flujo de pedidos, chat, caja y sucursales

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja, cierre diario, multi-sucursal, catálogo público de pedidos, chat por pedido y gestión de videos.

Stack: Next.js 16.3.3 (App Router), React 19.2.8, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM 0.45.2 con PostgreSQL (Neon), NextAuth v5, Jest, Playwright.

Documentación de referencia obligatoria:
- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/plan-de-accion-pendientes.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/README.md" />

## Estado actual relevante

El flujo de pedidos permite a un cliente anónimo armar un carrito, completar su nombre y enviar un pedido `pending`. El operador lo confirma desde `/pedidos` generando una venta y descontando stock. El chat del pedido funciona mientras el pedido esté `pending`, con polling, paginación y adjuntos. La caja debe estar abierta para confirmar, pero no para crear el pedido. No se captura teléfono del cliente, no existen horarios de sucursal y el pedido solo tiene tres estados (`pending`, `converted`, `cancelled`).

Archivos centrales del flujo vigente:
- <ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/cashRegisterService.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/chatService.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/repositories/orderRepository.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/repositories/orderMessageRepository.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/usePedidoClient.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-customer-form.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/pedidos-list.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/pedido-detail.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/pedido-actions.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/usePedidoDetail.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/chat/order-chat.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/chat/useOrderChat.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/chat/chat-message-list.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/sucursales/branch-list.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/sucursales/actions.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/lib/zod-schemas.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/lib/order-helpers.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/lib/whatsapp.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/lib/branch-resolver.ts" />
- <ref_file file="C:/developer/paginas/pancheria/tests/e2e/helpers.ts" />

## Objetivo

Implementar un plan por fases que resuelva los siguientes escenarios identificados en pruebas manuales:

1. Pedir el número de celular del cliente junto con el nombre, diferenciar clientes por teléfono y permitir filtrar pedidos por número de celular.
2. Auditar y mejorar el chat: envío/recepción fluida, notificaciones eficaces, estados de mensaje (enviado, recibido, leído) y tildes estilo WhatsApp.
3. Bloquear el envío del pedido si la caja de la sucursal está cerrada; permitir armar el carrito; mostrar mensaje con el horario de apertura de la sucursal.
4. Agregar horarios de apertura a las sucursales, creables y editables desde el panel.
5. Separar el ciclo de vida del pedido en etapas que controlen el stock: pedido recibido/en proceso (reserva de stock), pedido pagado (conversión en venta y descuento definitivo), pedido finalizado (entregado/retirado).
6. Mantener siempre el flujo controlado ante todos los escenarios cotidianos.

## Reglas de negocio

1. El cliente puede armar el carrito en cualquier momento, pero solo enviar el pedido si la caja de la sucursal elegida está abierta.
2. Si la caja está cerrada, la interfaz debe mostrar el horario de apertura de la sucursal.
3. Dos clientes pueden tener el mismo nombre, pero el número de celular es único a efectos de identificación en el panel.
4. El panel de pedidos debe poder filtrar por número de celular (búsqueda parcial o exacta, a definir).
5. El seguimiento de pedido (`/pedido/seguimiento`) debe permitir buscar por número de pedido y teléfono, o combinado.
6. El chat debe reflejar estados de entrega por mensaje: enviado (servidor recibió el mensaje), recibido (el destinatario lo cargó), leído (el destinatario abrió el chat).
7. El pedido debe pasar por estados diferenciados:
   - `pending`: creado, sin reservar stock.
   - `in_process` (recibido y en proceso): reserva stock para armarlo.
   - `paid`/`converted`: el cliente pagó, se genera la venta y se convierte la reserva en descuento definitivo.
   - `finished`: el pedido salió con envío o fue retirado.
   - `cancelled`: anulado; si había reserva o stock descontado, se reintegra.
8. No se debe descontar stock dos veces ni perder reservas en las transiciones de estado.
9. Los horarios de sucursal deben soportar múltiples franjas por día de la semana.
10. Todos los cambios deben ser compatibles con el flujo de tests E2E y unitarios existentes.

## Implementación detallada por fases

> Ejecutar cada fase de forma independiente, verificando build, tipos y tests antes de pasar a la siguiente. No combinar fases sin validación intermedia.

### Fase 1 — Número de celular del cliente y filtro por teléfono

#### Base de datos
- Agregar `customerPhone` a `orders` en <ref_snippet file="C:/developer/paginas/pancheria/src/db/schema.ts" lines="254-277" />.
  - `customerPhone: varchar('customer_phone', { length: 50 }).notNull()`.
  - Agregar índice `customerPhoneIdx` para búsquedas.
- Generar migración con `npx drizzle-kit generate` y aplicarla en el entorno correspondiente siguiendo <ref_file file="C:/developer/paginas/pancheria/.devin/informes/entornos.md" />.

#### Dominio y tipos
- Actualizar `Order` en <ref_snippet file="C:/developer/paginas/pancheria/src/domain/types.ts" lines="61-79" />.
- Actualizar interfaces `CreatedOrder`, `OrderListItem`, `OrderDetail` y `TrackedOrder` en los componentes y hooks.

#### Backend
- Actualizar `orderSchema` en <ref_snippet file="C:/developer/paginas/pancheria/src/lib/zod-schemas.ts" lines="155-174" /> para validar `customerPhone`.
  - Requerido, mínimo 8 caracteres, solo dígitos y opcional `+` inicial.
- Actualizar `buildOrderValues` en <ref_file file="C:/developer/paginas/pancheria/src/lib/order-helpers.ts" />.
- Actualizar `CreateOrderInput` y `createOrder` en <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" />.
- Actualizar `findOrders` en <ref_snippet file="C:/developer/paginas/pancheria/src/repositories/orderRepository.ts" lines="113-180" /> para buscar también por `customerPhone` cuando `search` contenga dígitos.
- Actualizar `trackOrder` en <ref_snippet file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" lines="364-396" /> para buscar por `orderNumber` y `customerPhone` (y mantener fallback por `customerName` si aún se requiere).

#### Frontend
- `pedido-customer-form.tsx`: agregar input de teléfono.
- `usePedidoClient.ts`: manejar `customerPhone`, validar y enviarlo al API.
- `pedido-success-dialog.tsx`: mostrar teléfono en el resumen.
- `pedidos-list.tsx`: cambiar placeholder del buscador a "Nombre o teléfono" y ajustar `order-customer-name` (agregar celular opcionalmente).
- `pedido-info.tsx`: mostrar teléfono del cliente.
- `order-tracker.tsx`: agregar campo de teléfono, guardar/recuperar con `last-customer-name.ts` o un helper nuevo `last-customer-phone.ts`.
- `whatsapp.ts`: incluir el teléfono en el mensaje si es útil para el negocio.

#### Tests
- Ajustar `orderService.test.ts`, `orderRepository.test.ts`, `route.test.ts` de `public/pedido` y `pedido-client.test.tsx`.
- Actualizar E2E `pedido-busqueda-filtros.spec.ts` y helpers para enviar `customerPhone`.

---

### Fase 2 — Horarios de sucursal y bloqueo de pedidos si la caja está cerrada

#### Base de datos
- [x] Agregar `openingHours` a `branches` en <ref_snippet file="C:/developer/paginas/pancheria/src/db/schema.ts" lines="74-85" />.
  - Campo JSONB con estructura `{ dayOfWeek: number; open: string; close: string }[]`.
  - Migración `drizzle/0017_unknown_energizer.sql` aplicada en desarrollo y producción.

#### Backend
- [x] `branchService.createBranch` y `branchService.updateBranch` en <ref_file file="C:/developer/paginas/pancheria/src/application/services/branchService.ts" />: aceptan y validan horarios.
- [x] `src/lib/branch-helpers.ts`: helpers `isBranchOpen`, `getCurrentOrNextOpening`, `formatOpeningHours` y `validateOpeningHours` con soporte de zona horaria configurable (`NEXT_PUBLIC_BRANCH_TIMEZONE`).
- [x] `orderService.createOrder` consulta `cashRegisterService.getOpenCashRegister(branchId)` y rechaza el pedido con `ValidationError` si la caja está cerrada, incluyendo el horario de apertura.
- [x] `GET /api/public/caja/estado?branchId={id}` expone el estado de la caja y el horario de apertura para consumo del catálogo.

#### Frontend
- [x] `branch-form.tsx`: permite crear/editar horarios de apertura por día de la semana.
- [x] `pedido-client.tsx` y `usePedidoClient.ts`: consultan el estado de la caja al abrir el checkout, muestran advertencia si está cerrada y mantienen el carrito editable.

#### Tests
- [x] Ajustados tests E2E que crean pedidos; se agrega `ensureCashRegisterOpen` en `beforeEach`.
- [x] Agregado `tests/e2e/pedido-caja-cerrada.spec.ts` para el mensaje de caja cerrada.
- [x] Tests unitarios `src/lib/branch-helpers.test.ts` y ajustes en `branchService.test.ts`, `orderService.test.ts`, `catalogService.test.ts`, `branch-resolver.test.ts` y otros mocks de `Branch`.

---

### Fase 3 — Nuevos estados del pedido y reserva de stock

#### Base de datos
- Extender `orderStatusEnum` en <ref_snippet file="C:/developer/paginas/pancheria/src/db/schema.ts" lines="47-51" /> con los valores `in_process`, `paid` (o conservar `converted`), `finished`.
- Considerar agregar una tabla `order_status_history` para auditoría de cambios (opcional pero recomendado).
- Considerar agregar un tipo de movimiento de stock `reserve` (o similar) al enum `stockMovementTypeEnum`.

#### Dominio y tipos
- Actualizar `OrderStatus` en <ref_snippet file="C:/developer/paginas/pancheria/src/domain/types.ts" line="21" />.
- Actualizar status labels y variants en `pedidos-list.tsx` y `pedido-header.tsx`.

#### Backend
- `orderService`:
  - Agregar `receiveOrder(branchId, orderId)` que pase de `pending` a `in_process` y reserve stock.
  - Agregar `finishOrder(branchId, orderId)` que pase de `paid` a `finished`.
  - Modificar `convertOrderToSale` para que, si el pedido está en `in_process`, convierta la reserva en descuento definitivo en lugar de descontar nuevamente.
  - Modificar `cancelOrder` para reintegrar stock reservado o descontado según el estado actual.
- `saleService`:
  - Separar la lógica de reserva (`reserveStockForItems`) de la conversión (`commitReservedStockToSale`).
  - Reutilizar `insertSaleAndUpdateCashRegister` para la venta final.
- `product-helpers.ts`:
  - `validateCartAvailability` debe considerar las reservas activas de otros pedidos `in_process`.
- Nuevos endpoints:
  - `POST /api/pedidos/[id]/recibir`.
  - `POST /api/pedidos/[id]/finalizar`.
  - Ajustar `POST /api/pedidos/[id]/confirmar` para soportar el nuevo flujo.

#### Frontend
- `pedido-actions.tsx` y `usePedidoDetail.ts`:
  - Nuevos botones: "Recibir y reservar", "Confirmar pago", "Finalizar pedido".
  - Mostrar estado actual claramente.
  - Deshabilitar acciones inválidas según el estado.
- `pedidos-list.tsx`:
  - Actualizar filtros y badges de estado.
- `order-chat.tsx`:
  - Mantener chat habilitado mientras el pedido no esté `finished` o `cancelled`.

#### Tests
- Agregar tests unitarios para transiciones de estado y reservas de stock.
- Actualizar E2E para reflejar el nuevo flujo: crear → recibir → confirmar → finalizar.
- Verificar que `cancelOrder` reintegra correctamente.

---

### Fase 4 — Chat con estados de mensaje (tildes WhatsApp-style)

#### Base de datos
- Agregar a `orderMessages` en <ref_snippet file="C:/developer/paginas/pancheria/src/db/schema.ts" lines="322-353" />:
  - `deliveredAt: timestamp('delivered_at')`.
  - Ajustar semántica de `readAt` para que sea por mensaje individual (ya existe; cambiar lógica de lectura).
- Opcional: agregar campo `status` de tipo enum (`sent`, `delivered`, `read`) si se prefiere sobre timestamps.

#### Backend
- `orderMessageRepository`:
  - `markAsReadByOrderAndSender` debe marcar mensajes individuales del remitente opuesto como leídos.
  - Agregar `markMessagesAsDelivered(orderId, senderType, messageIds)`.
- `chatService`:
  - Al listar mensajes, el receptor puede marcar como entregados los mensajes que ve por primera vez.
  - `markClientMessagesAsRead` y `markOperatorMessagesAsRead` deben seguir marcando como leídos los mensajes del remitente opuesto.
- API:
  - `POST /api/pedidos/[id]/chat/leido` y `POST /api/public/pedido/[id]/chat/leido` marcan como leídos.
  - Considerar un endpoint para marcar como entregado, o inferirlo en el `GET`/`POST` de listado.

#### Frontend
- `chat-message-list.tsx`:
  - Mostrar íconos de tildes simple (enviado), doble (recibido) o doble azul/acentuado (leído) en cada burbuja propia.
  - Mostrar hora de envío y, al hacer hover, estado de entrega.
- `useOrderChat.ts`:
  - Al recibir mensajes del otro lado, marcarlos como entregados.
  - Al abrir el chat, marcar como leídos los mensajes del otro.

#### Tests
- Tests unitarios para `chatService` y `orderMessageRepository`.
- Tests de componente para `chat-message-list.tsx`.

---

### Fase 5 — Integración, ajustes finales y validación

1. Revisar y actualizar `src/db/seeds.ts` si se agregan datos iniciales de horario.
2. Revisar `.env.example` si se agregan variables (no parece necesario para estas fases).
3. Actualizar `AGENTS.md` si cambian variables de entorno, comandos o convenciones nuevas.
4. Actualizar `.devin/informes/reporte-estado.md` y `.devin/informes/plan-de-accion-pendientes.md`.
5. Ejecutar verificaciones en cada fase (ver tabla).

## Consideraciones de seguridad y entorno

- No hardcodear credenciales, URLs de API ni secretos. Todos los valores sensibles deben provenir de variables de entorno o configuraciones dinámicas.
- Ejecutar `npx drizzle-kit generate` / `npx drizzle-kit push` solo contra bases de datos de desarrollo o prueba, nunca producción sin validación previa.
- Ejecutar `npm run test:e2e` solo en base de datos descartable cuyo nombre termine en `test`, `e2e`, `testing`, `qa` o `staging`, como indica `AGENTS.md`.
- No exponer `.env.local`, credenciales de administrador ni URLs de base de datos en documentación o prompts.
- Los horarios de sucursal deben validarse en el servidor; no confiar únicamente en la UI.
- Rate limits: los nuevos endpoints (`recibir`, `finalizar`) deben protegerse con autenticación (`withAuth`) y, si son públicos, con `createRateLimiter`.

## Verificaciones

| Fase | Comandos | Propósito |
| ---- | -------- | --------- |
| Todas | `npx tsc --noEmit` | Tipos correctos |
| Todas | `npm run lint` | Estilo y calidad |
| 1, 3, 4 | `npm test` | Tests unitarios |
| 2, 3, 5 | `npx drizzle-kit check` | Consistencia del esquema (con base de prueba) |
| Todas | `npm run build` | Build de producción |
| 5 | `npm run test:e2e` | Flujos críticos end-to-end (base de prueba) |

## Notas de implementación

- Mantener compatibilidad hacia atrás en los datos existentes: los pedidos `converted` actuales deben interpretarse como `paid` o `finished` según se defina en la migración.
- Para la reserva de stock, preferir un enfoque de movimientos de stock con tipo `reserve` y luego conversión, en lugar de una tabla separada, para aprovechar la trazabilidad existente en `stockMovements`.
- Si el teléfono se usa como identificador único en `trackOrder`, validar formato normalizado en el cliente y en el servidor.
- En el chat, el estado "recibido" puede inferirse de la primera carga exitosa por el destinatario; no requiere un WebSocket. El estado "leído" se activa cuando el destinatario abre el chat (llamada a `leido`).

---

## Registro de avance

### 2026-08-26 — Fase 1 en progreso

Se implementó la captura del número de celular del cliente, el filtro por teléfono en el panel y la búsqueda por teléfono en el seguimiento. La migración de base de datos `drizzle/0016_tranquil_the_initiative.sql` genera la columna `customer_phone` y su índice.

Archivos modificados principales:
- <ref_snippet file="C:/developer/paginas/pancheria/src/db/schema.ts" lines="263-294" /> — agrega `customerPhone` e índice.
- <ref_file file="C:/developer/paginas/pancheria/src/lib/zod-schemas.ts" /> — validación de `customerPhone`.
- <ref_file file="C:/developer/paginas/pancheria/src/lib/order-helpers.ts" /> — `buildOrderValues` incluye teléfono normalizado.
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" /> — `createOrder`, `trackOrder` y `TrackOrderResult` con teléfono.
- <ref_file file="C:/developer/paginas/pancheria/src/repositories/orderRepository.ts" /> — búsqueda por nombre o teléfono.
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-customer-form.tsx" /> — input de teléfono.
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/usePedidoClient.ts" /> — estado y validación del teléfono.
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/order-tracker.tsx" /> — búsqueda y visualización del teléfono.
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/pedidos-list.tsx" /> — filtro por nombre o teléfono.
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/pedido-info.tsx" /> — muestra teléfono.

Verificaciones ejecutadas:
- `npx tsc --noEmit`: exitoso.
- `npm run lint`: exitoso.
- `npm run build`: exitoso.
- `npm test`: 118 suites, 1089 tests, exitoso.
- `npx drizzle-kit generate`: generó `drizzle/0016_tranquil_the_initiative.sql`.
- `npx drizzle-kit push --force` (desarrollo): aplicó la migración en la base de desarrollo.
- `npx drizzle-kit push --force` (producción): aplicó la migración en la base de producción; se verificó que `customer_phone` existe en `orders`.

Pendiente:
- Continuar con la Fase 2 (horarios de sucursal y bloqueo por caja cerrada).
