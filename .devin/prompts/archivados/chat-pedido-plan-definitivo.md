# Plan definitivo: chat anclado a pedidos (Fase 1 — texto + read receipts / Fase 2 — adjuntos)

## Resumen de decisiones

1. **Token de acceso (Fase 1):** reutilizar `cancellationToken`. Diseñar `chatService` para que acepte un token opaco y permita migrar a un `chatToken` separado en Fase 2 sin romper la API pública.
2. **WhatsApp:** `whatsappUrl` pasa a ser **opcional** en la respuesta de creación del pedido. El chat es el canal principal; el enlace a WhatsApp es un fallback.
3. **Read receipts:** implementar en **Fase 1** (`readAt`, endpoints `/leido`, badge de no leídos en el panel).
4. **Rate limit:** crear `src/lib/rate-limit.ts` con `getClientIp` y `createRateLimiter(scope, windowMs, maxRequests)`, usando la tabla `public_order_rate_limits` con un **prefijo de scope** (`order:` / `chat:`). Es la opción más práctica y simple porque evita que el chat consuma el cupo de creación de pedidos.
5. **Adjuntos Fase 2:** reutilizar `STORAGE_PROVIDER` y `LOCAL_STORAGE_PATH`, pero con un módulo de storage propio (`src/lib/chat-storage.ts`). No reutilizar directamente `src/lib/storage.ts`, que está pensado para videos.

---

## Estado de partida

- No existe tabla `order_messages`, ni servicio, ni endpoints, ni componentes de chat.
- `src/app/api/public/pedido/route.ts` duplica la lógica de rate limit por IP.
- No existe `src/lib/rate-limit.ts` con `createRateLimiter` / `getClientIp` (a pesar de la nota que indica lo contrario; hay que crearlo).
- `formatTime` ya existe en `src/lib/date.ts`.
- `src/lib/storage.ts` es específico para videos (`videos/` como prefijo, MIME de video).
- `tests/e2e/global-setup.ts` y `AGENTS.md` no mencionan `order_messages`.

---

## Advertencias críticas que este plan resuelve

- **Condición de carrera:** al enviar mensajes se debe leer el pedido con `SELECT ... FOR UPDATE` **dentro de la transacción** y revalidar `status === 'pending'` antes del `INSERT`. Se recomienda aplicar el mismo patrón en `orderService.convertOrderToSale` y `cancelOrder`.
- **Token de acceso:** reutilizar `cancellationToken` en Fase 1, pero dejar la puerta abierta a un `chatToken` separado en Fase 2.
- **Adjuntos locales:** servir siempre por `GET /api/chat/attachment/[key]`, nunca exponer paths físicos.
- **Paginación:** `findByOrderId` debe soportar `offset`/`limit` con default de 100 mensajes desde Fase 1.
- **Auto-scroll:** el componente `OrderChat` debe scrollear al último mensaje al montar y cuando lleguen mensajes nuevos.
- **Read receipts:** exponer `POST .../chat/leido` y reflejarlo en un badge del panel.
- **Tests E2E:** correr `npm run test:e2e` solo contra una base de prueba; agregar `order_messages` al `TRUNCATE` de `tests/e2e/global-setup.ts` y a `AGENTS.md`.
- **Limpieza de adjuntos huérfanos:** en Fase 2 evaluar un job/cron que borre adjuntos del storage que ya no tengan mensajes asociados.
- **`x-forwarded-for`:** tomar la primera IP (comportamiento correcto para Vercel).

---

## Fase 1: chat de texto

### 1.1 Esquema de base de datos

En `src/db/schema.ts`:

- Nuevo enum `order_message_sender` con valores `client`, `operator`.
- Nueva tabla `order_messages`:
  - `id` serial primary key.
  - `orderId` integer not null → FK a `orders.id` `onDelete: 'cascade'`.
  - `senderType` enum not null.
  - `senderName` varchar(255) nullable.
  - `content` text not null.
  - `readAt` timestamp nullable.
  - `createdAt` timestamp defaultNow not null.
- Índices:
  - `order_messages_order_id_idx` en `orderId`.
  - `order_messages_order_created_at_idx` en `(orderId, createdAt)`.
  - `order_messages_order_sender_read_at_idx` en `(orderId, senderType, readAt)`.
- Relaciones:
  - `ordersRelations.messages: many(orderMessages)`.
  - `orderMessagesRelations.order: one(orders)`.

Generar y aplicar migración:

```bash
npx drizzle-kit generate
npx drizzle-kit push
```

### 1.2 Tipos y configuración

- `src/domain/types.ts`:
  - `type OrderMessageSenderType = 'client' | 'operator'`.
  - `type OrderMessage` (id, orderId, senderType, senderName, content, readAt, createdAt).
  - `type OrderWithUnreadCount = OrderWithItems & { unreadCount: number }` (opcional).
- `src/config/chat.ts`:
  - `getChatRefreshIntervalMs()` — default 5000 ms.
  - `getChatMaxTextLength()` — default 1000.
  - `getChatRateLimitWindowMs()` — default 60000.
  - `getChatRateLimitMaxRequests()` — default 60.
- `.env.example`:
  - `NEXT_PUBLIC_CHAT_REFRESH_INTERVAL_MS=5000`
  - `NEXT_PUBLIC_CHAT_MAX_TEXT_LENGTH=1000`
  - `PUBLIC_CHAT_RATE_LIMIT_WINDOW_MS=60000`
  - `PUBLIC_CHAT_RATE_LIMIT_MAX_REQUESTS=60`
- `AGENTS.md`:
  - Documentar las variables nuevas.
  - Agregar `order_messages` al listado de tablas truncadas en E2E.

### 1.3 Validación

- `src/lib/zod-schemas.ts`:
  - `orderMessageSchema` con `content: z.string().min(1)` (el máximo se aplica en servicio usando `getChatMaxTextLength`).

### 1.4 Repositorios

- **Nuevo `src/repositories/orderMessageRepository.ts`**:
  - `findByOrderId(orderId, { limit?, offset? })` — orden `createdAt ASC`, default `limit=100`.
  - `insertMessage(tx, values)`.
  - `markAllAsReadByOrderAndSender(orderId, senderType)` — marca mensajes del remitente indicado como leídos.
- **`src/repositories/orderRepository.ts`**:
  - `findByIdWithToken(orderId, token)`.
  - `findByIdWithTokenForUpdate(tx, orderId, token)` — `SELECT ... FOR UPDATE`.
  - `findByIdForUpdate(tx, branchId, orderId)`.
  - `findByIdForCancelForUpdate(tx, branchId, orderId)` (puede reemplazar a `findByIdForCancel` en operaciones de escritura).

### 1.5 Rate limit compartido

Crear `src/lib/rate-limit.ts`:

```ts
import { NextRequest } from 'next/server';
import { createPublicOrderRateLimitStore } from '@/lib/public-order-rate-limit-store';

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return (request as unknown as { ip?: string }).ip ?? 'unknown';
}

export function createRateLimiter(
  scope: string,
  windowMs: number,
  maxRequests: number
) {
  const store = createPublicOrderRateLimitStore();

  return async function isRateLimited(ip: string): Promise<boolean> {
    if (process.env.NODE_ENV === 'test') return false;

    const key = `${scope}:${ip}`;
    const now = Date.now();
    const record = await store.get(key);

    if (!record || now > record.resetAt) {
      await store.set(key, { count: 1, resetAt: now + windowMs });
      return false;
    }

    record.count += 1;
    if (record.count > maxRequests) return true;

    await store.set(key, record);
    return false;
  };
}
```

- Refactorizar `src/app/api/public/pedido/route.ts` para usar `createRateLimiter('order', ...)`, eliminando la lógica duplicada.
- El endpoint de chat usará `createRateLimiter('chat', ...)`.

### 1.6 Servicio de chat

Nuevo `src/application/services/chatService.ts`:

- `getChatContext(orderId, token)` — devuelve `orderNumber`, `branchName`, `status`, `messages`.
- `listClientMessages(orderId, token)` y `listOperatorMessages(orderId, branchId)`.
- `sendClientMessage` / `sendOperatorMessage`:
  - Ejecutar dentro de `executeInTransaction`.
  - Dentro de la transacción, leer el pedido con `FOR UPDATE` usando `findByIdWithTokenForUpdate` / `findByIdForUpdate`.
  - Si el pedido no es `pending`, lanzar `ValidationError`.
  - Sanitizar `content` (trim, longitud máxima).
  - Insertar el mensaje.
- `markClientMessagesAsRead(orderId, token)` — marca mensajes del `operator` como leídos.
- `markOperatorMessagesAsRead(orderId, branchId)` — marca mensajes del `client` como leídos.

El token en Fase 1 es `cancellationToken`. Las interfaces deben aceptar `token: string` para poder cambiarlo por `chatToken` en Fase 2 si se decide.

### 1.7 Endpoints API

- `src/app/api/public/pedido/[id]/chat/route.ts`:
  - `GET`: valida `?token=...`, rate limit, devuelve `{ messages }`.
  - `POST`: valida token, rate limit, body con `content`, devuelve `{ message }` 201.
- `src/app/api/public/pedido/[id]/chat/leido/route.ts`:
  - `POST`: marca mensajes del operador como leídos para el cliente.
- `src/app/api/pedidos/[id]/chat/route.ts`:
  - `GET`: `requireAuth` + `getCurrentBranchId`, devuelve mensajes.
  - `POST`: envía mensaje del operador.
- `src/app/api/pedidos/[id]/chat/leido/route.ts`:
  - `POST`: marca mensajes del cliente como leídos para el operador.
- `src/config/api.ts`: agregar constantes para las nuevas rutas.

### 1.8 Read receipts

- Utilizar `order_messages.readAt`.
- `OrderChat` llama al endpoint `/leido` correspondiente al montar y cuando llegan mensajes del remitente opuesto.
- `GET /api/pedidos` debe incluir `unreadCount` por pedido (mensajes del `client` con `readAt IS NULL`).
- Mostrar badge de no leídos en:
  - `PedidosList` (columna de acciones).
  - Header de la tarjeta de chat en `PedidoDetail`.

### 1.9 Componentes y páginas UI

- **Nuevo `src/components/chat/order-chat.tsx`**:
  - Client component.
  - `isMountedRef` para evitar setState tras desmonte.
  - Polling cada `NEXT_PUBLIC_CHAT_REFRESH_INTERVAL_MS`.
  - Paginación: default 100 mensajes, preparado para `offset`/`limit`.
  - Auto-scroll al final al montar, al recibir y al enviar mensajes.
  - Burbujas: `client` a la derecha, `operator` a la izquierda.
  - Input con `maxLength={getChatMaxTextLength()}`, deshabilitado si `readOnly`.
  - No leer `localStorage` durante el render para evitar hydration mismatch.
- **Nuevo `src/app/(public)/pedido/[id]/chat/page.tsx`**:
  - Server component.
  - Lee `params` y `searchParams` (`token`).
  - Llama a `chatService.getChatContext`.
  - Renderiza `OrderChat` con `initialMessages` y `readOnly={status !== 'pending'}`.
- **Modificar `src/components/pedido/pedido-client.tsx`**:
  - `whatsappUrl` pasa a `string | null`.
  - En el diálogo de éxito, el CTA principal es **"Ir al chat del pedido"** y redirige a `/pedido/${order.id}/chat?token=${order.cancellationToken}`.
  - Mostrar el botón de WhatsApp solo si `whatsappUrl` existe.
- **Modificar `src/components/pedidos/pedido-detail.tsx`**:
  - Envolver el bloque de acciones en `order.status === 'pending'`.
  - Agregar tarjeta de chat debajo, visible para todos los estados.
  - Pasar `readOnly={order.status !== 'pending'}` a `OrderChat`.
  - Mostrar `unreadCount` en el header de la tarjeta de chat.

### 1.10 Integración en flujo de pedido

En `src/app/api/public/pedido/route.ts`:

- No fallar si `NEXT_PUBLIC_WHATSAPP_NUMBER` no está configurado.
- Intentar construir `whatsappUrl` con `buildWhatsAppUrl`. Si no se puede, devolver `whatsappUrl: null`.
- El cliente recibe el pedido, abre el chat como canal principal y puede usar WhatsApp solo como fallback.

### 1.11 Tests

- `src/application/services/chatService.test.ts`
- `src/repositories/orderMessageRepository.test.ts`
- `src/app/api/public/pedido/[id]/chat/route.test.ts`
- `src/app/api/pedidos/[id]/chat/route.test.ts`
- `tests/e2e/pedido-chat.spec.ts`
- Actualizar `tests/e2e/global-setup.ts`:
  - Agregar `order_messages` al `TRUNCATE`.
- Actualizar `AGENTS.md`:
  - Agregar `order_messages` al listado de tablas truncadas.
- Actualizar `tests/e2e/pedido.spec.ts`:
  - Adaptar al flujo de chat y a `whatsappUrl` opcional.

### 1.12 Verificación Fase 1

```bash
npx tsc --noEmit
npm run lint
npm test
npm run build
npx playwright test tests/e2e/pedido-chat.spec.ts
npm run test:e2e
```

---

## Fase 2: adjuntos de imagen

### 2.1 Esquema

En `src/db/schema.ts`:

- `order_messages.content` pasa a nullable.
- Agregar:
  - `attachmentUrl` text nullable.
  - `attachmentMimeType` varchar(100) nullable.
  - `attachmentSize` integer nullable.
  - `attachmentName` varchar(255) nullable.
- Validar en servicio que un mensaje tenga `content` o `attachmentUrl`.

Generar y aplicar migración:

```bash
npx drizzle-kit generate
npx drizzle-kit push
```

### 2.2 Tipos y configuración

- `src/domain/types.ts`: actualizar `OrderMessage` con campos de adjunto.
- `src/config/chat.ts`:
  - `getChatImageMaxSizeMb()` — default 5.
  - `getChatImageMaxSizeBytes()`.
  - `getChatAllowedImageMimeTypes()` — default `['image/jpeg', 'image/png', 'image/webp']`.
- `.env.example`:
  - `NEXT_PUBLIC_CHAT_IMAGE_MAX_SIZE_MB=5`
  - `NEXT_PUBLIC_CHAT_ALLOWED_IMAGE_MIME_TYPES=image/jpeg,image/png,image/webp`

### 2.3 Validación

- `src/lib/zod-schemas.ts`:
  - `chatAttachmentSchema`: url, mimeType, size, name.
  - `chatMessageSchema`: content opcional, attachment opcional, con `.superRefine` que exija al menos uno.

### 2.4 Storage de chat

Nuevo `src/lib/chat-storage.ts`:

- Proveedores: `local`, `vercel-blob`, `s3`, `r2`.
- Lee `STORAGE_PROVIDER` y `LOCAL_STORAGE_PATH` (u opcionalmente `CHAT_STORAGE_PROVIDER` si más adelante se desea separar).
- Validar MIME contra `getChatAllowedImageMimeTypes()`.
- Validar tamaño contra `getChatImageMaxSizeBytes()`.
- Key: `chat/[orderId]/[nanoid].[ext]`.
- En local, guardar en `<LOCAL_STORAGE_PATH>/chat/`; crear subdirectorios anidados.
- No reutilizar `src/lib/storage.ts` directamente.

Nuevo `src/app/api/chat/attachment/[key]/route.ts`:

- Decodificar `key`.
- Si `STORAGE_PROVIDER` no es `local`, redirigir a la URL pública del proveedor.
- Si es `local`, leer de `<LOCAL_STORAGE_PATH>/chat/[key]` y servir con `Content-Type` correcto.
- Nunca exponer paths físicos en la URL ni en la respuesta.

### 2.5 Endpoints de upload

- `src/app/api/public/pedido/[id]/chat/upload/route.ts`
- `src/app/api/pedidos/[id]/chat/upload/route.ts`

Cada uno:

- Valida token/sesión y que el pedido esté `pending`.
- Lee el archivo de `FormData`.
- Valida MIME y tamaño.
- Sube a `chat-storage`.
- Inserta un mensaje con los campos de adjunto (y `content` opcional si se envía).
- Devuelve el mensaje creado.

### 2.6 Servicio extendido

- `chatService.sendClientMessage` / `sendOperatorMessage` aceptan `attachment?`.
- Validar que haya `content` o `attachment`.
- Mantener el `FOR UPDATE` y la validación de `pending`.

### 2.7 UI

- `OrderChat`:
  - Agregar input `type="file"` con `accept={getChatAllowedImageMimeTypes().join(',')}`.
  - Preview del archivo seleccionado.
  - Subida a `.../chat/upload` usando `FormData`.
  - Renderizar imágenes en el chat con `<img>` y enlace de descarga.
  - Permitir texto + imagen en el mismo mensaje.
  - En móvil, intentar abrir la cámara con el atributo `capture`.

### 2.8 Tests y limpieza de adjuntos huérfanos

- Tests unitarios y de integración para `chat-storage.ts` y endpoints de upload.
- E2E para adjuntar una imagen desde cliente y operador.
- Opcional: `src/app/api/cron/chat-attachments-cleanup/route.ts`:
  - Recorre archivos del storage bajo `chat/`.
  - Borra los que no tengan un `attachmentUrl` asociado en `order_messages`.
  - Proteger con `CRON_SECRET`.

### 2.9 Verificación Fase 2

```bash
npx drizzle-kit generate
npx drizzle-kit push
npx tsc --noEmit
npm run lint
npm test
npm run build
npm run test:e2e
```

---

## Checklist de archivos

### Fase 1

- [ ] `src/db/schema.ts`
- [ ] `src/domain/types.ts`
- [ ] `src/config/chat.ts`
- [ ] `.env.example`
- [ ] `AGENTS.md`
- [ ] `src/lib/zod-schemas.ts`
- [ ] `src/repositories/orderMessageRepository.ts` (nuevo)
- [ ] `src/repositories/orderRepository.ts`
- [ ] `src/lib/rate-limit.ts` (nuevo)
- [ ] `src/app/api/public/pedido/route.ts` (refactor)
- [ ] `src/application/services/chatService.ts` (nuevo)
- [ ] `src/app/api/public/pedido/[id]/chat/route.ts`
- [ ] `src/app/api/public/pedido/[id]/chat/leido/route.ts`
- [ ] `src/app/api/pedidos/[id]/chat/route.ts`
- [ ] `src/app/api/pedidos/[id]/chat/leido/route.ts`
- [ ] `src/config/api.ts`
- [ ] `src/components/chat/order-chat.tsx` (nuevo)
- [ ] `src/app/(public)/pedido/[id]/chat/page.tsx` (nuevo)
- [ ] `src/components/pedido/pedido-client.tsx`
- [ ] `src/components/pedidos/pedido-detail.tsx`
- [ ] `src/components/pedidos/pedidos-list.tsx`
- [ ] `src/app/api/pedidos/route.ts` (unreadCount)
- [ ] `src/application/services/orderService.ts` (lock opcional pero recomendado)
- [ ] `src/repositories/orderRepository.ts` (métodos `FOR UPDATE`)
- [ ] Tests (`chatService.test.ts`, `orderMessageRepository.test.ts`, route tests, E2E)
- [ ] `tests/e2e/global-setup.ts`

### Fase 2

- [ ] `src/db/schema.ts`
- [ ] `src/domain/types.ts`
- [ ] `src/config/chat.ts`
- [ ] `.env.example`
- [ ] `src/lib/zod-schemas.ts`
- [ ] `src/lib/chat-storage.ts` (nuevo)
- [ ] `src/app/api/chat/attachment/[key]/route.ts`
- [ ] `src/app/api/public/pedido/[id]/chat/upload/route.ts`
- [ ] `src/app/api/pedidos/[id]/chat/upload/route.ts`
- [ ] `src/application/services/chatService.ts`
- [ ] `src/components/chat/order-chat.tsx`
- [ ] Tests de upload, storage y E2E con adjuntos
- [ ] Limpieza de adjuntos huérfanos (opcional)
