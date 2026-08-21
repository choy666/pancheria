# Prompt: Implementar chat mínimo por pedido (Opción A) — texto + imágenes en dos etapas

## Contexto

Proyecto: `pancheria` — Sistema multi-sucursal de gestión de stock, ventas, caja, cierre diario y pedidos públicos.

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM con PostgreSQL (Neon), NextAuth v5.

Este prompt describe la implementación completa de un **chat anclado a cada pedido**, para que el cliente no tenga que salir de la app y el operador pueda entablar conversación textual y, en una segunda etapa, recibir capturas de comprobantes de transferencia. Se prioriza la eficacia y la optimización: la solución mínima viable, reutilizando lo que ya existe y evitando complejidad innecesaria (sin WebSockets, sin colas, sin estados de chat sofisticados).

## Documentación de referencia obligatoria

Antes de tocar cualquier archivo, leer:

- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/cobertura-auditoria-flujo-pedidos.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/recomendaciones-pedidos-sucursal-stock.md" />

## Estado actual relevante

El flujo vigente de pedidos públicos funciona así (<ref_file file="C:/developer/paginas/pancheria/.devin/prompts/cobertura-auditoria-flujo-pedidos.md" />):

1. El cliente arma el pedido en <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.tsx" /> y lo envía a `POST /api/public/pedido` (<ref_file file="C:/developer/paginas/pancheria/src/app/api/public/pedido/route.ts" />).
2. `orderService.createOrder` (<ref_snippet file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" lines="58-118" />) crea el pedido en estado `pending`, genera un `cancellationToken` y **no reserva ni descuenta stock**.
3. El cliente recibe un diálogo con un enlace a WhatsApp para enviar el pedido manualmente.
4. El operador lo ve en `/pedidos/[id]` (<ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/pedido-detail.tsx" />), donde puede confirmar o cancelar.
5. La confirmación convierte el pedido en venta mediante `convertOrderToSale` (<ref_snippet file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" lines="155-241" />) y recién ahí descuenta stock.

El objetivo es reemplazar (o complementar) el paso 3 con un chat dentro de la app. El chat debe ser simple, eficiente y fácil de operar.

## Objetivo

Implementar un **chat mínimo por pedido** con dos etapas:

1. **Fase 1 (esta tarea):** chat de texto cliente ↔ operador, con autenticación por token del cliente y sesión del operador, polling de actualización, rate limiting y persistencia en PostgreSQL.
2. **Fase 2 (tarea siguiente):** permitir adjuntar imágenes (capturas de comprobantes de transferencia), reutilizando el storage multi-proveedor que ya existe para videos.

Al finalizar, el flujo esperado es:

- Cliente crea pedido → se abre el chat propio en lugar de WhatsApp.
- Cliente puede escribir (y en Fase 2 adjuntar imagen) mientras el pedido esté `pending`.
- Operador ve el chat en el detalle del pedido, responde y, cuando corresponda, confirma el pedido como venta.
- Si el pedido se confirma o cancela, el chat queda como historial de solo lectura.

## Reglas de negocio

1. **Un chat por pedido.** Cada fila de `orders` tiene asociadas muchas filas de `order_messages`.
2. **El chat es bidireccional pero limitado:** `client` y `operator`. No hay múltiples operadores en el mismo chat por ahora (se puede extender más adelante).
3. **El cliente no necesita login.** Se autentica con `cancellationToken` del pedido (o un `chatToken` derivado; ver decisiones de diseño).
4. **El operador sí necesita sesión.** Debe pertenecer a la misma sucursal del pedido (`branchId`).
5. **Solo se puede escribir mientras el pedido esté `pending`.** Una vez `converted` o `cancelled`, el chat se congela (solo lectura).
6. **No reservar ni descontar stock.** El chat no cambia el flujo vigente: `createOrder` y `convertOrderToSale` siguen sin tocar stock hasta la confirmación.
7. **Soft delete / retención.** Los mensajes no se borran cuando se cancela o confirma un pedido; se conservan para auditoría.
8. **Rate limiting.** El endpoint público de chat debe tener rate limit por IP para evitar spam.
9. **Polling, no WebSockets.** En el entorno serverless de Vercel, el polling por intervalo configurable es la forma más simple y robusta de "tiempo real".
10. **Mensajes cortos.** El contenido de texto tiene un límite máximo configurable (por defecto 1000 caracteres) y no admite HTML.
11. **Sin reservas de adjuntos en Fase 1.** Fase 1 es solo texto; Fase 2 agrega imágenes.

## Decisiones de diseño clave

### Autenticación del cliente: `cancellationToken` vs `chatToken` separado

**Opción recomendada: reutilizar `cancellationToken` como token de acceso al chat.**

Razones:

- Simplifica el esquema: no hace falta agregar un campo nuevo en `orders`.
- El cliente ya recibe ese token en la URL `/pedido/[id]/chat?token=...` o en el diálogo de éxito.
- Si un tercero obtiene el enlace, solo puede leer/escribir en ese chat y cancelar el pedido. El riesgo es aceptable para un pedido de comida.

**Si se prefiere separar permisos**, agregar un `chatToken` generado junto con `cancellationToken` en <ref_file file="C:/developer/paginas/pancheria/src/lib/order-helpers.ts" />. En ese caso:

- `cancellationToken` sirve solo para cancelar.
- `chatToken` sirve solo para el chat.
- El cliente recibe ambos en la respuesta de creación del pedido.

Para Fase 1, **sigue la opción recomendada** (reutilizar `cancellationToken`) y documenta la separación como posible mejora futura.

### Ubicación del chat del cliente

**Opción recomendada: nueva ruta `/pedido/[id]/chat?token=...`.**

Razones:

- Evita anidar todo dentro del diálogo de éxito del catálogo, que ya es complejo (<ref_snippet file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.tsx" lines="598-731" />).
- Permite que el cliente recargue la página o vuelva más tarde con el mismo enlace.
- Facilita compartir el enlace por WhatsApp/SMS como fallback: "Seguí tu pedido aquí: ...".

### Ubicación del chat del operador

**Integrar el componente de chat dentro de `/pedidos/[id]`**, debajo del detalle o en una pestaña, dentro de <ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/pedido-detail.tsx" />. No crear una ruta nueva en el panel para mantener la operación simple.

### Realtime: polling

- Intervalo configurable mediante `NEXT_PUBLIC_CHAT_REFRESH_INTERVAL_MS` (por defecto 5000 ms).
- Usar el mismo patrón de `isMountedRef` y cleanup que el resto del proyecto (<ref_snippet file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.tsx" lines="140-157" />).
- El `GET` de mensajes debe devolverlos ordenados por `createdAt ASC` para que el cliente los pinte de arriba hacia abajo.

### Rate limiting

Reutilizar el mecanismo de `public_order_rate_limits` y la fábrica `createPublicOrderRateLimitStore` en <ref_file file="C:/developer/paginas/pancheria/src/lib/public-order-rate-limit-store.ts" />. Crear una instancia separada para chat o extender la configuración existente (`PUBLIC_ORDER_RATE_LIMIT_*`).

## Fase 1: Chat de texto

### 1.1 Base de datos

En <ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" />:

1. Agregar enum:

```ts
export const orderMessageSenderEnum = pgEnum('order_message_sender', [
  'client',
  'operator',
]);
```

2. Agregar tabla:

```ts
export const orderMessages = pgTable(
  'order_messages',
  {
    id: serial('id').primaryKey(),
    orderId: integer('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    senderType: orderMessageSenderEnum('sender_type').notNull(),
    senderName: varchar('sender_name', { length: 255 }),
    content: text('content').notNull(),
    readAt: timestamp('read_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    orderIdIdx: index('order_messages_order_id_idx').on(table.orderId),
    orderCreatedAtIdx: index('order_messages_order_created_at_idx').on(
      table.orderId,
      table.createdAt
    ),
    orderSenderReadAtIdx: index('order_messages_order_sender_read_at_idx').on(
      table.orderId,
      table.senderType,
      table.readAt
    ),
  })
);
```

3. Agregar relaciones en `ordersRelations`:

```ts
messages: many(orderMessages),
```

4. Agregar relaciones inversas para `orderMessages`:

```ts
export const orderMessagesRelations = relations(orderMessages, ({ one }) => ({
  order: one(orders, {
    fields: [orderMessages.orderId],
    references: [orders.id],
  }),
}));
```

5. Generar y aplicar migración:

```bash
npx drizzle-kit generate
npx drizzle-kit push
```

### 1.2 Tipos de dominio

En <ref_file file="C:/developer/paginas/pancheria/src/domain/types.ts" />:

```ts
export type OrderMessageSenderType = 'client' | 'operator';

export type OrderMessage = {
  id: number;
  orderId: number;
  senderType: OrderMessageSenderType;
  senderName: string | null;
  content: string;
  readAt: Date | null;
  createdAt: Date;
};
```

### 1.3 Configuración

Crear <ref_file file="C:/developer/paginas/pancheria/src/config/chat.ts" />:

```ts
export function getChatRefreshIntervalMs(): number {
  const raw = process.env.NEXT_PUBLIC_CHAT_REFRESH_INTERVAL_MS;
  if (!raw) return 5000;
  const parsed = Number(raw);
  return Number.isNaN(parsed) || parsed < 1000 ? 5000 : parsed;
}

export function getChatMaxTextLength(): number {
  const raw = process.env.NEXT_PUBLIC_CHAT_MAX_TEXT_LENGTH;
  if (!raw) return 1000;
  const parsed = Number(raw);
  return Number.isNaN(parsed) || parsed < 1 ? 1000 : parsed;
}

export function getChatRateLimitWindowMs(): number {
  const raw = process.env.PUBLIC_CHAT_RATE_LIMIT_WINDOW_MS;
  if (!raw) return 60000;
  const parsed = Number(raw);
  return Number.isNaN(parsed) || parsed < 1000 ? 60000 : parsed;
}

export function getChatRateLimitMaxRequests(): number {
  const raw = process.env.PUBLIC_CHAT_RATE_LIMIT_MAX_REQUESTS;
  if (!raw) return 60;
  const parsed = Number(raw);
  return Number.isNaN(parsed) || parsed < 1 ? 60 : parsed;
}
```

Agregar en `.env.example`:

```bash
# Chat
NEXT_PUBLIC_CHAT_REFRESH_INTERVAL_MS=5000
NEXT_PUBLIC_CHAT_MAX_TEXT_LENGTH=1000
PUBLIC_CHAT_RATE_LIMIT_WINDOW_MS=60000
PUBLIC_CHAT_RATE_LIMIT_MAX_REQUESTS=60
```

### 1.4 Esquemas de Zod

En <ref_file file="C:/developer/paginas/pancheria/src/lib/zod-schemas.ts" />, agregar:

```ts
export const orderMessageSchema = z.object({
  content: z.string().min(1),
});
```

### 1.5 Repositorio

Crear <ref_file file="C:/developer/paginas/pancheria/src/repositories/orderMessageRepository.ts" />:

```ts
import { eq, and, desc, asc, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { orderMessages } from '@/db/schema';
import { nowUTC } from '@/lib/date';
import type { OrderMessage } from '@/domain/types';

export async function findByOrderId(
  orderId: number,
  options: { limit?: number; offset?: number } = {}
): Promise<OrderMessage[]> {
  const limit = options.limit ?? 100;
  const offset = options.offset ?? 0;

  return (await db.query.orderMessages.findMany({
    where: eq(orderMessages.orderId, orderId),
    orderBy: (orderMessages, { asc }) => [asc(orderMessages.createdAt)],
    limit,
    offset,
  })) as OrderMessage[];
}

export async function insertMessage(
  tx: typeof db,
  values: typeof orderMessages.$inferInsert
): Promise<typeof orderMessages.$inferSelect> {
  const [message] = await tx.insert(orderMessages).values(values).returning();
  if (!message) throw new Error('No se pudo insertar el mensaje.');
  return message;
}

export async function markAllAsReadByOrderAndSender(
  orderId: number,
  senderType: 'client' | 'operator'
): Promise<number> {
  const result = await db
    .update(orderMessages)
    .set({ readAt: nowUTC() })
    .where(
      and(
        eq(orderMessages.orderId, orderId),
        eq(orderMessages.senderType, senderType),
        isNull(orderMessages.readAt)
      )
    );

  return result.rowCount ?? 0;
}
```

### 1.6 Servicio de aplicación

Crear <ref_file file="C:/developer/paginas/pancheria/src/application/services/chatService.ts" />:

```ts
import * as orderRepository from '@/repositories/orderRepository';
import * as orderMessageRepository from '@/repositories/orderMessageRepository';
import { executeInTransaction } from '@/application/transactionService';
import { ValidationError, NotFoundError, ForbiddenError } from '@/domain/errors';
import { getChatMaxTextLength } from '@/config/chat';
import { nowUTC } from '@/lib/date';
import type { OrderMessage, OrderWithItems } from '@/domain/types';

export interface SendClientMessageInput {
  orderId: number;
  token: string;
  senderName: string;
  content: string;
}

export interface SendOperatorMessageInput {
  orderId: number;
  branchId: number;
  senderName: string;
  content: string;
}

async function validateOrderForChat(
  orderId: number,
  auth: { token: string } | { branchId: number }
): Promise<OrderWithItems> {
  const order =
    'branchId' in auth
      ? await orderRepository.findById(auth.branchId, orderId)
      : await orderRepository.findByIdWithToken(orderId, auth.token);

  if (!order) throw new NotFoundError('Pedido', orderId);

  if ('branchId' in auth && order.branchId !== auth.branchId) {
    throw new ForbiddenError('El pedido no pertenece a tu sucursal.');
  }

  return order;
}

async function validateCanSend(order: OrderWithItems): Promise<void> {
  if (order.status !== 'pending') {
    throw new ValidationError('El pedido no admite nuevos mensajes.');
  }
}

async function validateContent(content: string): Promise<string> {
  const maxLength = getChatMaxTextLength();
  const trimmed = content.trim();
  if (!trimmed || trimmed.length > maxLength) {
    throw new ValidationError(
      `El mensaje debe tener entre 1 y ${maxLength} caracteres.`
    );
  }
  return trimmed;
}

export async function listClientMessages(
  orderId: number,
  token: string
): Promise<OrderMessage[]> {
  const order = await validateOrderForChat(orderId, { token });
  return orderMessageRepository.findByOrderId(orderId);
}

export async function listOperatorMessages(
  orderId: number,
  branchId: number
): Promise<OrderMessage[]> {
  const order = await validateOrderForChat(orderId, { branchId });
  return orderMessageRepository.findByOrderId(orderId);
}

export async function getChatContext(
  orderId: number,
  token: string
): Promise<{
  orderNumber: string;
  branchName: string;
  status: OrderWithItems['status'];
  messages: OrderMessage[];
}> {
  const order = await validateOrderForChat(orderId, { token });
  const messages = await orderMessageRepository.findByOrderId(orderId);

  return {
    orderNumber: order.orderNumber,
    branchName: order.branch?.name ?? '',
    status: order.status,
    messages,
  };
}

export async function sendClientMessage(
  input: SendClientMessageInput
): Promise<OrderMessage> {
  const { orderId, token, senderName, content } = input;
  const order = await validateOrderForChat(orderId, { token });
  await validateCanSend(order);
  const trimmed = await validateContent(content);

  return executeInTransaction(async (tx) => {
    const message = await orderMessageRepository.insertMessage(tx, {
      orderId,
      senderType: 'client',
      senderName: senderName.trim() || null,
      content: trimmed,
      createdAt: nowUTC(),
    });

    return message as OrderMessage;
  });
}

export async function sendOperatorMessage(
  input: SendOperatorMessageInput
): Promise<OrderMessage> {
  const { orderId, branchId, senderName, content } = input;
  const order = await validateOrderForChat(orderId, { branchId });
  await validateCanSend(order);
  const trimmed = await validateContent(content);

  return executeInTransaction(async (tx) => {
    const message = await orderMessageRepository.insertMessage(tx, {
      orderId,
      senderType: 'operator',
      senderName: senderName.trim() || null,
      content: trimmed,
      createdAt: nowUTC(),
    });

    return message as OrderMessage;
  });
}

export async function markClientMessagesAsRead(
  orderId: number,
  token: string
): Promise<number> {
  await validateOrderForChat(orderId, { token });
  return orderMessageRepository.markAllAsReadByOrderAndSender(
    orderId,
    'operator'
  );
}

export async function markOperatorMessagesAsRead(
  orderId: number,
  branchId: number
): Promise<number> {
  await validateOrderForChat(orderId, { branchId });
  return orderMessageRepository.markAllAsReadByOrderAndSender(
    orderId,
    'client'
  );
}
```

**Ajuste al repositorio:** `orderRepository.findByIdForCancel` y `orderRepository.findById` requieren `branchId`. Para la validación por token desde el chat público, agregar en <ref_file file="C:/developer/paginas/pancheria/src/repositories/orderRepository.ts" /> (asegurarse de importar `isNull` desde `drizzle-orm`):

```ts
export async function findByIdWithToken(
  orderId: number,
  token: string
): Promise<OrderWithItems | undefined> {
  return (await db.query.orders.findFirst({
    where: and(
      eq(orders.id, orderId),
      eq(orders.cancellationToken, token),
      isNull(orders.deletedAt)
    ),
    with: { branch: true, items: { with: { product: true } } },
  })) as OrderWithItems | undefined;
}
```

Y modificar `validateOrderForChat` para usar `findByIdWithToken` cuando el auth es `token`.

**Notas de eficiencia:**

- `findByIdForCancel` / `findByIdWithToken` traen el pedido con `items` y `branch`, lo cual basta para validar token, sucursal y estado. No hace falta cargar todos los mensajes con `with`.
- El `content` se sanitiza en el servidor (trim + longitud). El cliente escapa HTML al renderizar; no se almacena HTML.
- `markAllAsReadByOrderAndSender` opera sobre `order_messages` filtrando por `orderId` y `senderType`; el acceso ya fue autorizado previamente por `validateOrderForChat`.
- **Condición de carrera:** `sendClientMessage`/`sendOperatorMessage` validan el estado `pending` antes de abrir la transacción. Para pedidos de chat esto es aceptable en Fase 1, pero si se requiere mayor rigor, ejecutar la validación dentro de la transacción y, idealmente, usar `SELECT ... FOR UPDATE` sobre el pedido para evitar que se confirme/cancele entre la lectura y el `INSERT`.

### 1.7 Endpoints API

#### 1.7.1 Público: `/api/public/pedido/[id]/chat`

Crear `src/app/api/public/pedido/[id]/chat/route.ts`, reutilizando el helper de rate limit de la sección 1.8:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import * as chatService from '@/application/services/chatService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { orderMessageSchema } from '@/lib/zod-schemas';
import { createRateLimiter, getClientIp } from '@/lib/rate-limit';
import {
  getChatRateLimitWindowMs,
  getChatRateLimitMaxRequests,
} from '@/config/chat';

const querySchema = z.object({
  token: z.string().min(1),
});

const isRateLimited = createRateLimiter(
  getChatRateLimitWindowMs(),
  getChatRateLimitMaxRequests()
);

export const GET = withApiErrorHandling(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const { token } = querySchema.parse(Object.fromEntries(searchParams));
    const orderId = Number(id);

    if (Number.isNaN(orderId) || orderId <= 0) {
      return NextResponse.json(
        { error: 'ID de pedido inválido.' },
        { status: 400 }
      );
    }

    const ip = getClientIp(request);
    if (await isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes. Intentalo más tarde.' },
        { status: 429 }
      );
    }

    const messages = await chatService.listClientMessages(orderId, token);
    return NextResponse.json({ messages });
  }
);

export const POST = withApiErrorHandling(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const { token } = querySchema.parse(Object.fromEntries(searchParams));
    const orderId = Number(id);

    if (Number.isNaN(orderId) || orderId <= 0) {
      return NextResponse.json(
        { error: 'ID de pedido inválido.' },
        { status: 400 }
      );
    }

    const ip = getClientIp(request);
    if (await isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes. Intentalo más tarde.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { content } = orderMessageSchema.parse(body);

    const message = await chatService.sendClientMessage({
      orderId,
      token,
      senderName: 'Cliente',
      content,
    });

    return NextResponse.json({ message }, { status: 201 });
  }
);

export const runtime = 'nodejs';
```

#### 1.7.2 Panel: `/api/pedidos/[id]/chat`

Crear `src/app/api/pedidos/[id]/chat/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import * as chatService from '@/application/services/chatService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { requireAuth, getCurrentBranchId } from '@/lib/auth';
import { orderMessageSchema } from '@/lib/zod-schemas';

export const GET = withApiErrorHandling(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireAuth();
    const branchId = await getCurrentBranchId(session);
    const { id } = await params;
    const orderId = Number(id);

    if (Number.isNaN(orderId) || orderId <= 0) {
      return NextResponse.json(
        { error: 'ID de pedido inválido.' },
        { status: 400 }
      );
    }

    const messages = await chatService.listOperatorMessages(orderId, branchId);
    return NextResponse.json({ messages });
  }
);

export const POST = withApiErrorHandling(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireAuth();
    const branchId = await getCurrentBranchId(session);
    const { id } = await params;
    const orderId = Number(id);

    if (Number.isNaN(orderId) || orderId <= 0) {
      return NextResponse.json(
        { error: 'ID de pedido inválido.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { content } = orderMessageSchema.parse(body);

    const message = await chatService.sendOperatorMessage({
      orderId,
      branchId,
      senderName: session.user.name ?? 'Operador',
      content,
    });

    return NextResponse.json({ message }, { status: 201 });
  }
);

export const runtime = 'nodejs';
```

**Nota de eficiencia:** los endpoints no hacen `JOIN` innecesarios. `listMessages` filtra por `orderId` indexado y devuelve solo las columnas de `order_messages`.

### 1.8 Helper de rate limiting compartido

Extraer la lógica de rate limit de <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/pedido/route.ts" /> a un helper reutilizable, por ejemplo `src/lib/rate-limit.ts`:

```ts
import { NextRequest } from 'next/server';
import {
  createPublicOrderRateLimitStore,
  type PublicOrderRateLimitStore,
} from '@/lib/public-order-rate-limit-store';

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return (request as unknown as { ip?: string }).ip ?? 'unknown';
}

export function createRateLimiter(windowMs: number, maxRequests: number) {
  const store: PublicOrderRateLimitStore = createPublicOrderRateLimitStore();

  return async function isRateLimited(ip: string): Promise<boolean> {
    if (process.env.NODE_ENV === 'test') return false;

    const now = Date.now();
    const record = await store.get(ip);

    if (!record || now > record.resetAt) {
      await store.set(ip, { count: 1, resetAt: now + windowMs });
      return false;
    }

    record.count += 1;
    if (record.count > maxRequests) {
      return true;
    }

    await store.set(ip, record);
    return false;
  };
}
```

Esto permite que `/api/public/pedido` y `/api/public/pedido/[id]/chat` compartan la misma abstracción. Aprovechar para refactorizar `src/app/api/public/pedido/route.ts` y que también use `createRateLimiter`.

### 1.9 Componente de chat

Crear `src/components/chat/order-chat.tsx` (client component):

**Props:**

```ts
interface OrderChatProps {
  orderId: number;
  token?: string; // si está presente, es vista del cliente
  initialMessages?: OrderMessage[];
  readOnly?: boolean;
}
```

**Comportamiento:**

1. Recibe `initialMessages` en Server Component y las pinta.
2. Mantiene un `useState` de mensajes.
3. Cada `getChatRefreshIntervalMs()` hace `GET` al endpoint correspondiente:
   - Cliente: `/api/public/pedido/${orderId}/chat?token=${token}`
   - Operador: `/api/pedidos/${orderId}/chat`
4. Al enviar, hace `POST` con el contenido y, al recibir la respuesta, agrega el mensaje localmente (optimistic update) y dispara una recarga inmediata.
5. Al montar, marca como leídos los mensajes del remitente opuesto con `POST /api/pedidos/[id]/chat/leido` o similar (opcional para Fase 1).
6. Usa `isMountedRef` para evitar setState tras desmonte.
7. No lee `localStorage` durante el render para evitar hydration mismatch.

**UI:**

- Contenedor con altura fija (ej. `h-96`) y scroll.
- Burbujas de mensaje: `client` a la derecha, `operator` a la izquierda.
- Input de texto con `maxLength={getChatMaxTextLength()}`.
- Botón de enviar.
- Indicador de "Escribiendo..." no es necesario en Fase 1.
- Si `readOnly`, deshabilitar input y mostrar aviso.

**Ejemplo de estructura del componente (simplificada):**

```tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { getChatRefreshIntervalMs, getChatMaxTextLength } from '@/config/chat';
import { authenticatedFetch } from '@/lib/fetch';
import { formatTime } from '@/lib/date';
import type { OrderMessage } from '@/domain/types';

interface OrderChatProps {
  orderId: number;
  token?: string;
  initialMessages?: OrderMessage[];
  readOnly?: boolean;
}

export function OrderChat({ orderId, token, initialMessages = [], readOnly = false }: OrderChatProps) {
  const isMountedRef = useRef(true);
  const [messages, setMessages] = useState<OrderMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const apiUrl = token
    ? `/api/public/pedido/${orderId}/chat?token=${encodeURIComponent(token)}`
    : `/api/pedidos/${orderId}/chat`;

  const loadMessages = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await (token ? fetch(apiUrl) : authenticatedFetch(apiUrl));
      if (!response.ok) throw new Error('Error al cargar mensajes');
      const data = (await response.json()) as { messages: OrderMessage[] };
      if (!isMountedRef.current) return;
      setMessages(data.messages);
    } catch (err) {
      if (!isMountedRef.current) return;
      // Opcional: setError
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [apiUrl, token]);

  useEffect(() => {
    isMountedRef.current = true;

    if (initialMessages.length === 0) {
      void loadMessages();
    }

    let interval: ReturnType<typeof setInterval> | null = null;
    if (!readOnly) {
      interval = setInterval(loadMessages, getChatRefreshIntervalMs());
    }

    return () => {
      isMountedRef.current = false;
      if (interval) clearInterval(interval);
    };
  }, [loadMessages, readOnly, initialMessages.length]);

  async function handleSend() {
    if (!input.trim() || readOnly) return;
    setIsSending(true);
    try {
      const response = await (token
        ? fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: input.trim() }),
          })
        : authenticatedFetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: input.trim() }),
          }));

      if (!response.ok) throw new Error('Error al enviar mensaje');

      setInput('');
      await loadMessages();
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="h-96 overflow-y-auto rounded-2xl border border-white/8 p-4 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${
              msg.senderType === 'client' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                msg.senderType === 'client'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <p>{msg.content}</p>
              <span className="text-xs opacity-70">{formatTime(msg.createdAt)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={getChatMaxTextLength()}
          disabled={readOnly || isSending}
          placeholder="Escribí un mensaje..."
          rows={2}
        />
        <Button onClick={handleSend} disabled={readOnly || isSending || !input.trim()}>
          Enviar
        </Button>
      </div>
    </div>
  );
}
```

**Notas:**

- `formatTime` debe existir o crearse en `src/lib/date.ts`.
- El `Textarea` puede crecer; considerar `autoResize` opcional.
- En móvil, el teclado no debe romper el layout. Usar `flex-col` y altura fija.

### 1.10 Pantalla pública del chat

Crear `src/app/(public)/pedido/[id]/chat/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import * as chatService from '@/application/services/chatService';
import { OrderChat } from '@/components/chat/order-chat';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function PedidoChatPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { token } = await searchParams;
  const orderId = Number(id);

  if (Number.isNaN(orderId) || orderId <= 0 || !token) {
    notFound();
  }

  try {
    const { orderNumber, branchName, status, messages } =
      await chatService.getChatContext(orderId, token);

    const readOnly = status !== 'pending';

    return (
      <div className="container mx-auto max-w-2xl p-4">
        <h1 className="text-xl font-semibold">Pedido #{orderNumber}</h1>
        <p className="text-sm text-muted-foreground">Sucursal: {branchName}</p>
        <OrderChat
          orderId={orderId}
          token={token}
          initialMessages={messages}
          readOnly={readOnly}
        />
      </div>
    );
  } catch {
    notFound();
  }
}
```

### 1.11 Integración en el detalle del pedido (panel)

En <ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/pedido-detail.tsx" />, agregar una sección de chat debajo de "Acciones" o en una tercera columna. Importar `OrderChat`:

```tsx
import { OrderChat } from '@/components/chat/order-chat';
```

Y en el render:

```tsx
<div className="space-y-5">
  {/* ... Acciones actuales ... */}

  <Card>
    <CardHeader>
      <CardTitle className="text-lg">Conversación con el cliente</CardTitle>
    </CardHeader>
    <CardContent>
      <OrderChat
        orderId={order.id}
        readOnly={order.status !== 'pending'}
      />
    </CardContent>
  </Card>
</div>
```

### 1.12 Redirección al chat tras crear el pedido

En <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.tsx" />, modificar `handleSubmitCheckout` para que, tras crear el pedido, redirija a `/pedido/${order.id}/chat?token=${order.cancellationToken}` en lugar de mostrar el diálogo de WhatsApp (o mantener el diálogo con un botón "Ir al chat" y otro "Abrir WhatsApp").

**Opción recomendada:** reemplazar el botón de WhatsApp por "Ir al chat del pedido". El diálogo de éxito puede seguir mostrando el resumen, pero el CTA principal es ir al chat. Ejemplo:

```tsx
<Button
  onClick={() =>
    router.push(`/pedido/${createdOrder.id}/chat?token=${encodeURIComponent(createdOrder.cancellationToken)}`)
  }
>
  Ir al chat del pedido
</Button>
```

Mantener el enlace de WhatsApp como fallback secundario si el operador prefiere.

### 1.13 Tests

#### Tests unitarios

Crear `src/application/services/chatService.test.ts`:

- Enviar mensaje con token válido.
- Rechazar mensaje con token inválido.
- Rechazar mensaje en pedido `converted`.
- Listar mensajes ordenados por fecha.
- Validar longitud máxima.

Crear tests para los endpoints:

- `src/app/api/public/pedido/[id]/chat/route.test.ts`
- `src/app/api/pedidos/[id]/chat/route.test.ts`

#### Tests E2E

Crear o extender `tests/e2e/pedido-chat.spec.ts`:

- Cliente crea pedido y accede al chat.
- Cliente envía mensaje.
- Operador inicia sesión y responde desde `/pedidos/[id]`.
- Verificar que los mensajes aparecen de ambos lados.
- Verificar que no se puede enviar mensaje si el pedido está confirmado.

## Fase 2: Adjuntos de imagen

### 2.1 Extensión del esquema

En <ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" />, modificar `orderMessages` para soportar adjuntos:

```ts
export const orderMessages = pgTable(
  'order_messages',
  {
    id: serial('id').primaryKey(),
    orderId: integer('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    senderType: orderMessageSenderEnum('sender_type').notNull(),
    senderName: varchar('sender_name', { length: 255 }),
    content: text('content'), // ahora nullable porque puede ser solo imagen
    attachmentUrl: text('attachment_url'),
    attachmentMimeType: varchar('attachment_mime_type', { length: 100 }),
    attachmentSize: integer('attachment_size'),
    attachmentName: varchar('attachment_name', { length: 255 }),
    readAt: timestamp('read_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    orderIdIdx: index('order_messages_order_id_idx').on(table.orderId),
    orderCreatedAtIdx: index('order_messages_order_created_at_idx').on(
      table.orderId,
      table.createdAt
    ),
    orderSenderReadAtIdx: index('order_messages_order_sender_read_at_idx').on(
      table.orderId,
      table.senderType,
      table.readAt
    ),
  })
);
```

Agregar una constraint o validación en el servicio: un mensaje debe tener `content` o `attachmentUrl`, no puede estar vacío.

Actualizar `src/domain/types.ts` para reflejar los campos nuevos:

```ts
export type OrderMessage = {
  id: number;
  orderId: number;
  senderType: OrderMessageSenderType;
  senderName: string | null;
  content: string | null;
  attachmentUrl: string | null;
  attachmentMimeType: string | null;
  attachmentSize: number | null;
  attachmentName: string | null;
  readAt: Date | null;
  createdAt: Date;
};
```

### 2.2 Configuración de imágenes

Extender `src/config/chat.ts`:

```ts
export function getChatImageMaxSizeMb(): number {
  const raw = process.env.NEXT_PUBLIC_CHAT_IMAGE_MAX_SIZE_MB;
  if (!raw) return 5;
  const parsed = Number(raw);
  return Number.isNaN(parsed) || parsed <= 0 ? 5 : parsed;
}

export function getChatImageMaxSizeBytes(): number {
  return getChatImageMaxSizeMb() * 1024 * 1024;
}

export function getChatAllowedImageMimeTypes(): string[] {
  const raw = process.env.NEXT_PUBLIC_CHAT_ALLOWED_IMAGE_MIME_TYPES;
  if (!raw) return ['image/jpeg', 'image/png', 'image/webp'];
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}
```

Variables de entorno sugeridas:

```bash
NEXT_PUBLIC_CHAT_IMAGE_MAX_SIZE_MB=5
NEXT_PUBLIC_CHAT_ALLOWED_IMAGE_MIME_TYPES=image/jpeg,image/png,image/webp
# Los adjuntos del chat usan el mismo proveedor y ruta base que los videos:
# STORAGE_PROVIDER y LOCAL_STORAGE_PATH. En producción no usar local;
# preferir vercel-blob, s3 o r2.
```

### 2.3 Storage de imágenes

**No reutilizar `src/lib/storage.ts` directamente**: está diseñado para videos (prefijo `videos/`, endpoints `/api/videos/upload` y `/api/videos/[id]/stream`, `guessMimeType` con extensiones de video). Para imágenes del chat conviene un proveedor específico.

**Opción recomendada: crear `src/lib/chat-storage.ts`**, con una interfaz similar a `StorageProvider` pero adaptada a imágenes:

- Validar MIME contra `getChatAllowedImageMimeTypes()`.
- Validar tamaño contra `getChatImageMaxSizeBytes()`.
- Key: `chat/[orderId]/[nanoid].[ext]` (el `orderId` facilita organización, pero no se expone en la URL pública).
- En modo `local`, guardar en `process.env.LOCAL_STORAGE_PATH` con subcarpeta `chat/` (por ejemplo, `<LOCAL_STORAGE_PATH>/chat/` o `tmp/chat/` si no está definida).
- URL pública en modo local: `/api/chat/attachment/[key]`, servida por `src/app/api/chat/attachment/[key]/route.ts` (similar a `GET /api/videos/[id]/stream`).
- Para `vercel-blob`, `s3` y `r2` usar la misma lógica de presigned post de `src/lib/storage.ts`, pero con key `chat/...` y URL pública del proveedor.
- Nunca almacenar paths físicos del servidor en `attachmentUrl`; guardar siempre una URL pública.

#### Endpoints de upload

Crear `src/app/api/public/pedido/[id]/chat/upload/route.ts` y `src/app/api/pedidos/[id]/chat/upload/route.ts`:

- Validar token o sesión y que el pedido esté `pending`.
- Validar MIME y tamaño del archivo.
- Recibir el archivo (multipart) y guardarlo con el proveedor de chat. Para cloud, el servidor puede subirlo con las credencias correspondientes (o usar un flujo de presigned post de dos pasos si se prefiere reutilizar la lógica de videos).
- Insertar un mensaje con `attachmentUrl`, `attachmentMimeType`, `attachmentSize`, `attachmentName` (y `content` opcional).
- Devolver el mensaje creado.

### 2.4 UI de adjuntos

Extender `OrderChat`:

- Agregar input `type="file"` con `accept={getChatAllowedImageMimeTypes().join(',')}`.
- Al seleccionar archivo, mostrar preview y subir con `POST /.../chat/upload` usando `FormData`.
- Permitir enviar texto + imagen juntos o separados.
- Renderizar imágenes en el chat con `<img>` y un enlace para descargar original.
- En móvil, usar cámara si el navegador lo permite.

### 2.5 Servicio de chat extendido

Ajustar `chatService.sendClientMessage` y `chatService.sendOperatorMessage` para aceptar un adjunto opcional. Refactorizar la validación de contenido para permitir un mensaje con `content` o `attachment` (o ambos), pero no ambos vacíos:

```ts
export interface AttachmentInput {
  url: string;
  mimeType: string;
  size: number;
  name: string;
}

export interface SendClientMessageInput {
  orderId: number;
  token: string;
  senderName: string;
  content?: string;
  attachment?: AttachmentInput;
}

export interface SendOperatorMessageInput {
  orderId: number;
  branchId: number;
  senderName: string;
  content?: string;
  attachment?: AttachmentInput;
}
```

Validar que al menos `content` o `attachment` esté presente.

Actualizar `src/lib/zod-schemas.ts` con un esquema para Fase 2 (puede convivir con `orderMessageSchema`):

```ts
export const chatAttachmentSchema = z.object({
  url: z.string().min(1).url(),
  mimeType: z.string().min(1).max(100),
  size: z.number().int().nonnegative(),
  name: z.string().min(1).max(255),
});

export const chatMessageSchema = z.object({
  content: z.string().optional(),
  attachment: chatAttachmentSchema.optional(),
}).superRefine((data, ctx) => {
  const hasContent = (data.content?.trim().length ?? 0) > 0;
  const hasAttachment = !!data.attachment;
  if (!hasContent && !hasAttachment) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'El mensaje debe tener texto o un adjunto.',
      path: ['content'],
    });
  }
});
```

## Consideraciones de seguridad

1. **No hardcodear credenciales ni URLs de storage.** Usar variables de entorno como el resto del proyecto.
2. **Sanitizar contenido.** No permitir HTML ni scripts. Escapar al renderizar.
3. **Validar adjuntos.** MIME types permitidos, tamaño máximo, nombres saneados.
4. **No exponer el storage directamente.** Las imágenes en `local` deben servirse por un endpoint propio (igual que `GET /api/videos/[id]/stream` en <ref_file file="C:/developer/paginas/pancheria/src/app/api/videos/[id]/stream/route.ts" />), no por path directo.
5. **No usar `local` en producción para imágenes.** En Vercel el filesystem es efímero. Configurar `STORAGE_PROVIDER=vercel-blob`, `s3` o `r2` para que los adjuntos del chat usen el mismo proveedor duradero.
6. **Proteger endpoints del panel con `requireAuth` y `getCurrentBranchId`.**
7. **Proteger endpoints públicos con `cancellationToken`/`chatToken` y rate limiting.**
8. **No commitear `.env.local`.**
9. **Soft delete:** los mensajes no se borran con el pedido; `onDelete: 'cascade'` en `orderId` está bien porque el pedido ya tiene soft delete (`deletedAt`). Si se hard-deletea un pedido (papelera), los mensajes se borran en cascada.

## Verificaciones

Después de cada fase, ejecutar:

| Comando | Propósito |
| ------- | --------- |
| `npx tsc --noEmit` | Verificación de tipos |
| `npm run lint` | Estilo y reglas |
| `npm test` | Tests unitarios y de integración |
| `npm run build` | Build de producción |
| `npx playwright test tests/e2e/pedido-chat.spec.ts` | Tests E2E enfocados del chat |
| `npm run test:e2e` | Tests E2E completos en base de prueba |

Además, para cambios de esquema:

```bash
npx drizzle-kit generate
npx drizzle-kit push
```

Solo en base de desarrollo/prueba; no contra producción sin backup.

## Archivos a tocar (checklist)

### Fase 1

- [ ] `src/db/schema.ts` — enum y tabla `order_messages`.
- [ ] `src/domain/types.ts` — tipos `OrderMessage` y `OrderMessageSenderType`.
- [ ] `src/config/chat.ts` — nueva configuración.
- [ ] `.env.example` — variables de entorno del chat.
- [ ] `src/lib/zod-schemas.ts` — `orderMessageSchema`.
- [ ] `src/repositories/orderMessageRepository.ts` — acceso a datos.
- [ ] `src/application/services/chatService.ts` — lógica de negocio.
- [ ] `src/lib/rate-limit.ts` — helper compartido de rate limit (opcional, recomendado).
- [ ] `src/app/api/public/pedido/[id]/chat/route.ts` — API pública.
- [ ] `src/app/api/pedidos/[id]/chat/route.ts` — API del panel.
- [ ] `src/components/chat/order-chat.tsx` — componente compartido.
- [ ] `src/app/(public)/pedido/[id]/chat/page.tsx` — pantalla pública.
- [ ] `src/app/(panel)/pedidos/[id]/page.tsx` o `src/components/pedidos/pedido-detail.tsx` — integración en panel.
- [ ] `src/components/pedido/pedido-client.tsx` — redirección al chat tras crear pedido.
- [ ] `src/lib/date.ts` — `formatTime` (si no existe).
- [ ] Tests unitarios y E2E nuevos.
- [ ] `tests/e2e/global-setup.ts` — agregar `order_messages` al `TRUNCATE`.
- [ ] `AGENTS.md` y `.env.example` — documentación de variables y tablas truncadas.

### Fase 2

- [ ] `src/domain/types.ts` — actualizar `OrderMessage` con campos de adjunto.
- [ ] `src/lib/zod-schemas.ts` — `chatMessageSchema` y `chatAttachmentSchema`.
- [ ] `src/db/schema.ts` — columnas de adjunto en `order_messages`.
- [ ] `src/config/chat.ts` — configuración de imágenes.
- [ ] `.env.example` — variables de imágenes.
- [ ] `src/lib/chat-storage.ts` — proveedor específico para adjuntos del chat.
- [ ] `src/app/api/chat/attachment/[key]/route.ts` — servir adjuntos en modo local.
- [ ] `src/app/api/public/pedido/[id]/chat/upload/route.ts`.
- [ ] `src/app/api/pedidos/[id]/chat/upload/route.ts`.
- [ ] `src/components/chat/order-chat.tsx` — soporte de adjuntos.
- [ ] `src/application/services/chatService.ts` — adjuntos opcionales.
- [ ] Tests de upload y previsualización.
- [ ] `AGENTS.md` y `.env.example` — actualizar documentación.

## Notas de eficiencia y optimización

1. **Mantener la consulta de mensajes ligera.** `findByOrderId` debe paginar (limit/offset) y ordenar por índice. Para una panchería, un límite de 100 mensajes por pedido es suficiente; si un pedido genera más, implementar scroll infinito.
2. **No cargar mensajes en el catálogo público.** El chat se carga solo cuando el cliente crea el pedido y va a `/pedido/[id]/chat`.
3. **Evitar N+1 en el panel.** El endpoint `/api/pedidos` lista pedidos; no incluir mensajes ahí. El chat se carga solo al abrir el detalle.
4. **Reutilizar `public_order_rate_limits` para rate limit.** No crear tablas nuevas innecesarias.
5. **Polling simple y controlado.** No WebSockets ni SSE. El intervalo es configurable; 5 segundos es un buen default.
6. **No reservar stock por chat.** El chat no cambia el flujo vigente de pedidos.
7. **Imágenes en Fase 2 separadas del texto.** Permite entregar valor rápido en Fase 1 y iterar.
8. **Componente compartido `OrderChat`.** Una sola implementación para cliente y operador, con diferencias solo en autenticación y URL de API.
9. **Token de acceso simple.** Reutilizar `cancellationToken` para no agregar complejidad de gestión de tokens adicionales.
10. **Soft delete consistente.** `order_messages` se borra en cascada si se hard-deletea el pedido, pero se conserva durante el historial normal.

## Resultado esperado al final de la Fase 1

- El cliente crea un pedido y es redirigido a una pantalla de chat.
- Puede escribir mensajes mientras el pedido esté `pending`.
- El operador ve y responde desde el detalle del pedido.
- No se requiere WhatsApp para la conversación.
- El sistema sigue sin reservar stock hasta la confirmación del operador.

## Resultado esperado al final de la Fase 2

- El cliente puede adjuntar una imagen (comprobante de transferencia) al chat.
- El operador la ve en el panel y puede descargarla.
- Los adjuntos se almacenan en el proveedor configurado (`vercel-blob` recomendado en producción).
- El flujo de confirmación del pedido se mantiene intacto.
