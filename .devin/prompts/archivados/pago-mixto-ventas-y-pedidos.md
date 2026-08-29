# Prompt: soporte de pagos mixtos (efectivo + transferencia) en ventas y pedidos

> **Estado:** resuelto y archivado.  
> La funcionalidad está implementada en `main` con la migración `0022_jittery_grandmaster.sql`. Este prompt se conserva como registro histórico; para trabajo nuevo consultar `pancheria.prompt.md`, `lecciones-aprendidas.md` y `guia-funcionamiento-pancheria.md`.

## Contexto

Proyecto: `pancheria` — Next.js 16.3.3, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM, PostgreSQL (Neon), NextAuth v5.

Documentación de referencia obligatoria:

- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/README.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/pancheria.prompt.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/auditoria-y-documentacion.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" />

Código relevante:

- Esquema y tipos: <ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/domain/types.ts" />.
- Validaciones: <ref_file file="C:/developer/paginas/pancheria/src/lib/zod-schemas.ts" />.
- Servicios: <ref_file file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/application/services/summaryService.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/application/services/closureService.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/application/services/cashRegisterService.ts" />.
- Repositorios: <ref_file file="C:/developer/paginas/pancheria/src/repositories/saleRepository.ts" />.
- UI: <ref_file file="C:/developer/paginas/pancheria/src/components/ventas/sales-terminal.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/components/ventas/sales-history.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/pedido-actions.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/usePedidoDetail.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/pedido-detail.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/components/caja/cash-register-summary.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/components/cierre/closure-panel.tsx" />.
- Rutas API: <ref_file file="C:/developer/paginas/pancheria/src/app/api/ventas/route.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/app/api/pedidos/[id]/confirmar/route.ts" />.

## Estado actual relevante

- `payment_method` es un enum con los valores `cash` y `transfer` en `src/db/schema.ts`.
- `sales` almacena una única columna `paymentMethod` (`notNull`). La UI expone un selector excluyente.
- `cash_registers` separa `cashTotal` y `transferTotal`, por lo que ya está preparada para sumar por medio.
- `saleService.insertSaleAndUpdateCashRegister` y `orderService.convertOrderToSale` reciben un único `paymentMethod` y actualizan la caja en consecuencia.
- `summaryService.calculateSummaryFromSales` y `closureService.generateClosure` recalculan `cashTotal`/`transferTotal` a partir del `paymentMethod` de cada venta.
- No existe una tabla `sale_payments`, ni el tipo `PaymentPart`, ni soporte en los esquemas Zod.

## Objetivo

Permitir registrar **pagos mixtos** (por ejemplo, $500 en efectivo y $1500 en transferencia por un total de $2000) en:

1. La terminal de ventas (`/ventas`), que crea una venta directa (`POST /api/ventas`).
2. La confirmación de pago de un pedido (`/pedidos/[id]`), que convierte el pedido en venta (`POST /api/pedidos/[id]/confirmar`).

Mantener compatibilidad con ventas históricas y no agregar métodos de pago nuevos.

## Alcance

- Aplicar a **venta directa** y a **confirmación de pedido**.
- No modificar la creación pública de pedidos (`/pedido`) ni su reserva de stock, salvo lo necesario para recibir los medios de pago en la conversión.
- No agregar nuevos métodos de pago. Solo `cash` y `transfer`.

## Supuestos de diseño

1. **Estrategia de datos:** se creará la tabla `sale_payments` (`saleId`, `method`, `amount`, `createdAt`) en lugar de agregar columnas a `sales`. Es más extensible y mantiene `sales` normalizada. Si se prefiere otra estrategia, justificar y ajustar el plan.
2. **Destino de `sales.paymentMethod`:** la columna debe quedar deprecada a mediano plazo. En la migración inicial se puede mantener como `notNull` con el método de la primera parte, pero los cálculos contables deben usar `sale_payments`. Si la migración no puede eliminarla en un solo paso, planear una migración posterior para quitarla.
3. **Monto total:** el pago mixto debe cubrir el **total exacto** de la venta/pedido. No se permiten señas ni saldos pendientes.
4. **Partes por método:** se permite como máximo una parte por medio (una en efectivo y una en transferencia). Si se desean múltiples partes del mismo medio, adaptar validaciones.

## Reglas de negocio

- Un pago mixto es una lista de partes: `{ method: 'cash' | 'transfer'; amount: number }`.
- Debe haber al menos una parte.
- Cada monto debe ser mayor a 0.
- La suma de todas las partes debe ser **igual** al total de la venta/pedido. Si falta o sobra, el backend rechaza con 400 y la UI muestra el monto faltante o sobrante.
- Usar `parseMoney`/`moneyToNumber` de `src/lib/money.ts` para sumar y comparar montos, evitando errores de punto flotante.
- Al confirmar, la caja abierta se actualiza así:
  - `cashTotal +=` suma de partes en efectivo.
  - `transferTotal +=` suma de partes en transferencia.
  - `total +=` total de la venta.
  - `totalSales += 1`.
- Al anular una venta con pago mixto, se deben revertir exactamente los mismos montos de `cashTotal` y `transferTotal`.
- El historial de ventas y el cierre diario deben mostrar el desglose de medios.
- Mantener idempotencia, aislamiento por `branchId` y el manejo actual de transacciones (`executeInTransaction`).

## Implementación detallada

### Esquema y migración

- Crear la tabla `sale_payments` en `src/db/schema.ts` con `id`, `saleId`, `method`, `amount`, `createdAt`. Agregar índice en `saleId`.
- Definir relaciones en `src/db/schema.ts`: `salesRelations.payments` (`many(salePayments)`) y `salePaymentsRelations` (`one(sales)`).
- Crear migración con `npx drizzle-kit generate` y empujar en base de prueba con `npx drizzle-kit push`.
- Migrar datos históricos: cada venta existente con un solo `paymentMethod` debe quedar como una única parte en `sale_payments` con `amount = total`.
- Planear la eliminación de `sales.paymentMethod` en una migración posterior, una vez que todas las lecturas/escrituras usen `sale_payments`.

### Servicios de aplicación

- `src/application/services/saleService.ts`:
  - `insertSaleAndUpdateCashRegister` debe recibir `payments: PaymentPart[]` en lugar de `paymentMethod`.
  - `updateCashRegisterSummary` debe sumar `cashTotal` y `transferTotal` a partir del desglose, usando `addMoney`/`moneyToNumber`.
  - `cancelSale` debe leer las partes de `sale_payments` y revertir los montos exactos por medio.
  - Manejar idempotencia: si `sales` ya existe (`insert ... onConflictDoNothing`), no insertar duplicados en `sale_payments`; la búsqueda posterior debe traer `with: { payments: true }`.
- `src/application/services/orderService.ts`: `convertOrderToSale` y la interfaz `ConvertOrderInput` deben recibir y pasar el arreglo de partes.
- `src/application/services/summaryService.ts`: el tipo `SaleWithItems` debe incluir `payments: PaymentPart[]`; `calculateSummaryFromSales` debe sumar por método.
- `src/application/services/closureService.ts`: las queries de ventas deben incluir `with: { payments: true }`.

### API y validaciones

- `src/lib/zod-schemas.ts`: reemplazar `paymentMethod` en `saleSchema` y `orderConfirmSchema` por un esquema de partes (`payments: z.array(...).min(1)`). Validar que cada monto sea > 0 y que la suma coincida con el total (si el total está disponible en el esquema; de lo contrario, validar en el servicio).
- `src/app/api/ventas/route.ts` y `src/app/api/pedidos/[id]/confirmar/route.ts`: recibir `payments` y pasarlo a los servicios.

### Repositorios

- `src/repositories/saleRepository.ts`: `create` y las queries `findById`, `findByDateRange`, `findByCashRegisterId` deben soportar `payments`. En la inserción, insertar la venta y sus partes de forma atómica.

### Frontend

- `src/components/ventas/sales-terminal.tsx`: reemplazar el selector binario por un componente de partes de pago con inputs de monto, calcular el restante y validar la suma antes de confirmar.
- `src/components/pedidos/pedido-actions.tsx` y `src/components/pedidos/usePedidoDetail.ts`: mismo componente de partes de pago; `handleConfirm` debe enviar `payments`.
- `src/components/ventas/sales-history.tsx`: mostrar el desglose de medios.
- `src/components/caja/cash-register-summary.tsx` y `src/components/cierre/closure-panel.tsx`: no requieren cambios visuales si el backend sigue entregando totales, pero verificar que estos provengan del desglose.

### Tipos

- `src/domain/types.ts`: definir `PaymentPart = { method: PaymentMethod; amount: number }`. `PaymentMethod` sigue siendo `'cash' | 'transfer'`.

### Tests

- Actualizar tests unitarios de `saleService`, `orderService`, `summaryService`, `closureService`, `cashRegisterService`, `saleRepository`, `zod-schemas`, `sales-terminal`.
- Actualizar tests de rutas API `ventas/route.test.ts` y `pedidos/[id]/confirmar/route.test.ts`.
- Agregar casos de pago mixto, anulación con pago mixto, cierre diario con pago mixto y compatibilidad histórica.
- Actualizar tests E2E que toquen ventas o pedidos (`validaciones-y-papelera.spec.ts`, `paso4.spec.ts`, `stock-y-movimientos.spec.ts`, etc.), siguiendo las reglas de `AGENTS.md` para la base de prueba.

## Criterios de aceptación

- [ ] En `/ventas` se puede vender un carrito pagando, por ejemplo, $500 en efectivo y $1500 en transferencia por un total de $2000.
- [ ] En `/pedidos/[id]` se puede confirmar el pago de un pedido con la misma división.
- [ ] `cash_registers.cashTotal` y `cash_registers.transferTotal` reflejan exactamente lo pagado en cada medio.
- [ ] El cierre diario (`dailyClosures`) refleja el desglose exacto de medios.
- [ ] Al anular la venta, los totales de caja se revierten correctamente.
- [ ] Si los montos no suman el total, el backend rechaza y la UI muestra el error.
- [ ] El historial de ventas muestra el desglose de medios.
- [ ] No se rompen las ventas históricas con un solo método de pago.
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm test` pasan.
- [ ] Existe migración de Drizzle para el cambio de esquema.

## Restricciones

- No hardcodear credenciales, URLs ni parámetros sensibles.
- No modificar políticas de rate-limit, autenticación ni permisos de sucursal.
- Respetar transacciones (`executeInTransaction`) y bloqueos de caja.
- Mantener soft-delete y validación de registros eliminados.
- Documentar decisiones no triviales en `AGENTS.md` o `.devin/informes/lecciones-aprendidas.md` si aplica.

## Consideraciones de seguridad y entorno

- `DATABASE_URL` y `DATABASE_URL_UNPOOLED` deben apuntar a la base correcta. No usar producción para pruebas.
- `npm run test:e2e` y `npx drizzle-kit push` solo en base de datos descartable (`test`, `e2e`, `testing`, `qa` o `staging`).
- No commitear `.env.local` ni `.env.e2e`.
- Respaldar la base de datos antes de empujar migraciones en producción (ver `.devin/informes/entornos.md`).

## Verificaciones

Antes de declarar terminado, ejecutar:

1. `npm run lint`
2. `npx tsc --noEmit`
3. `npm test`
4. `npm run build`
5. `npx drizzle-kit check` (con base de prueba)
6. `npm run test:e2e` solo en base descartable y con confirmación.
