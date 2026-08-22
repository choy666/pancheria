# Prompt: Mejoras del flujo de chat de pedidos

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja y cierre de caja.

Stack: Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM con PostgreSQL (Neon), NextAuth v5.

Documentación de referencia:
- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/README.md" />
- <ref_file file="C:/developer/paginas/pancheria/.env.example" />

## Estado actual relevante

El proyecto ya implementó un flujo de chat por pedido con las siguientes características:

- El cliente accede al chat desde `/pedido/[id]/chat?token={cancellationToken}` usando el mismo `cancellationToken` que permite cancelar el pedido.
- El servidor devuelve `expiresAt` al crear el pedido, calculado con `getOrderExpirationMs()`.
- Los pedidos recientes se persisten en `localStorage` bajo `pancheria-recent-orders-v1` y se muestran en un banner en `/pedido`.
- Existe una página de seguimiento en `/pedido/seguimiento` que permite buscar un pedido por `orderNumber` + `customerName`.
- El mensaje de WhatsApp incluye el enlace público al chat.
- El chat hace polling cada `NEXT_PUBLIC_CHAT_REFRESH_INTERVAL_MS` (por defecto 5.000 ms) y trae hasta 100 mensajes sin paginación.

<ref_snippet file="C:/developer/paginas/pancheria/src/components/pedido/recent-orders-banner.tsx" lines="15-74" />
<ref_snippet file="C:/developer/paginas/pancheria/src/components/pedido/order-tracker.tsx" lines="21-31" />
<ref_snippet file="C:/developer/paginas/pancheria/src/repositories/orderMessageRepository.ts" lines="7-19" />
<ref_snippet file="C:/developer/paginas/pancheria/src/config/chat.ts" lines="7-15" />

## Objetivo

Implementar las siguientes mejoras sobre el flujo de chat de pedidos, en orden de prioridad:

1. Validar el estado real del pedido en el banner de pedidos recientes para ocultar pedidos que ya no estén `pending` antes de que venzan.
2. Recordar el último `customerName` usado en `/pedido/seguimiento` para agilizar búsquedas futuras.
3. Agregar paginación en el chat para soportar conversaciones de más de 100 mensajes.

Cada mejora debe respetar las convenciones del proyecto, incluir tests y pasar las verificaciones estándar.

## Reglas de negocio

1. Un pedido solo puede enviar mensajes mientras su estado sea `pending`.
2. El `cancellationToken` es el mismo para cancelar el pedido y acceder al chat. No separar tokens salvo que se decida explícitamente como nueva funcionalidad de seguridad.
3. El banner de pedidos recientes solo debe mostrar pedidos que estén `pending` o cuya expiración no haya pasado.
4. El seguimiento por número de pedido requiere `orderNumber` + `customerName` y solo devuelve `cancellationToken` si el pedido está `pending`.
5. La paginación del chat debe ser por `limit`/`offset` o cursor, debe preservar el orden cronológico y debe seguir funcionando el polling de mensajes nuevos.
6. No hardcodear URLs, credenciales ni timeouts. Usar variables de entorno y configuraciones dinámicas.

## Implementación detallada

### 1. Validar estado del banner de pedidos recientes

#### Opción A: validación pasiva (mínima)
- No agregar nuevos endpoints.
- Al hacer clic en "Ir al chat", el usuario navega a `/pedido/[id]/chat?token=...`.
- `OrderChat` hace `GET /api/public/pedido/[id]/chat` y recibe `status`.
- Si `status !== 'pending'`, `OrderChat` ya pasa a solo lectura automáticamente.

#### Opción B: validación activa (recomendada si hay confusión de usuarios)
- Crear `GET /api/public/pedido/[id]/estado?token=...` que devuelva solo `{ status, expiresAt }` sin mensajes.
- Modificar `src/components/pedido/recent-orders-banner.tsx` para que, al montarse, llame a ese endpoint por cada pedido guardado.
- Si el pedido no está `pending` o no se encuentra, llamar a `removeRecentOrder(id)` para ocultarlo y limpiar `localStorage`.

Archivos a tocar:
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/recent-orders-banner.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/lib/recent-orders.ts" />
- `src/app/api/public/pedido/[id]/estado/route.ts` (nuevo, solo Opción B)
- `src/application/services/chatService.ts` (agregar `getOrderChatStatus` para Opción B)
- `src/repositories/orderRepository.ts` (reutilizar `findByIdWithToken`)
- Tests: `recent-orders-banner.test.tsx` (nuevo), `pedido-client.test.tsx`, `route.test.ts` del nuevo endpoint.

### 2. Recordar el nombre del cliente

- Al enviar el formulario de seguimiento con éxito, guardar `customerName` en `localStorage` bajo `pancheria-last-customer-name`.
- Al montar `OrderTracker`, leer esa clave y prellenar el input.
- Coherente con el patrón de `useCart` y `recent-orders`, que cargan `localStorage` en efecto o con `useSyncExternalStore`.

Archivos a tocar:
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/order-tracker.tsx" />
- `src/lib/last-customer-name.ts` (nuevo, helper de storage) o extender `src/lib/recent-orders.ts`
- Tests: `order-tracker.test.tsx` (nuevo)

### 3. Paginación en el chat

#### Backend
- Extender `GET /api/public/pedido/[id]/chat` y `GET /api/pedidos/[id]/chat` para aceptar `?page` o `?cursor`.
- Modificar `chatService.listClientMessages` y `listOperatorMessages` para pasar `limit`/`offset` al repositorio.
- Considerar agregar `countMessagesByOrderId` si se quiere mostrar un total de páginas.

#### Frontend
- En `OrderChat`, separar mensajes cargados del polling:
  - Cargar historial al montar con `limit`/`offset` (o cursor).
  - El polling debe traer solo mensajes nuevos desde el último `id` o `createdAt` conocido.
- Agregar un botón "Cargar mensajes anteriores" al tope del scroll.
- Preservar el scroll position al cargar mensajes anteriores.

Archivos a tocar:
- <ref_file file="C:/developer/paginas/pancheria/src/components/chat/order-chat.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/chatService.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/repositories/orderMessageRepository.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/pedido/[id]/chat/route.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/pedidos/[id]/chat/route.ts" />
- `src/lib/zod-schemas.ts` (query param schema)
- Tests: `order-chat.test.tsx` (nuevo o existente), `chatService.test.ts`, `route.test.ts`

## Consideraciones de seguridad y entorno

- No hardcodear credenciales, URLs de API ni parámetros sensibles. El enlace de WhatsApp ya usa `NEXT_PUBLIC_APP_URL` o `NEXTAUTH_URL` <ref_file file="C:/developer/paginas/pancheria/.env.example" />.
- El `cancellationToken` sigue siendo el token de chat/cancelación. Guardarlo en `localStorage` del cliente no cambia el modelo de seguridad porque el enlace ya estaba expuesto en la URL del dispositivo.
- El seguimiento por número de pedido exige `orderNumber` + `customerName`. El `orderNumber` incluye timestamp y UUID, por lo que es difícil de adivinar. El token solo se devuelve si el pedido está `pending`.
- Recordar el nombre del cliente en `localStorage` no expone datos sensibles: solo el nombre, no el número de pedido ni el token.
- Si se implementa la paginación, asegurarse de que el rate limit del chat (`PUBLIC_CHAT_RATE_LIMIT_MAX_REQUESTS` por IP y ventana) no se vea afectado negativamente por cargas de historial. Considerar endpoints separados para historial y polling.
- Ejecutar tests E2E solo en bases de datos de prueba.

## Verificaciones

| Comando | Propósito |
| ------- | --------- |
| `npx tsc --noEmit` | Verificación de tipos |
| `npm run lint` | Estilo y calidad |
| `npm test` | Tests unitarios |
| `npm run build` | Build de producción |
| `npm run test:e2e` | Tests E2E en base de prueba (solo si cambia flujo crítico de UI) |

## Notas de implementación

- Preferir `useSyncExternalStore` para sincronizar `localStorage` con React, siguiendo el patrón de `useRecentOrders`.
- No leer `localStorage` durante el render de un Client Component para evitar hydration mismatch. Inicializar con valor seguro para SSR y cargar en efecto o con `useSyncExternalStore`.
- Si se agrega `GET /api/public/pedido/[id]/estado`, reutilizar `findByIdWithToken` para mantener la misma validación que el chat.
- La paginación del chat es relevante principalmente si los pedidos suelen generar más de 100 mensajes. En la mayoría de los casos de comida rápida, el límite actual es suficiente.
