# Spike SSE para el chat de pedidos (T13) — 2026-09-19

## Contexto

El plan de escalabilidad pide un **spike acotado, no una adopción**: en Vercel
serverless una conexión SSE mantiene viva la función y **factura por duración**,
por lo que puede salir más cara que el propio polling. Este documento registra
qué se construyó, cómo medirlo y la decisión tomada.

Puerta de entrada cumplida: T1+T2 ya eliminaron las escrituras por poll (limiter
en memoria) y absorben lecturas vía CDN (`s-maxage`), así que el beneficio
marginal de SSE queda en la **frescura percibida del chat**, no en la carga de la
base.

## Qué se implementó

### Endpoints

- `GET /api/pedidos/[id]/chat/stream` — operador autenticado (`withAuth`, scope
  por `branchId`).
- `GET /api/public/pedido/[id]/chat/stream?token=...` — cliente público; la
  conexión cuenta como **un solo poll** contra el limiter en memoria compartido
  `chat_poll` (`src/lib/chat-poll-rate-limit.ts`).

Ambos comparten `src/lib/chat-stream.ts`:

- `ReadableStream` con formato SSE (`event:`/`data:`/`id:`).
- `event: state` al conectar (con `deliveryType`, `branchLocation`,
  `expiresAt`) y cada vez que cambian `status`/`isExpired`.
- `event: messages` con `id: <último id>`; el `id` alimenta `Last-Event-ID`.
- `: heartbeat` cada `CHAT_STREAM_HEARTBEAT_MS` (default 15 s) para proxies.
- Cierre por presupuesto `CHAT_STREAM_BUDGET_MS` (default 55 s) siempre antes
  del `maxDuration = 60` exportado: `EventSource` reconecta solo.
- Poll interno cada `CHAT_STREAM_INTERVAL_MS` (default 2 s): una query ligera
  de estado (`findChatStreamState`, 4 columnas por PK) + la query indexada de
  mensajes `after` cursor. **Escribe en la base solo cuando llegan mensajes
  nuevos** (`deliveredAt`), a diferencia del poll REST que escribe cada 5 s
  aunque no haya novedades.
- Si el pedido sale del scope (borrado/otra sucursal), emite `event: error` y
  cierra → el cliente cae al polling.

### Cliente (`useOrderChat`)

- Opt-in por `streamApiUrl` (solo se pasa si
  `NEXT_PUBLIC_CHAT_STREAM_ENABLED=true`).
- `EventSource` nativo: reconexión automática con `Last-Event-ID` ante cortes
  de red y cierres por presupuesto.
- **Fallback garantizado**: `event: error` del servidor, `readyState = CLOSED`
  o 8 errores consecutivos → se cierra el stream y el polling REST retoma el
  relevo (`useVisibilityPolling` + backoff intactos).
- **Pestañas ocultas**: al ocultar la pestaña se cierra la conexión y se reabre
  al volver (mismo criterio que el polling, que pausa en `visibilitychange`).
  Esto evita facturar duración de función sin nadie mirando.

## Modelo de costo

Variables: `C` chats abiertos concurrentes, `D` duración media de la sesión del
chat, `I` intervalo de poll del cliente (5 s default).

| | Polling REST | SSE |
|---|---|---|
| Invocaciones de función | `C × D / I` | `C × D / budget` (~1 por minuto) |
| Duración facturada | `C × D / I × t_req` (ms por request) | `C × D` (toda la sesión) |
| Lecturas DB | `C × D / I` polls × ~3 queries | `C × D / intervalo_interno` ticks × 2 queries |
| Escrituras DB | 1 UPDATE por poll aunque esté vacío | solo cuando llegan mensajes |

Ejemplo con 10 chats abiertos durante 5 min (300 s):

- Polling: 10 × 60 = **600 invocaciones** × ~100 ms ≈ **60 s de función** y
  ~1800 queries + ~600 UPDATEs vacíos.
- SSE: 10 conexiones × 300 s = **3000 s de función** (~5 por conexión al
  reconectar por budget), ~1500 ticks × 2 queries = ~3000 queries, UPDATEs
  solo con mensajes reales.

**Lectura:** SSE reduce invocaciones y escrituras, pero multiplica ~50× la
duración facturada de función y mantiene ~1.7× las lecturas a la base (el poll
interno corre aunque el chat esté inactivo). Con Fluid Compute el GB-segundo
es el costo dominante: SSE solo gana si el volumen de invocaciones era el
cuello de botella (límites de concurrencia/costo por request), no si lo es el
tiempo de cómputo.

## Qué medir antes de habilitarlo en producción

1. Duración total de función diaria atribuible a `.../chat/stream` vs. la de
   los GET de chat que reemplaza (observabilidad de T10: `durationMs` por
   request + logs de Vercel).
2. Conexiones concurrentes reales en horario pico — el escenario malo es un
   comercio con muchos operadores y clientes con el chat abierto a la vez.
3. Comportamiento en pestañas ocultas: verificar en Analytics que el cierre
   por `visibilitychange` efectivamente limita la duración media.
4. Latencia percibida mensaje→mensaje (SSE ~intervalo interno de 2 s vs. poll
   de 5 s).

## Decisión

**SSE queda implementado como opt-in deshabilitado por defecto; el polling
REST sigue siendo el modo de producción.**

Justificación:

- El beneficio estructural (menos invocaciones y escrituras) es real pero
  modesto después de T1+T2, y el costo dominante en serverless (duración de
  función) es desfavorable por diseño: una conexión de 5 min cuesta lo mismo
  que ~600 polls de 500 ms.
- Habilitarlo es reversible y barato (`NEXT_PUBLIC_CHAT_STREAM_ENABLED=true`
  por deploy) si las métricas muestran que las invocaciones — no la duración —
  son el problema.
- No se adopta pub/sub externo (Upstash/Pusher): nueva dependencia + costo,
  justificable solo si el chat crece a volúmenes donde ni polling ni SSE
  serverless alcanzan. Re-evaluar en Fase 2 con datos de T10.

## Alternativas registradas si el poll vuelve a ser problema

- Subir `NEXT_PUBLIC_CHAT_REFRESH_INTERVAL_MS` (p. ej. 8–10 s) + `ETag`/`304`
  en el GET de chat (la respuesta cambia poco).
- `maxDuration`/budget más agresivos si se habilita SSE y el costo sube.
- Pub/sub externo con webhook de escritura: elimina el poll interno, pero
  agrega una dependencia paga.

## Tests

- `src/lib/chat-stream.test.ts` — emisión de `state`/`messages`/heartbeat,
  cursor `id`, cierre por presupuesto, abort, error de scope.
- `route.test.ts` de ambos endpoints — headers SSE, cursor `after`/
  `Last-Event-ID`, 400/404/429.
- `chatService.test.ts` — `getChatStreamState`/`pollChatStreamTick` (scope,
  entrega solo con mensajes nuevos).
- `tests/e2e/chat-stream.spec.ts` — stream público y de operador con `budget`
  corto + `event: messages` tras un POST real; token inválido → 404.
- Fallback a polling: cubierto por `pedido-chat.spec.ts` (corre con el flag
  deshabilitado) y por los tests del hook (jsdom no tiene `EventSource` → el
  hook queda en modo polling).
