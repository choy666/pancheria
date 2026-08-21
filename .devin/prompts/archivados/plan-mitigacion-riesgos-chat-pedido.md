# Plan de implementación para mitigar riesgos y recomendaciones del chat de pedidos

## Contexto

Este plan nace de la auditoría del flujo de pedidos y chat. El sistema ya permite crear pedidos, chatear entre cliente y operador, adjuntar imágenes, confirmar/cancelar pedidos y mostrar `unreadCount`. Sin embargo, se detectaron seis puntos a corregir o mejorar para cumplir con buenas prácticas, evitar condiciones de carrera, mantener el storage limpio y alinear la experiencia de usuario con el flujo real (chat primario, WhatsApp como fallback).

---

## Estado de partida

- El chat de pedidos y sus adjuntos están implementados en Fase 1 y Fase 2 de una sola vez.
- `npm test`, `npm run lint`, `npm run build` y `npx tsc --noEmit` pasan.
- `GET /api/public/pedido/[id]/chat` solo devuelve `{ messages }`.
- `OrderChat` recibe `readOnly` como prop y no se actualiza cuando el pedido cambia de estado.
- `PedidosList` no hace polling.
- No existe limpieza de adjuntos huérfanos del chat.
- `OrderChat` puede sufrir una carrera entre envío de mensaje y polling.
- Varios rótulos aún dicen "WhatsApp" aunque el canal principal es el chat.
- `LOCAL_STORAGE_PATH` se comparte entre videos y chat, pero la documentación solo menciona videos.

---

## Fase A: Correcciones inmediatas (alto impacto, bajo riesgo)

### A1. Actualizar rótulos obsoletos de WhatsApp

**Estado actual:** el flujo principal es "pedido → chat", pero los rótulos aún dicen "WhatsApp". El botón del carrito dice "Pedir por WhatsApp", el diálogo de checkout dice "Completá tus datos para enviar el pedido por WhatsApp" y el botón de submit dice "Enviar pedido por WhatsApp".

**Decisiones:** se mantiene WhatsApp como fallback, pero los CTA principales deben reflejar que el pedido se crea en la app y que el chat es el canal de coordinación.

**Cambios:**

| Texto actual | Texto nuevo | Ubicación |
|---|---|---|
| `Pedir por WhatsApp` | `Hacer pedido` | `src/components/pedido/cart-summary.tsx` |
| `Completá tus datos para enviar el pedido por WhatsApp` | `Completá tus datos para hacer el pedido` | `src/components/pedido/pedido-client.tsx` |
| `Enviar pedido por WhatsApp` | `Hacer pedido` | `src/components/pedido/pedido-client.tsx` |
| `Enviando...` | `Procesando...` | `src/components/pedido/pedido-client.tsx` |

**Archivos a tocar:**

- `src/components/pedido/cart-summary.tsx`
- `src/components/pedido/pedido-client.tsx`
- `src/components/pedido/pedido-client.test.tsx` (busca textos y el `describe('flujo de checkout y envío por WhatsApp')`)
- `tests/e2e/pedido.spec.ts`
- `tests/e2e/pedido-chat.spec.ts`
- `tests/e2e/pedido-chat-adjuntos.spec.ts`

**Tests y verificación:**

```bash
npm test -- --testPathPattern=pedido-client
npm run build
npx playwright test tests/e2e/pedido-chat.spec.ts
npx playwright test tests/e2e/pedido-chat-adjuntos.spec.ts
```

---

### A2. Devolver `status` en el endpoint de chat del cliente

**Estado actual:** `GET /api/public/pedido/[id]/chat` solo devuelve `{ messages }`. El `OrderChat` del cliente recibe `readOnly` como prop del server component y nunca se entera si el operador confirma o cancela el pedido mientras la pestaña sigue abierta.

**Decisiones:** se agrega `status` al endpoint. El `OrderChat` mantiene un estado interno `isReadOnly` que se sincroniza con la prop inicial y con el `status` que devuelve cada poll.

**Cambios:**

1. Modificar `chatService.listClientMessages` para que devuelva `{ messages: OrderMessage[]; status: OrderStatus }`. El servicio ya valida el token con `orderRepository.findByIdWithToken`, por lo que `status` está disponible sin costo adicional.
2. Modificar `GET /api/public/pedido/[id]/chat` para devolver `{ messages, status }`.
3. Modificar `GET /api/pedidos/[id]/chat` de la misma forma, por consistencia.
4. En `OrderChat`:
   - Agregar `const [isReadOnly, setIsReadOnly] = useState(readOnly);`
   - Sincronizar con la prop: `useEffect(() => setIsReadOnly(readOnly), [readOnly]);`
   - En `fetchMessages`, si `data.status` existe, actualizar `setIsReadOnly(data.status !== 'pending')`.
   - Reemplazar todas las lecturas de `readOnly` por `isReadOnly` (input deshabilitado, placeholder, etc.).

**Archivos a tocar:**

- `src/application/services/chatService.ts`
- `src/app/api/public/pedido/[id]/chat/route.ts`
- `src/app/api/pedidos/[id]/chat/route.ts` (opcional, recomendado)
- `src/components/chat/order-chat.tsx`
- `src/application/services/chatService.test.ts`
- `src/app/api/public/pedido/[id]/chat/route.test.ts`
- `src/app/api/pedidos/[id]/chat/route.test.ts`

**Tests y verificación:**

```bash
npx tsc --noEmit
npm test -- --testPathPatterns=chat
npm run build
```

---

### A3. Eliminar la carrera entre envío y polling en `OrderChat`

**Estado actual:** `fetchMessages` usa `isFetchingRef` para evitar polls concurrentes, pero `handleSend` no lo bloquea. Si un poll devuelve la lista justo después del envío, pueden duplicarse mensajes o sobrescribirse estados.

**Decisiones:** se pausa el polling mientras se envía un mensaje. Tras el envío exitoso se mantiene el append optimista y se fuerza una sincronización con `fetchMessages()`.

**Cambios:**

1. Agregar `const isSendingRef = useRef(false);`.
2. En `fetchMessages`, retornar temprano si `isSendingRef.current` o `isFetchingRef.current`.
3. En `handleSend`:
   - Al inicio, `isSendingRef.current = true; setIsSending(true);`.
   - Tras recibir la respuesta, conservar el append optimista `setMessages((prev) => [...prev, data.message])`.
   - En `finally`, `isSendingRef.current = false; setIsSending(false);`.
   - Después de limpiar el input, llamar `void fetchMessages();` para sincronizar con el servidor.
4. Aprovechar la misma modificación para que `fetchMessages` actualice `isReadOnly` si `data.status` existe (combinado con A2).

**Archivos a tocar:**

- `src/components/chat/order-chat.tsx`
- `tests/e2e/pedido-chat.spec.ts`
- `tests/e2e/pedido-chat-adjuntos.spec.ts`

**Tests y verificación:**

```bash
npm test
npx playwright test tests/e2e/pedido-chat.spec.ts
npx playwright test tests/e2e/pedido-chat-adjuntos.spec.ts
```

---

## Fase B: Mejoras de operador y storage

### B1. Polling del listado de pedidos del operador

**Estado actual:** `PedidosList` carga una sola vez y no refresca nuevos pedidos ni cambios en los mensajes no leídos.

**Decisiones:** se extiende `use-paginated-data` para soportar un `refreshIntervalMs` opcional. Se agrega una variable de entorno `NEXT_PUBLIC_PEDIDOS_REFRESH_INTERVAL_MS` con default 10_000 ms; 0 la deshabilita.

**Cambios:**

1. Extender `use-paginated-data.ts` con `refreshIntervalMs?: number` en `UsePaginatedDataOptions`.
2. En el `useEffect` de carga, si `refreshIntervalMs > 0`, iniciar un intervalo que llame `refresh()` solo cuando `document.visibilityState === 'visible'`. Limpiar el intervalo en cleanup.
3. Agregar `getPedidosRefreshIntervalMs()` en `src/config/orders.ts` leyendo `NEXT_PUBLIC_PEDIDOS_REFRESH_INTERVAL_MS`.
4. Documentar la variable en `.env.example` y `AGENTS.md`.
5. En `PedidosList`, pasar `refreshIntervalMs: getPedidosRefreshIntervalMs()`.

**Archivos a tocar:**

- `src/hooks/use-paginated-data.ts`
- `src/config/orders.ts`
- `src/components/pedidos/pedidos-list.tsx`
- `.env.example`
- `AGENTS.md`
- `src/hooks/use-paginated-data.test.ts`

**Tests y verificación:**

```bash
npx tsc --noEmit
npm test -- --testPathPattern=use-paginated-data
npm run build
```

---

### B2. Separar o documentar la ruta de almacenamiento local del chat

**Estado actual:** `chat-storage.ts` guarda adjuntos en `<LOCAL_STORAGE_PATH>/chat/`, pero `.env.example` describe `LOCAL_STORAGE_PATH` solo para videos.

**Decisiones:** se agrega soporte para una variable opcional `CHAT_LOCAL_STORAGE_PATH` que, si existe, se usa para chat. Si no, se mantiene el fallback a `LOCAL_STORAGE_PATH` y luego a `tmp/videos` (preservando compatibilidad con archivos ya creados).

**Cambios:**

1. En `chat-storage.ts`, agregar `getChatLocalStorageBasePath()`:
   - `process.env.CHAT_LOCAL_STORAGE_PATH`
   - fallback a `process.env.LOCAL_STORAGE_PATH`
   - fallback a `path.join(process.cwd(), 'tmp', 'videos')`.
2. Actualizar el comentario en `.env.example` para que `LOCAL_STORAGE_PATH` diga que es ruta base para almacenamiento local (videos y chat).
3. Agregar `CHAT_LOCAL_STORAGE_PATH` comentado en `.env.example`.
4. Documentar en `AGENTS.md`.
5. Actualizar `src/lib/chat-storage.test.ts` para probar `CHAT_LOCAL_STORAGE_PATH`.

**Archivos a tocar:**

- `src/lib/chat-storage.ts`
- `.env.example`
- `AGENTS.md`
- `src/lib/chat-storage.test.ts`

**Tests y verificación:**

```bash
npm test -- --testPathPattern=chat-storage
npm run build
```

---

## Fase C: Limpieza de adjuntos huérfanos

**Estado actual:** `chat-storage.ts` sube adjuntos, pero no hay proceso para borrar archivos cuyo mensaje fue eliminado.

**Decisiones:**

- Se agrega la columna `attachmentKey` a `order_messages` para guardar la key interna del storage (`chat/[orderId]/[nanoid].[ext]`).
- `chat-storage.ts` devuelve `key` en `SavedChatAttachment`.
- `chatService` almacena `attachmentKey`.
- Se crea `GET /api/cron/chat-attachments-cleanup`, protegido con `CRON_SECRET`, que recorre archivos locales u objetos remotos bajo el prefijo `chat/` y borra los que no tengan `attachmentKey` asociado.
- Se agrega el cron en `vercel.json`.

**Cambios:**

1. **Esquema:** agregar columna `attachmentKey: text` a `order_messages` en `src/db/schema.ts`.
2. **Tipos:** agregar `attachmentKey` a `OrderMessage` en `src/domain/types.ts`.
3. **Storage:** incluir `key` en `SavedChatAttachment` y devolverlo en `saveChatAttachment` en `src/lib/chat-storage.ts`.
4. **Servicio de chat:** almacenar `attachmentKey` junto con los campos de adjunto en `src/application/services/chatService.ts`.
5. **API de cleanup:** crear `src/app/api/cron/chat-attachments-cleanup/route.ts`:
   - Protegido con `CRON_SECRET`.
   - Si `STORAGE_PROVIDER=local`: recorrer `<base>/chat/` y comparar keys con la base.
   - Si `STORAGE_PROVIDER` es remoto: listar objetos con prefijo `chat/` y borrar los no referenciados.
6. **Cron:** agregar entrada en `vercel.json`.
7. **Documentación:** agregar `CHAT_ATTACHMENTS_CLEANUP_SCHEDULE` en `.env.example` y `AGENTS.md`.
8. **Migración:** correr `npx drizzle-kit generate` y `npx drizzle-kit push`.

**Archivos a tocar:**

- `src/db/schema.ts`
- `src/domain/types.ts`
- `src/lib/chat-storage.ts`
- `src/application/services/chatService.ts`
- `src/app/api/cron/chat-attachments-cleanup/route.ts` (nuevo)
- `src/app/api/cron/chat-attachments-cleanup/route.test.ts` (nuevo)
- `vercel.json`
- `.env.example`
- `AGENTS.md`
- Tests de `chatService`, `chat-storage` y endpoints de upload.

**Tests y verificación:**

```bash
npx drizzle-kit generate
npx tsc --noEmit
npm test
npm run build
```

**Alternativa simple:** si se prefiere una versión sin migración, se puede extraer la key de `attachmentUrl` para modo local y dejar la limpieza remota para una iteración posterior. Eso reduce la Fase C pero es menos robusta.

---

## Resumen de prioridades

| Fase | Item | Esfuerzo | Impacto en usuario | Orden sugerido |
|---|---|---|---|---|
| A1 | Rótulos WhatsApp | Bajo | Alto | 1 |
| A2 | Status en chat cliente | Bajo-Medio | Alto | 2 |
| A3 | Carrera envío/polling | Bajo | Medio | 3 |
| B1 | Polling listado pedidos | Medio | Medio | 4 |
| B2 | `LOCAL_STORAGE_PATH` chat | Bajo | Bajo | 5 |
| C | Limpieza adjuntos huérfanos | Alto | Medio | 6 |

---

## Verificación general tras todas las fases

```bash
npx drizzle-kit generate     # solo si se hace Fase C
npx drizzle-kit push         # solo si se hace Fase C
npx tsc --noEmit
npm run lint
npm test
npm run build
npm run test:e2e             # en base de datos descartable
```

---

## Notas de seguridad

- No hardcodear credenciales, URLs de APIs ni parámetros sensibles.
- `CRON_SECRET` debe seguir viniendo de variables de entorno.
- Las keys de adjunto deben ser opacas y nunca exponer paths físicos.
- Los cron jobs deben protegerse con `CRON_SECRET` y rechazar llamadas sin él.

---

## Notas para futuros cambios

- Si se agregan nuevos canales de chat o tipos de adjunto, reutilizar `src/lib/rate-limit.ts` con un scope propio y `src/lib/chat-storage.ts` para imágenes.
- Si se requiere mayor tiempo real, evaluar Server-Sent Events o WebSockets en una iteración aparte; por ahora el polling configurado es suficiente.
