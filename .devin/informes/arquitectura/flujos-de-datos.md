# Flujos de datos — punta a punta

**Estado:** implementado
**Cinco flujos críticos verificados en código.** Cada diagrama tiene su fuente `.mmd` en [`diagramas/`](diagramas/).

## Índice

1. [Pedido público → venta confirmada](#1-pedido-público--venta-confirmada) — `flujos-de-datos.mmd`
2. [Venta directa en el panel](#2-venta-directa-en-el-panel-ventas) — `flujo-venta-directa.mmd`
3. [Cierre de caja](#3-cierre-de-caja) — `flujo-cierre-caja.mmd`
4. [Chat del pedido](#4-chat-del-pedido-polling--sse-opt-in) — `flujo-chat.mmd`
5. [Subida de archivos](#5-subida-de-archivos-storage) — `flujo-uploads.mmd`

## 1. Pedido público → venta confirmada

```mermaid
sequenceDiagram
    autonumber
    actor C as Cliente
    participant PED as /pedido (SSR + cliente)
    participant API as API Routes
    participant SVC as Servicios de aplicación
    participant DB as PostgreSQL
    actor OP as Operador
    participant PAN as /pedidos (panel)

    C->>PED: Navega catálogo (?branchId)
    PED->>SVC: listPublicCatalogWithAvailability (SSR)
    SVC->>DB: catálogo (cache: public-catalog) + stock vivo + reservas
    SVC-->>PED: productos con disponibilidad calculada
    C->>PED: Arma carrito (localStorage)
    PED->>API: POST /api/public/disponibilidad (revalidación)
    API->>SVC: validatePublicCart
    SVC->>DB: stock - reservas vigentes
    C->>API: POST /api/public/pedido + idempotencyKey
    API->>API: rate limit (public_order_rate_limits) + zod
    API->>SVC: createOrder
    SVC->>DB: TX: orders + order_items + order_item_recipes (snapshot)
    API-->>C: 201 { orderNumber, cancellationToken, expiresAt }
    C->>API: POST /api/public/pedido/seguimiento / chat (polling o SSE)
    OP->>PAN: Ve pedido pending (polling /api/pedidos)
    OP->>API: POST /api/pedidos/[id]/recibir
    API->>SVC: receiveOrder (FOR UPDATE + check expiración)
    SVC->>DB: TX: order_stock_reservations + stock_movements(reserve)<br/>status = in_process
    OP->>API: POST /api/pedidos/[id]/confirmar + pagos
    API->>SVC: convertOrderToSale (FOR UPDATE)
    SVC->>DB: TX: libera reservas, sale + sale_items + sale_payments,<br/>stock_movements(sale), actualiza cash_registers, status = paid
    OP->>API: POST /api/pedidos/[id]/finalizar
    SVC->>DB: status = finished
    C->>API: seguimiento muestra estado final
```

> Fuente: [diagramas/flujos-de-datos.mmd](diagramas/flujos-de-datos.mmd)

Puntos clave: el catálogo base viene del Data Cache (`public-catalog`) pero la disponibilidad se calcula en vivo; el pedido nace sin reservar stock; todas las transiciones críticas van bajo `FOR UPDATE` dentro de `executeInTransaction`.

## 2. Venta directa en el panel (`/ventas`)

```mermaid
sequenceDiagram
    autonumber
    actor OP as Operador
    participant TERM as SalesTerminal (cliente)
    participant API as API Routes
    participant SVC as saleService / cashRegisterService
    participant DB as PostgreSQL

    OP->>TERM: Abre terminal de ventas
    TERM->>API: GET /api/caja/resumen
    API->>SVC: getOpenCashRegister + resumen
    SVC->>DB: cash_registers (open) + sales agregadas
    alt sin caja abierta
        OP->>API: POST /api/caja/abrir { initialAmount }
        API->>SVC: openCashRegister
        SVC->>DB: TX: INSERT cash_registers (única open por sucursal)
    end
    TERM->>API: GET /api/productos/disponibilidad
    API->>SVC: listActiveProductsWithAvailability
    SVC->>DB: productos activos + stock - reservas
    OP->>TERM: Arma ticket + pagos (cash/transfer, multi-parte)
    TERM->>API: POST /api/ventas + idempotencyKey
    API->>SVC: confirmSale (FOR UPDATE en productos)
    SVC->>DB: TX: sales + sale_items + sale_payments +<br/>sale_item_recipes (snapshot) + stock_movements(sale)<br/>+ UPDATE cash_registers (totales y resúmenes)
    API-->>TERM: 201 venta confirmada
    OP->>TERM: (opcional) anular venta
    TERM->>API: POST /api/ventas/[id]/anular
    API->>SVC: cancelSale (FOR UPDATE)
    SVC->>DB: TX: status = cancelled + stock_movements(cancellation)<br/>reintegra stock + actualiza cash_registers
```

> Fuente: [diagramas/flujo-venta-directa.mmd](diagramas/flujo-venta-directa.mmd)

Puntos clave: la venta exige una caja `open` (única por sucursal, garantizada por índice parcial); el stock se descuenta por receta seleccionada con snapshots en `sale_item_recipes`; anular reintegra stock con movimientos `cancellation`.

## 3. Cierre de caja

```mermaid
sequenceDiagram
    autonumber
    actor OP as Operador
    participant PAN as /cierre (panel)
    participant API as API Routes
    participant SVC as cashRegisterService
    participant DB as PostgreSQL

    Note over SVC,DB: Cierre automático: al leer la caja abierta,<br/>si supera CAJA_AUTO_CLOSE_HOURS se cierra bajo lock<br/>(closedBy = etiqueta CAJA_AUTO_CLOSED_BY, autoClosed=true)

    OP->>PAN: Abre /cierre
    PAN->>API: GET /api/panel/resumen (o /api/caja/resumen)
    API->>SVC: getOpenCashRegisterSummary
    SVC->>DB: FOR UPDATE cash_registers → auto-cierre si venció<br/>+ resumen paginado de ventas activas
    API-->>PAN: totales esperados (cash/transfer) + alertas de turno

    OP->>PAN: Ingresa conteo real (cash/transfer) + notas
    PAN->>API: POST /api/caja/cerrar
    API->>SVC: closeCashRegister (FOR UPDATE)
    SVC->>DB: TX: status = closed + closing_cash_count,<br/>closing_difference, closing_notes, resúmenes congelados
    API-->>PAN: caja cerrada con diferencias calculadas

    Note over OP,DB: Post-cierre — /caja/historial lista cerradas,<br/>papelera (deletedAt): restaurar reintegra stock de ventas<br/>vinculadas o eliminar en lotes (TRASH_RESTORE_BATCH_SIZE)
```

> Fuente: [diagramas/flujo-cierre-caja.mmd](diagramas/flujo-cierre-caja.mmd)

Puntos clave: el cierre congela `products_summary`, `critical_supplies_summary` y `recipe_supplies_summary` (JSONB); las diferencias se calculan contra el conteo declarado; el auto-cierre usa la etiqueta `CAJA_AUTO_CLOSED_BY` (por eso `closed_by` no es FK).

## 4. Chat del pedido (polling + SSE opt-in)

```mermaid
sequenceDiagram
    autonumber
    actor C as Cliente
    actor OP as Operador
    participant CHAT as OrderChat (componente)
    participant API as API Routes
    participant SVC as chatService
    participant DB as PostgreSQL

    C->>API: GET /pedido/[id]/chat?token (SSR: getChatContext)
    API->>SVC: findByIdWithToken (token = cancellationToken)
    SVC->>DB: order + order_messages paginados

    alt SSE habilitado (NEXT_PUBLIC_CHAT_STREAM_ENABLED)
        CHAT->>API: GET .../chat/stream (EventSource, Last-Event-ID)
        API->>SVC: getChatStreamState + pollChatStreamTick
        loop cada intervalMs hasta budgetMs
            SVC->>DB: estado + mensajes nuevos (after=cursor)<br/>marca deliveredAt del otro emisor
            SVC-->>CHAT: event: messages / status / heartbeat
        end
        API-->>CHAT: fin de presupuesto → cliente reconecta
    else polling (por defecto)
        loop cada NEXT_PUBLIC_CHAT_REFRESH_INTERVAL_MS
            CHAT->>API: GET .../chat?after=cursor
            API->>SVC: listClientMessages / listOperatorMessages
            SVC->>DB: mensajes + deliveredAt
        end
    end

    C->>API: POST .../chat { content | attachment }
    OP->>API: POST .../chat / .../ubicacion
    API->>SVC: sendClientMessage / sendOperatorMessage (FOR UPDATE,<br/>rechaza finished/cancelled/expirado)
    SVC->>DB: INSERT order_messages

    Note over API,DB: Adjuntos: POST .../chat/upload → storage provider<br/>(magic bytes validados), lectura local vía /api/chat/attachment/{key}<br/>con auth de sesión o token del pedido
```

> Fuente: [diagramas/flujo-chat.mmd](diagramas/flujo-chat.mmd)

Puntos clave: el SSE (`chat-stream.ts`) hace polling interno a la DB con heartbeat y presupuesto de conexión (`CHAT_STREAM_*`); al expirar el budget el `EventSource` reconecta solo. El polling REST es el fallback por defecto. Solo se permite ubicación de sucursal en pedidos `pickup`.

## 5. Subida de archivos (storage)

```mermaid
flowchart TB
    UP["Archivo del usuario<br/>(video / imagen / adjunto)"]

    subgraph DECIDE["Selección de proveedor — STORAGE_PROVIDER"]
        D{provider}
    end

    subgraph LOCAL["local (dev/e2e)"]
        L1["POST directo al servidor<br/>/api/videos/upload<br/>/api/productos/imagen/upload<br/>/api/*/chat/upload"]
        L2["fs en LOCAL_STORAGE_PATH<br/>lectura vía rutas proxy autenticadas"]
        L1 --> L2
    end

    subgraph REMOTO["vercel-blob / s3 / r2 (prod)"]
        R1["prepareUpload → UploadInstructions<br/>(presigned POST / client token)"]
        R2["Cliente sube directo al bucket"]
        R3["URL pública guardada en DB<br/>(videos.file_url, products.image_*, order_messages.attachment_*)"]
        R1 --> R2 --> R3
    end

    VAL["Validación server-side:<br/>MIME permitido + tamaño + magic bytes<br/>(firma real del archivo)"]

    UP --> D
    D -->|local| L1
    D -->|remoto| R1
    L1 --> VAL
    R3 --> VAL

    classDef dec fill:#fff4e5,stroke:#e8a13b,color:#111
    classDef loc fill:#e8f0fe,stroke:#3b78e7,color:#111
    classDef rem fill:#e9f7ef,stroke:#2e9e5b,color:#111
    class D dec
    class L1,L2 loc
    class R1,R2,R3 rem
    class VAL dec
```

> Fuente: [diagramas/flujo-uploads.mmd](diagramas/flujo-uploads.mmd)

Puntos clave: el provider se elige por `STORAGE_PROVIDER` en runtime (`config/videos.ts`), con warning si es `local` en producción (fs efímero en Vercel) y validación de build en `next.config.ts`. La validación de contenido usa firma real (magic bytes), no el MIME declarado. Las lecturas locales pasan por proxies autenticados (`/api/videos/[id]/stream` con Range, `/api/chat/attachment/[key]`, `/api/productos/imagen/[key]`).

## Caché y frescura (transversal)

| Dato | Estrategia |
| --- | --- |
| `branches` (lookup por id/nombre) | `unstable_cache` tag `branches` — invalida `revalidateTag('branches', {expire:0})` al mutar sucursales |
| Catálogo público base | tag `public-catalog` — invalida al mutar productos/recetas |
| Stock, reservas, caja, mensajes | **siempre en vivo** (decisión deliberada) |
| Estado de sucursal público | headers CDN `s-maxage`/`swr` (`/api/public/sucursal/estado`) |

Volver al índice: [README.md](README.md)
