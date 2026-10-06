# Prompt: Análisis del catálogo vendible y comportamiento del sistema ante ventas y pedidos — sucursal "Pancheria Popular Av. Los Minerales" (id 3)

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja, pedidos públicos y multi-sucursal.

Stack: Next.js 16 (App Router), React 19, TypeScript, Drizzle ORM con PostgreSQL (Neon), NextAuth v5.

Documentación de referencia obligatoria:
- `AGENTS.md`
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/entornos.md" /> — credenciales y acceso a producción
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/auditoria-nueva-sucursal-stock-2026-10-04.md" /> — decisiones D-1 a D-6 que rigen el catálogo
- `.devin/informes/lecciones-aprendidas.md`

Todo el trabajo y el informe en español.

## Objetivo

Analizá el catálogo vendible de la sucursal "Pancheria Popular Av. Los Minerales" (id 3; dirección "Av. Los Minerales y C. Los Australes") y documentá en un informe cómo se comporta el sistema ante cada venta y cada pedido.

## ENTORNO DE ANÁLISIS

- El contraste del catálogo se hace contra PRODUCCIÓN: la sucursal
  id 3 es la única donde está cargado el catálogo versionado en
  `scripts/data/catalogo-pancheria-popular.ts`. Credenciales:
  `npx vercel env pull .env.production.local --environment=production`
  → `DATABASE_URL` / `DATABASE_URL_UNPOOLED` (paso a paso en
  `.devin/informes/entornos.md`). **El flag `--environment=production`
  es obligatorio**: sin él `vercel env pull` descarga el entorno
  development (`neondb_dev`) y todo el contraste quedaría hecho
  contra la base equivocada. Los valores del archivo descargado vienen
  envueltos en comillas dobles: quitarlas al usarlos
  (`.Trim().Trim('"')` en PowerShell). Borrar `.env.production.local`
  inmediatamente después de usarlo.
- Análisis estrictamente de solo lectura: consultas SELECT
  únicamente; ninguna acción de escritura contra la base ni la app.
  **Ojo: un GET no siempre es inocuo** — `GET /api/cron/expire-orders`
  expira pedidos (escribe `orders`, libera reservas); lo mismo aplica
  a cualquier POST/PUT/DELETE listado abajo. No invocar endpoints
  mutantes en producción: se analiza su código, no se los ejecuta.
- NO usar `.env.local` (`neondb_dev`) para el contraste del catálogo:
  allí la sucursal 3 existe pero está vacía (verificado 2026-10-06:
  0 productos, 0 recetas) y la sucursal 1 ("Sucursal por defecto")
  contiene el dataset de desarrollo mezclado con residuos de tests
  E2E (106 productos, 38 recetas, 43 con nombres con timestamp tipo
  `Producto admin 1788841073564`) — no es el catálogo real.
- El nombre literal "Panchería Popular" no existe en ninguna base:
  identificar siempre la sucursal por id 3 o por su dirección. Ojo:
  en dev la misma sucursal figura como "Popular Av. Los Minerales"
  (sin "Pancheria") con la misma dirección — otro motivo para no
  confiar en el nombre.
- Nota: casi todo el catálogo tiene stock 0 en producción
  (`initialStock` tiene default 0 en el archivo de carga). Esto NO
  bloquea el análisis — el informe documenta el comportamiento del
  sistema, no requiere ejecutar ventas reales. La carga de stock es
  una tarea de escritura separada, fuera del alcance de este
  informe; su mecanismo (POST /api/stock/ajustar →
  `stockService.adjustStock`) se documenta en §5.

## ALCANCE DEL CATÁLOGO

- Fuente primaria: el catálogo cargado para esa sucursal
  (<ref_file file="C:/developer/paginas/pancheria/scripts/data/catalogo-pancheria-popular.ts" />)
  contrastado con lo que expone el catálogo público
  (GET /api/public/catalogo — acepta `?branchId=&includeAvailability=&limit=&offset=`;
  pasar `branchId=3` explícito y `includeAvailability=true` para ver la
  disponibilidad calculada por recetas) y el panel /productos
  (GET /api/productos) en la base de producción.
- Clasificá cada ítem por type (critical_supply, compound,
  manual_supply, service), precio, isActive y si es visible/vendible
  para el cliente o solo insumo interno. El encabezado del archivo
  de catálogo documenta las reglas de clasificación aplicadas
  (decisiones D-1 a D-6 del informe
  `auditoria-nueva-sucursal-stock-2026-10-04.md`):
  pan/salchichas son critical_supply no vendibles, las bebidas son
  critical_supply vendibles standalone, aderezos/toppings son
  manual_supply con el nombre del menú, postres y extras son
  service con precio, y el pancho común define
  maxOptionalSelections = 4 (`TOPE_ADEREZOS_COMUN`).

## SUPERFICIES A CUBRIR (las tres, por separado)

a) /ventas (panel POS): el operador vende directo.
   - POST /api/ventas                → `confirmSale`
   - POST /api/ventas/[id]/anular    → `cancelSale` (anulación)
   - POST /api/ventas/disponibilidad → `validateCartAvailability`:
     pre-check de stock antes de confirmar
   - GET  /api/ventas                → historial (/ventas/historial)
   - Nota: la página /ventas/historial/eliminadas corresponde a
     cajas eliminadas (solo admin), fuera del alcance de ventas.

b) /pedidos y /pedidos/[id] (panel): el operador gestiona pedidos
   entrantes. Mapear CADA acción/botón de la UI a su endpoint y efecto:
   - GET  /api/pedidos y GET /api/pedidos/[id]   → listado y detalle
   - POST /api/pedidos/[id]/recibir    → `receiveOrder` (pending →
     in_process)
   - POST /api/pedidos/[id]/confirmar  → `convertOrderToSale`
     ("facturar")
   - POST /api/pedidos/[id]/finalizar  → `finishOrder`
   - POST /api/pedidos/[id]/cancelar   → `cancelOrder`
   - GET/POST /api/pedidos/[id]/chat   → `order_messages`
     (`sendOperatorMessage` / `listOperatorMessages`)
   - Chat auxiliares: POST .../chat/leido (marcar leído),
     GET .../chat/stream (SSE), POST .../chat/upload (adjuntos),
     GET /api/chat/attachment/[key] (descarga de adjuntos) y
     POST .../chat/ubicacion — el OPERADOR envía la ubicación de la
     sucursal al cliente (`sendBranchLocationMessage`, withAuth +
     rate limit 'branch-location'); no es el cliente compartiendo
     la suya.

c) /pedido (público): el cliente crea y gestiona su pedido.
   - POST /api/public/pedido                 → creación (`createOrder`)
   - POST /api/public/pedido/seguimiento     → búsqueda/seguimiento
     (`trackOrder`, rate limit 'order-tracking';
     /pedido/seguimiento)
   - GET  /api/public/pedido/[id]/estado     → polling de estado.
     **Requiere `?token=` obligatorio**; sin token devuelve 400.
   - POST /api/public/pedido/[id]/cancelar   → cancelación por el
     CLIENTE (token de cancelación en el body + rate limit
     'order-cancellation'; expuesta en la UI en
     pedido-success-dialog "¿Necesitás cancelar el pedido?" y en
     seguimiento). Converge en `cancelOrder` igual que la baja del
     panel — documentar en qué difieren los guards (token público
     vs sesión autenticada) y los parámetros.
   - GET/POST /api/public/pedido/[id]/chat   → chat
     (/pedido/[id]/chat)
   - Chat auxiliares: POST .../chat/leido, GET .../chat/stream
     (SSE, `?token=` obligatorio), POST .../chat/upload,
     GET /api/chat/attachment/[key]
   - POST /api/public/disponibilidad         → pre-check de stock
     (`catalogService.validatePublicCart`; rate limit en memoria
     'availability_poll', no escribe en `public_order_rate_limits`)
   - GET  /api/public/sucursal/estado        → sucursal
     abierta/cerrada. **`branchId` es OBLIGATORIO acá** (a diferencia
     de /api/public/catalogo donde es opcional y cae a la sucursal
     por defecto) → pasar `?branchId=3`.
   - GET  /api/productos/disponibilidad?productId= → disponibilidad
     por producto (panel; `calculateAvailability`; complementa el
     análisis de los endpoints /disponibilidad)

d) Procesos sin UI (transversales):
   - GET /api/cron/expire-orders → `expirePendingOrders`: expiración
     de pedidos pendientes (efecto sobre reservas de stock).
     Protegido con `withCronAuth` (Bearer `CRON_SECRET`). **No
     invocarlo en producción** (muta datos) — solo leer el código.
     Además la expiración es lazy en lecturas: las lecturas de
     pedidos expiran pendings vencidos en el momento
     (`.devin/informes/entornos.md` §Producción, nota 2026-10-01), así
     que el cron solo cubre pedidos que nadie lee — contexto
     necesario para interpretar reservas vs. descuentos.

## REFERENCIAS DE CÓDIGO YA VERIFICADAS (punto de partida)

- Mapeo UI ↔ endpoints centralizado en
  <ref_file file="C:/developer/paginas/pancheria/src/config/api.ts" />.
- Services:
  - <ref_file file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" />
    (`confirmSale`, `cancelSale`). Las funciones de disponibilidad —
    `calculateAvailability`, `calculateAvailabilityForProductIds`,
    `validateCartAvailability` — están **implementadas en**
    <ref_file file="C:/developer/paginas/pancheria/src/lib/product-helpers.ts" />
    y re-exportadas por `saleService.ts` (líneas ~44-53);
    `buildSaleItemValues` vive en `src/lib/sale-helpers.ts`.
  - `src/application/services/orderService.ts` (`createOrder`,
    `receiveOrder`, `convertOrderToSale`, `finishOrder`,
    `cancelOrder`, `expirePendingOrders`, `trackOrder`)
  - `src/application/services/chatService.ts` (`sendOperatorMessage`,
    `sendBranchLocationMessage`, `listOperatorMessages`, etc.)
  - `src/application/services/catalogService.ts`
    (`listPublicCatalog`, `listPublicCatalogWithAvailability`,
    `validatePublicCart`)
- Schema: <ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" />
  (enum `product_type` en líneas 39-44; flags de receta
  `autoDiscount`/`isOptional`/`selectedByDefault` en `recipes`,
  `sale_item_recipes` y `order_item_recipes`).
- Repositorios: `src/repositories/` (stockMovements, reservas, etc.).

## PREGUNTAS A RESPONDER

1. Descuento de STOCK (inventario — NO descuentos de precio):
   - ¿Qué productos e insumos descuentan stock y cuáles no, según su
     tipo y las flags de receta (autoDiscount, isOptional,
     selectedByDefault)?
   - ¿En qué momento exacto se produce el descuento en cada flujo?
     (confirmSale directo, creación del pedido, recibir, confirmar/
     convertir a venta, finalizar)
   - ¿Qué pasa con el stock al cancelar una venta, al cancelar un
     pedido (por el operador Y por el cliente) y cuando un pedido
     pendiente expira vía cron o lazy (reservas vs. descuentos
     reales)?

2. CONTROL DE CANCELACIONES (verificación cruzada UI ↔ backend ↔
   catálogo):
   - Para CADA opción de cancelación existente — anulación de venta
     por el operador (/ventas/historial), cancelación de pedido por
     el operador (/pedidos) y cancelación de pedido por el cliente
     (diálogo de éxito / seguimiento) — documentar:
     * dónde aparece el botón/opción en la UI y bajo qué condiciones
       (estados permitidos, permisos, token),
     * qué endpoint y función de servicio dispara,
     * qué hace con el stock de CADA ítem del catálogo afectado:
       verificar por tipo de producto si reintegra stock, si libera
       reservas sin reintegrar, o si no toca el stock (p. ej.
       service), y si el reintegro respeta las flags de receta con
       las que se descontó,
     * qué registros escribe o actualiza (estado, motivo, auditoría,
       stock_movements, efecto en el resumen de caja).
   - Confirmar que no existan caminos de cancelación sin control
     (acciones de UI sin endpoint, endpoints sin UI, estados desde
     los que se puede cancelar sin efecto documentado).

3. REGISTROS:
   - ¿Qué tablas se escriben en cada acción de las tres superficies?
     (orders, order_items, order_item_recipes,
     order_stock_reservations, stock_movements, order_messages,
     sales, sale_items, sale_payments, sale_item_recipes, resumen de
     caja, public_order_rate_limits)
   - ¿Qué datos quedan como snapshot histórico y cuáles se
     recalculan?

4. MATRIZ COMPARATIVA:
   - acción (botón/endpoint) × efecto en stock × tablas escritas ×
     efecto en caja, para /ventas, /pedidos, /pedido y el cron de
     expiración.

5. CASOS BORDE:
   - Stock insuficiente (incluye el rol de los tres endpoints de
     disponibilidad: POST /api/ventas/disponibilidad,
     POST /api/public/disponibilidad y
     GET /api/productos/disponibilidad), idempotencia de pedidos,
     reintegros por cancelación, ajustes manuales de stock
     (POST /api/stock/ajustar → `stockService.adjustStock` — el
     mecanismo con el que luego se cargará el stock real del
     catálogo).

## ENTREGABLE

- Informe en español guardado en `.devin/informes/` siguiendo el
  formato de los informes existentes (p. ej.
  `auditoria-nueva-sucursal-stock-2026-10-04.md`). Nombre sugerido:
  `analisis-comportamiento-ventas-pedidos-YYYY-MM-DD.md`. Al crearlo,
  actualizar los índices según la regla de `.devin/prompts/README.md`
  (`.devin/informes/README.md` y bloque Estructura de
  `.devin/README.md`).
- Con tablas por producto del catálogo real (según
  `catalogo-pancheria-popular.ts` contrastado con producción),
  referencias a archivos y líneas de código (páginas, componentes,
  endpoints y services), y una sección síntesis: "qué se puede
  vender / qué descuenta stock / qué se registra" para cada una de
  las tres superficies + procesos cron.
