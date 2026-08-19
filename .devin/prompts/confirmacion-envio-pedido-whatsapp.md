# Prompt: Confirmación de envío de pedido por WhatsApp

## Contexto

Proyecto `pancheria` — Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM, PostgreSQL, NextAuth v5. Documentación de referencia: <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" /> y <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />.

El flujo de pedidos públicos vive en <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.tsx" />. Al confirmar el checkout se crea el pedido con `POST /api/public/pedido?branchId={id}`, que devuelve `order` y `whatsappUrl` <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/pedido/route.ts" />. Luego se abre el diálogo de éxito con los botones “Cancelar pedido” y “Abrir WhatsApp” <ref_snippet file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.tsx" lines="624-642" />.

Los pedidos públicos **no reservan ni descuentan stock**: quedan `pending` hasta que el operador los confirma manualmente como venta <ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" />.

## Problema

Cuando el usuario vuelve de WhatsApp, el diálogo sigue mostrando “Cancelar pedido” y “Abrir WhatsApp”, generando confusión sobre si el pedido fue enviado. Se necesita un flujo de confirmación de envío que le dé certeza al usuario.

## Objetivo

Implementar un flujo que, tras abrir WhatsApp, detecte el regreso del usuario, le pregunte si logró enviar el mensaje, registre la confirmación en el backend (sin cambiar el `status` del pedido) y muestre un mensaje de éxito definitivo.

## Reglas de negocio

1. El pedido debe seguir con `status: 'pending'` en todo momento. No modificar `orderStatusEnum`.
2. La confirmación de envío se registra en una columna `sentAt` nullable en `orders`.
3. El operador debe ver un indicador visual en el panel cuando un pedido `pending` ya fue enviado por WhatsApp.
4. El flujo debe ser idempotente: llamar dos veces al endpoint de envío no genera error ni sobrescribe `sentAt`.
5. El endpoint público de envío debe validar que el solicitante posee el `cancellationToken` del pedido, como lo hace la cancelación pública <ref_snippet file="C:/developer/paginas/pancheria/src/app/api/public/pedido/[id]/cancelar/route.ts" lines="31-39" />.

## Implementación detallada

### 1. Base de datos y tipos

- En <ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" />, tabla `orders` <ref_snippet file="C:/developer/paginas/pancheria/src/db/schema.ts" lines="236-258" />, agregar:

  ```ts
  sentAt: timestamp('sent_at'),
  ```

  Sin `.defaultNow()` ni `.notNull()`.

- En <ref_file file="C:/developer/paginas/pancheria/src/domain/types.ts" />, agregar `sentAt: Date | null` al tipo `Order` <ref_snippet file="C:/developer/paginas/pancheria/src/domain/types.ts" lines="61-79" />. `OrderWithItems` lo hereda automáticamente.

- Generar y aplicar migración:

  ```bash
  npx drizzle-kit generate
  npx drizzle-kit push
  ```

  Commitear los archivos generados en `drizzle/` (SQL, snapshot y `_journal.json`).

### 2. Configuración de API

En <ref_file file="C:/developer/paginas/pancheria/src/config/api.ts" />, agregar junto a `PUBLIC_PEDIDO_CANCELAR_API` <ref_snippet file="C:/developer/paginas/pancheria/src/config/api.ts" lines="11-12" />:

```ts
export const PUBLIC_PEDIDO_ENVIAR_API = (orderId: number | string) =>
  `/api/public/pedido/${orderId}/enviar`;
```

### 3. Schema de Zod

En <ref_file file="C:/developer/paginas/pancheria/src/lib/zod-schemas.ts" />, agregar:

```ts
export const orderSendSchema = z.object({
  token: z.string().min(1, 'El token de envío es obligatorio.'),
});
```

### 4. Repositorio

En <ref_file file="C:/developer/paginas/pancheria/src/repositories/orderRepository.ts" />, agregar:

```ts
export async function markOrderAsSent(
  branchId: number,
  id: number
): Promise<typeof orders.$inferSelect | undefined> {
  const [updated] = await db
    .update(orders)
    .set({ sentAt: nowUTC() })
    .where(
      and(
        eq(orders.id, id),
        eq(orders.branchId, branchId),
        eq(orders.status, 'pending'),
        isNull(orders.deletedAt),
        isNull(orders.sentAt)
      )
    )
    .returning();

  return updated;
}
```

Importar `nowUTC` desde <ref_file file="C:/developer/paginas/pancheria/src/lib/date.ts" />.

### 5. Servicio

En <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" />, agregar:

```ts
export async function markOrderAsSent(
  branchId: number,
  id: number,
  token: string
): Promise<OrderWithItems> {
  const order = await orderRepository.findById(branchId, id);

  if (!order) {
    throw new NotFoundError('Pedido', id);
  }

  if (order.status !== 'pending') {
    throw new ValidationError('El pedido no está pendiente de envío.');
  }

  if (order.cancellationToken !== token) {
    throw new ValidationError('El token de envío no es válido.');
  }

  if (order.sentAt) {
    return order;
  }

  const updated = await orderRepository.markOrderAsSent(branchId, id);

  if (!updated) {
    const existing = await orderRepository.findById(branchId, id);
    if (existing && existing.sentAt) {
      return existing;
    }
    throw new Error('No se pudo marcar el envío del pedido.');
  }

  return { ...order, ...updated, branch: order.branch, items: order.items };
}
```

### 6. Endpoint público

Crear `src/app/api/public/pedido/[id]/enviar/route.ts` siguiendo el patrón de <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/pedido/[id]/cancelar/route.ts" />:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import * as orderService from '@/application/services/orderService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { orderSendSchema } from '@/lib/zod-schemas';
import { getDefaultBranchId, DEFAULT_BRANCH_ERROR } from '@/lib/branch-resolver';

const querySchema = z.object({
  branchId: z.coerce.number().int().positive().optional(),
});

export const POST = withApiErrorHandling(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { searchParams } = new URL(request.url);
    const query = querySchema.parse(Object.fromEntries(searchParams));
    const branchId = query.branchId ?? (await getDefaultBranchId());

    if (!branchId) {
      return NextResponse.json({ error: DEFAULT_BRANCH_ERROR }, { status: 400 });
    }

    const { id } = await params;
    const orderId = Number(id);
    if (Number.isNaN(orderId) || orderId <= 0) {
      return NextResponse.json(
        { error: 'ID de pedido inválido' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const data = orderSendSchema.parse(body);

    const order = await orderService.markOrderAsSent(
      branchId,
      orderId,
      data.token
    );

    return NextResponse.json({ order });
  }
);

export const runtime = 'nodejs';
```

### 7. Respuesta del endpoint de creación

En <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/pedido/route.ts" />, incluir `sentAt: order.sentAt` en el objeto `order` que se devuelve <ref_snippet file="C:/developer/paginas/pancheria/src/app/api/public/pedido/route.ts" lines="122-140" />.

### 8. Frontend (`PedidoClient`)

En <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.tsx" />:

- Actualizar el tipo `CreatedOrder` para incluir `sentAt: string | null`.
- Reemplazar los estados actuales del diálogo por una máquina de estados clara:

  ```ts
  type DialogPhase = 'reserved' | 'confirming' | 'sent';
  const [dialogPhase, setDialogPhase] = useState<DialogPhase>('reserved');
  const [whatsappOpenedAt, setWhatsappOpenedAt] = useState<number | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  ```

- `handleOpenWhatsApp` debe:
  - Abrir `createdOrder.whatsappUrl` con `window.open(..., '_blank', 'noopener,noreferrer')`.
  - Si `window.open` devuelve `null`, mostrar un error de popup bloqueado.
  - Setear `whatsappOpenedAt = Date.now()` y limpiar `sendError`.

- `useEffect` para `visibilitychange`:

  ```ts
  useEffect(() => {
    if (!successDialogOpen || !whatsappOpenedAt || dialogPhase === 'sent') return;

    const handler = () => {
      if (
        document.visibilityState === 'visible' &&
        isMountedRef.current &&
        dialogPhase !== 'sent'
      ) {
        setDialogPhase('confirming');
      }
    };

    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [successDialogOpen, whatsappOpenedAt, dialogPhase]);
  ```

- `handleConfirmSend` debe:
  - Llamar a `POST ${PUBLIC_PEDIDO_ENVIAR_API(createdOrder.id)}?branchId=${activeBranch.id}` con body `{ token: createdOrder.cancellationToken }`.
  - Usar `isMountedRef` antes de setear estados.
  - En caso de éxito, actualizar `createdOrder` con la respuesta y `setDialogPhase('sent')`.
  - En caso de error, `setSendError(...)`.

- `handleReopenWhatsApp` debe llamar a `handleOpenWhatsApp()` sin tocar `dialogPhase` (sigue en `confirming`) y limpiar `sendError`.

- Contenido del `Dialog` según fase:
  - `reserved`: título “Pedido reservado”, descripción actual, botones “Cancelar pedido” y “Abrir WhatsApp”.
  - `confirming`: título “¿Enviaste el mensaje por WhatsApp?”, botones “Sí, ya envié” y “No, volver a WhatsApp” (opcionalmente conservar “Cancelar pedido”).
  - `sent`: título “¡Pedido enviado correctamente!”, descripción “Te contactaremos para confirmarlo.”, resumen del pedido (cliente, sucursal, total e ítems si es posible), botones “Cerrar” y “Hacer otro pedido”. No mostrar “Cancelar pedido” ni “Abrir WhatsApp”.

- Al cerrar el diálogo (`onOpenChange` a `false`) limpiar `sendError`, `whatsappOpenedAt` y `dialogPhase` si no está en fase `sent`.

### 9. Panel de pedidos

- En <ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/pedidos-list.tsx" />:
  - Agregar `sentAt: string | null` al tipo `OrderListItem` <ref_snippet file="C:/developer/paginas/pancheria/src/components/pedidos/pedidos-list.tsx" lines="25-40" />.
  - Mostrar un `<Badge variant="outline">Enviado por WhatsApp</Badge>` junto al badge de estado cuando `order.sentAt` no sea `null` y `order.status === 'pending'`.

- (Opcional pero recomendado) Lo mismo en <ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/pedido-detail.tsx" />, agregando `sentAt` al tipo `OrderDetail` <ref_snippet file="C:/developer/paginas/pancheria/src/components/pedidos/pedido-detail.tsx" lines="37-50" />.

## Tests

### 1. Tests del endpoint

Crear `src/app/api/public/pedido/[id]/enviar/route.test.ts` con `@jest-environment node`, siguiendo el patrón de <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/pedido/[id]/cancelar/route.test.ts" />. Cubrir:

- Éxito al marcar como enviado.
- Error si el pedido no existe (`NotFoundError` → 404).
- Error si el `branchId` no coincide.
- Error si falta el `token` o es inválido.
- Idempotencia: llamar dos veces devuelve 200 y no cambia `sentAt`.

### 2. Tests del servicio

En <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.test.ts" />:

- Actualizar `createOrderRow` para incluir `sentAt: null` (de lo contrario `tsc` falla por `typeof orders.$inferSelect`).
- Agregar tests para `markOrderAsSent` validando:
  - Pedido no encontrado.
  - Pedido no `pending`.
  - Token inválido.
  - Éxito y actualización de `sentAt`.
  - Idempotencia cuando `sentAt` ya está seteado.

### 3. Tests del repositorio

En <ref_file file="C:/developer/paginas/pancheria/src/repositories/orderRepository.test.ts" />:

- Actualizar `buildOrder` para incluir `sentAt: null`.
- Si se crea `markOrderAsSent`, agregar tests unitarios.

### 4. Tests del componente

Actualizar <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.test.tsx" /> para cubrir:

- Simular checkout completo: agregar producto, abrir diálogo, enviar pedido, mock de `fetch` devolviendo `order` y `whatsappUrl`.
- `window.open` llamado con `whatsappUrl`.
- Simular `visibilitychange` seteando `document.visibilityState` y despachando el evento:

  ```ts
  Object.defineProperty(document, 'visibilityState', {
    value: 'visible',
    writable: true,
    configurable: true,
  });
  document.dispatchEvent(new Event('visibilitychange'));
  ```

- Clic en “Sí, ya envié” y verificar que se hace `fetch` a `PUBLIC_PEDIDO_ENVIAR_API(order.id)` con el `token`.
- Mensaje final de éxito visible.
- Clic en “No, volver a WhatsApp” y verificar que `window.open` se llama de nuevo.
- Error del backend mostrado dentro del diálogo.

## Restricciones y buenas prácticas

- No modificar `orderStatusEnum` ni el tipo `OrderStatus`.
- No hardcodear URLs, números de WhatsApp ni mensajes. Usar <ref_file file="C:/developer/paginas/pancheria/src/config/api.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/config/catalog.ts" /> y variables de entorno.
- Mantener el patrón de hooks con `useRef` e `isMountedRef` de <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.tsx" />.
- Usar `Button`, `Dialog`, `Badge` de shadcn/ui.
- Todos los textos visibles en español.
- No agregar `sentAt` a `buildOrderValues`; la columna es nullable y el seed no requiere valor inicial.
- Ejecutar `npx drizzle-kit push` solo en bases de datos de prueba o desarrollo, nunca en producción con datos reales sin backups.

## Verificaciones finales

Antes de dar por terminado:

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

Si se cambió el esquema:

```bash
npx drizzle-kit generate
npx drizzle-kit push   # en base de prueba/desarrollo
```

## Criterios de aceptación

- Al abrir WhatsApp y volver a la app, el diálogo pregunta “¿Enviaste el mensaje por WhatsApp?”.
- Al confirmar, el pedido registra `sentAt` y el diálogo muestra un mensaje de éxito definitivo sin opciones de cancelar o reabrir WhatsApp.
- Al no confirmar, el usuario puede reabrir WhatsApp.
- El operador ve el pedido en el panel con `status: 'pending'` y un indicador de que ya fue enviado por WhatsApp.
- Todos los tests nuevos y existentes pasan.
- El build (`npm run build`) compila sin errores.
