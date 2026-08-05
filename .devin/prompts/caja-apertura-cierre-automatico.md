# Prompt: Sistema de Caja con Apertura, Cierre Automático e Historial

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos y cierre de caja para una panchería.

Stack:

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS v4 (`@import "tailwindcss"` + `@theme inline`)
- shadcn/ui v4 (componentes en `src/components/ui/*` basados en `@base-ui/react`)
- Drizzle ORM con PostgreSQL (Neon)
- NextAuth v5
- Patrón de arquitectura: repositorios + servicios de aplicación + dominio

Estado actual relevante:

- La tabla `sales` no está vinculada a ninguna sesión de caja.
- Existe `dailyClosures` y una pantalla `/cierre` basada en fechas de calendario.
- El flujo de ventas descuenta stock correctamente y soporta anulaciones con reintegro.
- No hay control de caja antes de vender.

## Objetivo

Implementar el concepto de **caja** como una sesión de ventas que tiene un inicio (apertura) y un fin (cierre manual o automático). Cada venta queda asociada a la caja que esté abierta al momento de confirmarse. La caja se cierra automáticamente si pasa más de 12 horas desde su apertura. El historial de cierres de caja se almacena con sus fechas, ventas, totales y consumo de insumos críticos.

## Requisitos funcionales

1. Solo puede haber **una caja abierta a la vez**.
2. Antes de confirmar cualquier venta, el sistema debe comprobar que haya una caja abierta. Si no la hay, la venta se rechaza con un mensaje claro.
3. En la sección de ventas debe verse el estado de la caja:
   - Si está abierta: hora de apertura, tiempo transcurrido y tiempo restante antes del cierre automático.
   - Si está cerrada o no existe: mensaje y botón para abrir caja.
4. Debe poder abrirse una caja nueva desde la interfaz de ventas.
5. Debe poder cerrarse la caja manualmente desde la interfaz de ventas (y también desde la sección de cierre/historial).
6. Al cerrar una caja se deben calcular y almacenar:
   - Fecha y hora de apertura y cierre.
   - Total vendido, total en efectivo y total en transferencia.
   - Cantidad de ventas.
   - Resumen de productos vendidos.
   - Resumen de insumos críticos consumidos.
   - Usuario que abrió y usuario que cerró (o "Sistema" si fue automático).
7. Cierre automático: si una caja lleva 12 horas o más abiertas, el sistema debe cerrarla automáticamente. La fecha de cierre debe quedar registrada exactamente como `openedAt + 12 horas`.
8. El horario real del negocio es 19:30 a 03:00, por lo que una caja puede cruzar la medianoche. El cierre automático a las 12 horas es un mecanismo de seguridad.
9. Historial de cierres de caja con sus respectivas fechas, ventas, totales y consumo.
10. Las ventas y anulaciones deben seguir funcionando igual, pero vinculadas a la caja activa.
11. Los movimientos de stock ya están vinculados a `saleId`, por lo que indirectamente quedan asociados a la caja a través de la venta.

## Modelo de datos

Agregar en `src/db/schema.ts`:

```typescript
export const cashRegisterStatusEnum = pgEnum('cash_register_status', [
  'open',
  'closed',
]);

export const cashRegisters = pgTable(
  'cash_registers',
  {
    id: serial('id').primaryKey(),
    openedAt: timestamp('opened_at').defaultNow().notNull(),
    closedAt: timestamp('closed_at'),
    openedBy: varchar('opened_by', { length: 255 }).notNull(),
    closedBy: varchar('closed_by', { length: 255 }),
    status: cashRegisterStatusEnum('status').default('open').notNull(),
    autoClosed: boolean('auto_closed').default(false).notNull(),
    total: numeric('total', { precision: 10, scale: 2, mode: 'number' }).default(0).notNull(),
    cashTotal: numeric('cash_total', { precision: 10, scale: 2, mode: 'number' }).default(0).notNull(),
    transferTotal: numeric('transfer_total', { precision: 10, scale: 2, mode: 'number' }).default(0).notNull(),
    totalSales: integer('total_sales').default(0).notNull(),
    productsSummary: text('products_summary').default('{}').notNull(),
    criticalSuppliesSummary: text('critical_supplies_summary').default('{}').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    statusIdx: index('cash_registers_status_idx').on(table.status),
    openedAtIdx: index('cash_registers_opened_at_idx').on(table.openedAt),
  })
);
```

Modificar la tabla `sales`:

```typescript
export const sales = pgTable(
  'sales',
  {
    id: serial('id').primaryKey(),
    total: numeric('total', { precision: 10, scale: 2, mode: 'number' }).notNull(),
    paymentMethod: paymentMethodEnum('payment_method').notNull(),
    status: saleStatusEnum('status').default('active').notNull(),
    cashRegisterId: integer('cash_register_id').references(() => cashRegisters.id),
    idempotencyKey: varchar('idempotency_key', { length: 255 }).unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    cancelledAt: timestamp('cancelled_at'),
    cancellationReason: text('cancellation_reason'),
  },
  (table) => ({
    createdAtIdx: index('sales_created_at_idx').on(table.createdAt),
    cashRegisterCreatedAtIdx: index('sales_cash_register_created_at_idx').on(
      table.cashRegisterId,
      table.createdAt
    ),
  })
);
```

Agregar relaciones:

```typescript
export const cashRegistersRelations = relations(cashRegisters, ({ many }) => ({
  sales: many(sales),
}));

export const salesRelations = relations(sales, ({ one, many }) => ({
  cashRegister: one(cashRegisters, {
    fields: [sales.cashRegisterId],
    references: [cashRegisters.id],
  }),
  items: many(saleItems),
  stockMovements: many(stockMovements),
}));
```

### Notas sobre migración de datos existentes

- `cashRegisterId` en `sales` debe ser **nullable** para no romper las ventas históricas.
- La tabla `daily_closures` no se elimina; se deja como histórico. El nuevo flujo usa `cash_registers`.
- Opcionalmente, se puede crear una migración de datos que genere cajas históricas por día y asigne las ventas existentes, pero esto queda como paso separado y manual.

## Servicios de aplicación

Crear `src/application/services/cashRegisterService.ts` con las siguientes funciones:

- `getOpenCashRegister(): Promise<CashRegister | null>`
  - Busca la caja con `status = 'open'`.
  - Si existe y `openedAt + 12h <= now`, la cierra automáticamente con `closedAt = openedAt + 12h`, `autoClosed = true`, `closedBy = 'Sistema'` y devuelve `null`.
  - Si no existe caja abierta, devuelve `null`.

- `openCashRegister(openedBy: string): Promise<CashRegister>`
  - Verifica que no haya una caja abierta.
  - Crea una caja con `openedAt = now`, `status = 'open'`, `openedBy`.

- `closeCashRegister(id: number, closedBy: string): Promise<CashRegister>`
  - Busca la caja por ID.
  - Recupera todas las ventas `active` con `cashRegisterId = id`.
  - Calcula totales, medios de pago, cantidad de ventas, productos vendidos e insumos críticos consumidos (misma lógica que `closureService.generateClosure`, pero filtrando por `cashRegisterId` en lugar de rango de fechas).
  - Actualiza la caja con `status = 'closed'`, `closedAt = now`, `closedBy`, y los resúmenes calculados.
  - Retorna la caja actualizada.

- `getCurrentCashRegister(): Promise<CashRegister | null>`
  - Alias de `getOpenCashRegister()`.

- `getCashRegisterById(id: number): Promise<CashRegister | null>`
  - Devuelve la caja con sus ventas e ítems.

- `listCashRegisterHistory(start: Date, end: Date): Promise<CashRegister[]>`
  - Lista cajas con `status = 'closed'` cuyo `openedAt` esté dentro del rango.
  - Orden descendente por `openedAt`.

- `autoCloseIfNeeded(): Promise<CashRegister | null>`
  - Wrapper explícito que ejecuta `getOpenCashRegister()` y fuerza el cierre automático si aplica.

### Modificaciones a servicios existentes

`src/application/services/saleService.ts`:

- Al inicio de `confirmSale`, llamar a `getOpenCashRegister()` (o `autoCloseIfNeeded()`).
- Si devuelve `null`, lanzar `ValidationError('No hay una caja abierta. Abrí la caja para comenzar a vender.')`.
- Asignar `cashRegisterId` al insertar la venta.
- Las anulaciones (`cancelSale`) no cambian de caja; la venta conserva su `cashRegisterId` y el stock se reintegra normalmente.

`src/repositories/saleRepository.ts`:

- `findByDateRange` puede seguir existiendo, pero agregar `findByCashRegisterId(cashRegisterId, status?)` para filtrar por caja.
- Actualizar `create` para soportar `cashRegisterId`.

`src/domain/types.ts`:

- Agregar `CashRegister` y `CashRegisterStatus`.
- Actualizar `Sale` para incluir `cashRegisterId` y `cashRegister` opcional.

## Endpoints de API

Crear o modificar:

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/caja` | Estado de la caja actual (abierta/cerrada). |
| POST | `/api/caja/abrir` | Abrir una nueva caja. |
| POST | `/api/caja/cerrar` | Cerrar la caja actual. |
| GET | `/api/caja/historial` | Listar cierres de caja en un rango de fechas. |
| GET | `/api/caja/[id]` | Detalle de una caja cerrada. |

- Modificar `POST /api/ventas` para validar caja abierta antes de confirmar. Si no hay caja, retornar 400 con el mensaje correspondiente.
- Modificar `GET /api/ventas` para soportar `?cashRegisterId=` y mostrar ventas de una caja específica.
- Mantener `/api/cierre` y `/api/cierre/historial` o redirigirlos a los nuevos endpoints de caja, según la decisión de UI.

## UI/UX

### `/ventas`

- Mostrar un banner o panel superior con el estado de la caja.
- Si no hay caja abierta:
  - Mensaje: "No hay una caja abierta. Abrí una caja para comenzar a vender."
  - Botón grande "Abrir caja".
  - Deshabilitar el carrito y el botón "Confirmar venta".
- Si hay caja abierta:
  - Mostrar: "Caja abierta desde HH:MM (hace Xh Ym)".
  - Mostrar tiempo restante antes del cierre automático: "Se cierra automáticamente en Xh Ym".
  - Botón "Cerrar caja".
- Al confirmar una venta, si la caja se cerró automáticamente en el medio del proceso, mostrar el error y refrescar el estado.

### `/cierre` (cambiar a `/caja` o mantener `/cierre` según convenga)

- Mostrar el estado de la caja actual.
- Si está abierta: botón "Cerrar caja" y resumen parcial.
- Si está cerrada: resumen completo con totales, ventas, productos e insumos.
- Link a historial.

### `/cierre/historial` o `/caja/historial`

- Tabla con las cajas cerradas.
- Columnas: apertura, cierre, duración, ventas, total, efectivo, transferencia, cierre automático (sí/no).
- Al hacer click en una fila, mostrar detalle completo.

### Navegación

- Actualizar `PanelHeader` si se renombra la ruta `/cierre` a `/caja`.
- De lo contrario, mantener `/cierre` y `/cierre/historial`.

## Reglas de negocio detalladas

1. **Unicidad de caja abierta**: no se puede abrir una nueva caja si ya existe una abierta. El servicio debe lanzar `ValidationError('Ya existe una caja abierta.')`.
2. **Bloqueo de ventas**: `confirmSale` debe fallar si no hay caja abierta, incluso si el carrito y el stock son válidos.
3. **Auto-cierre exacto**: el cierre automático se calcula como `openedAt + 12 horas`. Si una caja abierta supera ese límite, cualquier operación que consulte el estado de la caja debe cerrarla y considerarla cerrada.
4. **Ventas vinculadas**: toda venta nueva debe almacenar `cashRegisterId`.
5. **Anulaciones**: al anular una venta, se mantiene el `cashRegisterId` original. Si la caja ya está cerrada, el cierre no se recalcula (el cierre queda inmutable para el historial).
6. **Resumen de cierre**: al cerrar una caja, calcular totales sobre las ventas `active` con `cashRegisterId` igual a la caja que se cierra, usando la misma lógica de insumos críticos que `closureService.generateClosure`.
7. **Duración**: en historial, mostrar la duración como `closedAt - openedAt`. Si `closedAt` es `openedAt + 12h` por cierre automático, la duración será exactamente 12 horas.

## Cálculo de resumen de caja

Al cerrar una caja, iterar todas las ventas `active` de esa caja y para cada una:

1. Acumular el total en efectivo o transferencia.
2. Acumular la cantidad de productos vendidos por nombre.
3. Si el producto es compuesto, iterar su receta y acumular los insumos con `autoDiscount = true`.
4. Si el producto es `critical_supply` tipo `beverage`, acumular la cantidad vendida bajo el nombre del producto.
5. Asegurar que todos los insumos críticos activos aparezcan en el resumen, aunque la cantidad sea 0.

Guardar `productsSummary` y `criticalSuppliesSummary` como `JSON.stringify(...)`.

## Manejo de fechas

- Usar `timestamp` (sin zona horaria) igual que el resto del esquema para mantener consistencia.
- Mostrar fechas y duraciones en hora local de Argentina usando `date-fns` (ya está en dependencias).
- Las cajas pueden cruzar la medianoche; no usar fecha como clave del cierre.

## Tests

1. **Tests unitarios**: crear `src/application/services/cashRegisterService.test.ts`.
   - Apertura de caja.
   - Rechazo de doble apertura.
   - Cierre manual y cálculo de resumen.
   - Cierre automático a las 12 horas.
   - `confirmSale` rechaza venta sin caja.
   - `confirmSale` vincula venta a caja abierta.
2. **Tests de API**: agregar tests de los nuevos endpoints si el proyecto tiene infraestructura para ello.
3. **Tests E2E** (opcional): flujo completo de abrir caja, vender, cerrar caja y ver historial.

## Archivos a crear o modificar

Nuevos:

```
src/db/schema.ts (modificar)
src/domain/types.ts (modificar)
src/domain/errors.ts (modificar si es necesario agregar NoOpenCashRegisterError)
src/lib/zod-schemas.ts (modificar si es necesario)
src/repositories/cashRegisterRepository.ts (nuevo)
src/application/services/cashRegisterService.ts (nuevo)
src/application/services/cashRegisterService.test.ts (nuevo)
src/app/api/caja/route.ts (nuevo)
src/app/api/caja/abrir/route.ts (nuevo)
src/app/api/caja/cerrar/route.ts (nuevo)
src/app/api/caja/historial/route.ts (nuevo)
src/app/api/caja/[id]/route.ts (nuevo, opcional)
src/components/caja/caja-status.tsx (nuevo)
src/components/caja/caja-panel.tsx (nuevo)
src/components/caja/caja-history.tsx (nuevo)
```

A modificar:

```
src/app/api/ventas/route.ts
src/application/services/saleService.ts
src/repositories/saleRepository.ts
src/components/ventas/sales-terminal.tsx
src/app/(panel)/ventas/page.tsx
src/app/(panel)/cierre/page.tsx
src/app/(panel)/cierre/historial/page.tsx
src/components/cierre/closure-panel.tsx
src/components/cierre/closure-history.tsx
src/components/panel/panel-header.tsx
```

## Migración de base de datos

1. Ejecutar `npx drizzle-kit generate` para generar la migración.
2. Revisar el archivo SQL generado.
3. Ejecutar `npx drizzle-kit push` para aplicar la migración en la base de datos de desarrollo.
4. Verificar que `cashRegisterId` en `sales` es nullable y que no se pierde datos.

## Validación

1. `npx drizzle-kit generate` y `npx drizzle-kit push` sin errores.
2. `npm run build` sin errores de tipo ni de lint.
3. `npm run lint` limpio.
4. `npm test` con todos los tests pasando.
5. `npx playwright test` si se agregaron tests E2E.
6. Probar flujo manual:
   - Abrir caja.
   - Confirmar una venta.
   - Ver que la venta quedó en la caja.
   - Cerrar caja y ver resumen.
   - Ver historial con el cierre.
   - Simular caja abierta hace más de 12 horas y verificar que se cierra automáticamente y no permite vender.

## Restricciones del proyecto

- Todo el texto visible debe estar en español.
- No hardcodear credenciales, URLs ni valores sensibles.
- Mantener el estilo visual oscuro y minimalista del proyecto.
- No eliminar la tabla `daily_closures` ni sus datos; dejarla como histórico.
- Seguir el patrón repositorio → servicio → API → componente ya establecido.
- No modificar la lógica de autenticación más allá de leer `session.user.name` para `openedBy`/`closedBy`.

## Resultado esperado

Un sistema de caja por sesión que obliga a abrir una caja antes de vender, la cierra automáticamente a las 12 horas, y permite consultar el historial de cierres con sus totales, ventas e insumos consumidos.
