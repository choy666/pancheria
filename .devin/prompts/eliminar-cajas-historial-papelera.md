# Prompt: Eliminar cajas y gestionar papelera en `/ventas/historial`

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos y cierre de caja para una panchería.

Stack:

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui v4
- Drizzle ORM con PostgreSQL (Neon)
- NextAuth v5
- Patrón de arquitectura: repositorios + servicios de aplicación + dominio

Estado actual relevante:

- `src/app/(panel)/ventas/historial/page.tsx` lista los cierres de caja mediante `src/components/caja/caja-history.tsx`.
- `src/app/(panel)/ventas/historial/[id]/page.tsx` muestra el detalle de una caja y sus ventas usando `src/components/ventas/sales-history.tsx`.
- `src/components/caja/caja-history.tsx` es el componente cliente reutilizable que consulta `/api/caja/historial` y navega a la ruta de detalle indicada por `detailRoute`.
- La tabla `cash_registers` no posee eliminación lógica ni física; una vez creada, no puede quitarse del historial.
- El proyecto ya usa soft delete en `products` (`deletedAt`) con métodos `softDelete` y `restore` en `productRepository`. No hay papelera ni hard delete de productos en la UI, pero el patrón de repositorio sirve como referencia para implementar la misma lógica en cajas.

## Objetivo

Agregar la posibilidad de **eliminar cajas** desde el historial de cierres de caja y crear una **sección aparte (papelera)** donde se puedan ver, restaurar, eliminar definitivamente y vaciar las cajas eliminadas.

Navegación esperada:

- `/ventas/historial`: listado de cajas activas con acción "Eliminar" en cada fila y enlace a "Cajas eliminadas".
- `/ventas/historial/[id]`: detalle de caja con botón "Eliminar" (si no está eliminada).
- `/ventas/historial/eliminadas`: listado de cajas eliminadas con acciones "Restaurar", "Eliminar definitivamente" y botón "Vaciar papelera".
- El detalle de una caja eliminada debe poder visualizarse desde la papelera con un indicador claro y las acciones correspondientes.

## Requisitos funcionales

1. El historial normal (`/ventas/historial`) **no debe mostrar cajas eliminadas**.
2. Cada fila del historial normal debe tener una acción "Eliminar" que realice un **soft delete**.
3. El detalle de caja (`/ventas/historial/[id]`) debe incluir la acción "Eliminar" cuando la caja no esté eliminada.
4. No se puede eliminar una caja que esté **abierta**. El servicio debe rechazar la operación y mostrar un error claro.
5. La papelera (`/ventas/historial/eliminadas`) debe listar únicamente cajas eliminadas y permitir:
   - **Restaurar** una caja individual (volver al historial normal).
   - **Eliminar definitivamente** una caja individual (hard delete).
   - **Vaciar papelera** (hard delete de todas las cajas eliminadas que cumplan el rango de fechas mostrado).
6. Al eliminar definitivamente una caja, las ventas vinculadas deben **desvincularse** (`cashRegisterId = null`) antes de borrar la caja, para conservar las ventas y evitar errores de clave foránea.
7. Las cajas eliminadas **no deben aparecer** en `/cierre`, `/cierre/historial`, el cálculo de caja abierta ni ningún listado operativo.
8. En la papelera, las ventas de una caja eliminada se muestran en modo solo lectura: sin acción de anular.
9. Todos los textos, URLs y configuraciones deben provenir de las fuentes centralizadas del proyecto (`src/config/api.ts`, `src/config/caja.ts`, variables de entorno, etc.).

## Modelo de datos

### Esquema (`src/db/schema.ts`)

Agregar a la tabla `cash_registers` un campo de eliminación lógica, siguiendo el patrón de `products`:

```typescript
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
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    statusIdx: index('cash_registers_status_idx').on(table.status),
    openedAtIdx: index('cash_registers_opened_at_idx').on(table.openedAt),
    deletedAtIdx: index('cash_registers_deleted_at_idx').on(table.deletedAt),
  })
);
```

Actualizar `src/domain/types.ts` para reflejar `deletedAt` en `CashRegister`:

```typescript
export type CashRegister = {
  id: number;
  openedAt: Date;
  closedAt: Date | null;
  openedBy: string;
  closedBy: string | null;
  status: CashRegisterStatus;
  autoClosed: boolean;
  total: Money;
  cashTotal: Money;
  transferTotal: Money;
  totalSales: number;
  productsSummary: Record<string, number>;
  criticalSuppliesSummary: Record<string, number>;
  createdAt: Date;
  deletedAt: Date | null;
  sales?: Sale[];
};
```

### Migraciones

Generar y aplicar migraciones solo en entornos autorizados:

```bash
npx drizzle-kit generate
npx drizzle-kit push
```

## Implementación detallada

### 1. Repositorio de cajas (`src/repositories/cashRegisterRepository.ts`)

Actualizar y agregar funciones. Reutilizar un helper interno para armar condiciones si es posible, pero mantener las consultas públicas separadas para evitar mezclar semánticas (el historial filtra por `openedAt`; la papelera filtra por `deletedAt`).

> **Nota:** el repositorio actual importa `eq, and, desc, gte, lte`. Para las nuevas funciones agregar `isNull`, `isNotNull`, `inArray` y, si se implementa `hardDeleteAllDeletedInRange` en el repositorio, `executeInTransaction`.

- `findOpen()`: filtrar por `eq(cashRegisters.status, 'open')` y `isNull(cashRegisters.deletedAt)`.
- `findById(id, includeDeleted = false)`: si `includeDeleted` es falso, excluir cajas con `deletedAt` no nulo. Retornar `null` si no existe.
- `findInRange(start, end, status?)`: listar cajas **no eliminadas** cuya `openedAt` esté en el rango. Opcionalmente filtrar por `status`.
- `findDeletedInRange(start, end)`: listar cajas **eliminadas** cuya `deletedAt` esté en el rango, ordenadas descendentemente por `deletedAt`. El filtro debe ser sobre `deletedAt`, no sobre `openedAt`.
- `softDelete(id)`: actualizar `deletedAt` con la fecha actual y retornar el registro afectado o `null`.
- `restore(id)`: limpiar `deletedAt` y retornar el registro afectado o `null`.
- `hardDelete(id)`: dentro de una transacción:
  1. Verificar que la caja tenga `deletedAt` no nulo (el servicio también lo valida).
  2. Desvincular las ventas: `UPDATE sales SET cash_register_id = NULL WHERE cash_register_id = id`.
  3. Eliminar la caja: `DELETE FROM cash_registers WHERE id = id`.
  4. Retornar un indicador de éxito, por ejemplo `{ deleted: true }`.
- `hardDeleteAllDeletedInRange(start, end)`: dentro de una transacción, obtener los IDs de cajas eliminadas cuya `deletedAt` esté en el rango, desvincular las ventas asociadas y eliminar las cajas. Usar `executeInTransaction` con Drizzle en lugar de SQL crudo si es posible:
  ```ts
  return executeInTransaction(async (tx) => {
    const rows = await tx
      .select({ id: cashRegisters.id })
      .from(cashRegisters)
      .where(
        and(
          isNotNull(cashRegisters.deletedAt),
          gte(cashRegisters.deletedAt, start),
          lte(cashRegisters.deletedAt, end)
        )
      );

    if (rows.length === 0) {
      return { deleted: 0 };
    }

    const ids = rows.map((row) => row.id);

    await tx
      .update(sales)
      .set({ cashRegisterId: null })
      .where(inArray(sales.cashRegisterId, ids));

    await tx
      .delete(cashRegisters)
      .where(inArray(cashRegisters.id, ids));

    return { deleted: ids.length };
  });
  ```

### 2. Servicio de cajas (`src/application/services/cashRegisterService.ts`)

Agregar métodos delegados en el repositorio con validaciones de negocio:

- `deleteCashRegister(id)`: obtener la caja con `findById(id)` (sin incluir eliminadas). Si no existe, lanzar `NotFoundError('Caja', id)`. Si está `open`, lanzar `ValidationError('No se puede eliminar una caja abierta.')`. Luego llamar `cashRegisterRepository.softDelete(id)`.
- `restoreCashRegister(id)`: obtener la caja con `findById(id, true)`. Si no existe o ya no está eliminada, lanzar `ValidationError`. Luego llamar `cashRegisterRepository.restore(id)`.
- `permanentlyDeleteCashRegister(id)`: obtener la caja con `findById(id, true)`. Si no existe o no está eliminada, lanzar `ValidationError`. Luego llamar `cashRegisterRepository.hardDelete(id)`.
- `listDeletedCashRegisterHistory(start, end)`: llamar `cashRegisterRepository.findDeletedInRange(start, end)`.
- `emptyTrash(start, end)`: llamar `cashRegisterRepository.hardDeleteAllDeletedInRange(start, end)`.
- Actualizar `getCashRegisterById(id, includeDeleted = false)` para permitir consultar cajas eliminadas cuando se accede desde la papelera.
- Actualizar `getOpenCashRegister` para asegurar que `findOpen` excluya eliminadas.

### 3. Endpoints API

Actualizar y crear los siguientes endpoints. Todos requieren autenticación (`requireAuth`) y manejar `UnauthorizedError`, `NotFoundError`, `ValidationError` y errores 500.

#### `src/app/api/caja/[id]/route.ts`

Agregar el método `DELETE` para soft delete de la caja. Validar que exista y que no esté abierta.

```ts
export async function DELETE(_request: NextRequest, { params }: RouteParams) { ... }
```

#### `src/app/api/caja/[id]/restaurar/route.ts` (nuevo)

- `POST`: restaurar una caja eliminada. Delegar en `cashRegisterService.restoreCashRegister(id)`.

```ts
export async function POST(_request: NextRequest, { params }: RouteParams) { ... }
```

#### `src/app/api/caja/[id]/permanente/route.ts` (nuevo)

- `DELETE`: hard delete definitivo de la caja. Solo debe actuar sobre cajas ya eliminadas (la validación vive en el servicio).

#### `src/app/api/caja/eliminadas/route.ts` (nuevo)

- `GET`: listar cajas eliminadas por rango de fechas de **eliminación** (`deletedAt`). Usar `subDays(end, DEFAULT_CAJA_HISTORY_DAYS)` como valor por defecto.
- `DELETE`: vaciar la papelera (hard delete de todas las cajas eliminadas cuya `deletedAt` esté en el rango de fechas recibido).

#### `src/app/api/caja/historial/route.ts`

Asegurar que el listado de cajas históricas **excluya** las eliminadas. El servicio subyacente ya debe filtrarlas, pero verificar que el endpoint no envíe un parámetro que las incluya.

#### `src/config/api.ts`

Agregar constantes centralizadas:

```typescript
export const CAJA_API = '/api/caja';
export const CAJA_ELIMINADAS_API = '/api/caja/eliminadas';
```

Reutilizar `CAJA_HISTORIAL_API` y `CAJA_API` para las operaciones de una caja (por ejemplo, `${CAJA_API}/${id}`, `${CAJA_API}/${id}/restaurar`, `${CAJA_API}/${id}/permanente`).

### 4. Componente de listado reutilizable (`src/components/caja/caja-history.tsx`)

**No crear un componente duplicado.** Extender `CajaHistory` para soportar el modo papelera y las acciones.

Nuevas props sugeridas:

```typescript
interface CajaHistoryProps {
  detailRoute?: string;
  statusFilter?: 'all' | 'closed';
  showAutoColumn?: boolean;
  deletedOnly?: boolean;
  onDelete?: (id: number) => Promise<void>;
  onRestore?: (id: number) => Promise<void>;
  onPermanentDelete?: (id: number) => Promise<void>;
  onEmptyTrash?: (start: string, end: string) => Promise<void>;
}
```

Comportamiento:

- Si `deletedOnly` es `true`, consultar `CAJA_ELIMINADAS_API`; de lo contrario, `CAJA_HISTORIAL_API`.
- En modo papelera (`deletedOnly = true`) no se envía el `statusFilter` al endpoint, porque la papelera filtra por `deletedAt`, no por `status`.
- El rango de fechas por defecto (`start` y `end`) debe provenir de `DEFAULT_CAJA_HISTORY_DAYS` en `src/config/caja.ts` en lugar de hardcodear `30`.
- El `useEffect` que carga los datos debe depender de `statusFilter`, `deletedOnly` y de un `refreshKey` local. La función `load()` debe estar definida en el cuerpo del componente (no dentro del `useEffect`) para poder invocarla desde los handlers.
- Tras cualquier acción (`onDelete`, `onRestore`, `onPermanentDelete`), el componente debe volver a ejecutar su propia función de carga (`load()`) para reflejar los cambios. `router.refresh()` no es suficiente porque `CajaHistory` es un Client Component.
- En modo papelera, el botón "Vaciar papelera" invoca `onEmptyTrash(start, end)` con las fechas del rango actual en formato ISO (o, si no se provee handler, realiza el `fetch` directamente a `CAJA_ELIMINADAS_API`).
- Manejar errores de los handlers mostrando un mensaje en la UI y sin romper la navegación.
- Mostrar un botón de acciones al final de cada fila. Si la fila hace `router.push()` al hacer clic, los botones deben detener la propagación (`event.stopPropagation()`).
- En modo historial (`deletedOnly = false`): mostrar acción "Eliminar".
- En modo papelera (`deletedOnly = true`): mostrar acciones "Restaurar", "Eliminar definitivamente".
- En modo papelera, agregar un encabezado o botón superior para "Vaciar papelera".
- Reutilizar los estilos y clases existentes (`border-white/8`, `font-mono`, badges, etc.).

### 5. Acciones de la UI

**Opción recomendada**: crear un componente `src/components/caja/cash-register-actions.tsx` (cliente) que reciba el modo y los handlers para las acciones por fila. Así `caja-history.tsx` no se encarga de la lógica de confirmación ni de las llamadas HTTP por cada caja.

Comportamiento de los botones por fila:

- **Eliminar**: `confirm('¿Eliminar la caja #N? Se moverá a la papelera.')`, luego `DELETE ${CAJA_API}/${id}`, y finalmente ejecutar la función de recarga del listado.
- **Restaurar**: `confirm('¿Restaurar la caja #N?')`, luego `POST ${CAJA_API}/${id}/restaurar`, y recargar el listado.
- **Eliminar definitivamente**: `confirm('¿Eliminar definitivamente la caja #N? Esta acción no se puede deshacer.')`, luego `DELETE ${CAJA_API}/${id}/permanente`, y recargar el listado.

El botón **Vaciar papelera** vive en el encabezado de `CajaHistory` y realiza `DELETE ${CAJA_ELIMINADAS_API}?start=<inicio>&end=<fin>` con el rango de fechas de eliminación actual, seguido de la recarga del listado.

**Importante:** `router.refresh()` invalida Server Components; `CajaHistory` es un Client Component, por lo que los handlers deben terminar invocando la función interna de recarga de datos del componente (por ejemplo, volviendo a llamar a `load()`).

Los handlers pueden pasarse como server actions o como funciones `async`. Si se usan server actions (`'use server'`), usar `revalidatePath('/ventas/historial')` y `revalidatePath('/ventas/historial/eliminadas')` según corresponda, pero el componente cliente aún debe recargar su propio estado.

### 6. Páginas

#### `src/app/(panel)/ventas/historial/page.tsx`

Agregar un enlace o pestaña a la papelera junto al título:

```tsx
<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
  <h1 className="text-2xl font-semibold tracking-tight">Historial de cierres de caja</h1>
  <Link href="/ventas/historial/eliminadas">
    <Button variant="outline">Cajas eliminadas</Button>
  </Link>
</div>
```

Renderizar `CajaHistory` con `detailRoute="/ventas/historial"`, `statusFilter="all"` y `onDelete` definido. El handler puede ser una server action o una función `async` que, tras ejecutarse, permita que `CajaHistory` vuelva a cargar sus datos.

#### `src/app/(panel)/ventas/historial/[id]/page.tsx`

- Esta página es un Server Component. Los botones de acción deben implementarse con un Client Component o con Server Actions (`<form action={...}>`); no se puede usar `onClick` directamente aquí.
- Llamar a `cashRegisterService.getCashRegisterById(Number(id), true)` para permitir mostrar cajas eliminadas si se accede desde la papelera.
- Si la caja no existe, `notFound()`.
- Si la caja está eliminada, mostrar un banner claro: "Esta caja fue eliminada" y **no calcular el resumen en tiempo real** (evitar recalcular sobre una caja eliminada).
- Agregar botones de acción en el encabezado:
  - Caja no eliminada: "Eliminar".
  - Caja eliminada: "Restaurar" y "Eliminar definitivamente".
- Pasar `allowCancel={!cashRegister.deletedAt}` a `SalesHistory` para deshabilitar la anulación en cajas eliminadas.
- El enlace "Volver al historial" puede apuntar a `/ventas/historial` por defecto. Si se desea volver a la papelera cuando el usuario llegó desde ella, usar el `referer` o un parámetro de consulta (por ejemplo, `?from=papelera`).

#### `src/app/(panel)/ventas/historial/eliminadas/page.tsx` (nuevo)

- Título: "Cajas eliminadas".
- Enlace para volver a "Historial de cierres de caja".
- Renderizar `CajaHistory` con `deletedOnly={true}`, `detailRoute="/ventas/historial"` y handlers `onRestore`, `onPermanentDelete`, `onEmptyTrash`.

### 7. Componente `SalesHistory`

Agregar una prop opcional `allowCancel?: boolean` con valor por defecto `true`. Si es `false`, ocultar la columna/botón de anulación. Esto evita crear un componente duplicado para el modo papelera.

```typescript
interface SalesHistoryProps {
  sales: Sale[];
  allowCancel?: boolean;
}
```

### 8. Navegación

Actualizar `src/components/panel/panel-header.tsx` si se considera necesario. Opcional: agregar un submenú o un ítem "Cajas eliminadas" bajo "Historial". Si se agrega al menú principal, mantener la lista actual de `navItems` lo más limpia posible; preferir un enlace dentro de `/ventas/historial` para no saturar el header.

## Archivos a modificar o crear

### Modificar

- `src/db/schema.ts` — agregar `deletedAt` e índice a `cash_registers`.
- `src/domain/types.ts` — agregar `deletedAt` a `CashRegister`.
- `src/repositories/cashRegisterRepository.ts` — soft delete, restore, hard delete, listado de eliminadas.
- `src/application/services/cashRegisterService.ts` — métodos de negocio para eliminar/restaurar/vaciar.
- `src/app/api/caja/[id]/route.ts` — agregar `DELETE` para soft delete de una caja.
- `src/app/api/caja/historial/route.ts` — asegurar exclusión de cajas eliminadas.
- `src/config/api.ts` — agregar `CAJA_API` y `CAJA_ELIMINADAS_API`.
- `src/config/caja.ts` — agregar `DEFAULT_CAJA_HISTORY_DAYS`.
- `src/application/services/closureService.ts` — excluir ventas con `cashRegisterId = null` en `generateClosure`.
- `src/components/caja/caja-history.tsx` — extender con modo papelera y acciones.
- `src/components/ventas/sales-history.tsx` — agregar prop `allowCancel`.
- `src/app/(panel)/ventas/historial/page.tsx` — agregar enlace a papelera y acción de eliminar.
- `src/app/(panel)/ventas/historial/[id]/page.tsx` — agregar botones según estado.
- `src/components/panel/panel-header.tsx` — opcional, si se decide agregar acceso directo.

### Crear

- `src/app/api/caja/[id]/restaurar/route.ts` — restaurar una caja eliminada.
- `src/app/api/caja/[id]/permanente/route.ts` — hard delete de una caja.
- `src/app/api/caja/eliminadas/route.ts` — listar y vaciar cajas eliminadas.
- `src/components/caja/cash-register-actions.tsx` — botones de acción reutilizables por fila.
- `src/app/(panel)/ventas/historial/eliminadas/page.tsx` — página de papelera.
- Server actions opcionales, por ejemplo `src/app/(panel)/ventas/historial/actions.ts`.

## Notas técnicas adicionales para la implementación

Para evitar errores de build, inconsistencias de tipos y comportamientos no esperados, tener en cuenta los siguientes puntos:

### Server Components y acciones en el detalle de caja

`src/app/(panel)/ventas/historial/[id]/page.tsx` es un Server Component. No se puede usar `onClick` en un botón dentro de él. Opciones:
1. Crear un Client Component `src/components/caja/cash-register-detail-actions.tsx` que reciba el `cashRegister` y ejecute fetches o reciba server actions.
2. Usar Server Actions en `src/app/(panel)/ventas/historial/actions.ts` y usar `<form action={...}>` con `bind` para pasar el `id`, o con un campo oculto.

### Recarga del listado `CajaHistory`

`CajaHistory` es un Client Component. El `load()` actual vive dentro del `useEffect` y no se puede invocar desde handlers externos. Para recargar tras una acción:
- Extraer `load()` al cuerpo del componente.
- Agregar un estado `refreshKey` y hacer que `useEffect` dependa de `[statusFilter, deletedOnly, refreshKey]`.
- Los handlers `onDelete`, `onRestore`, `onPermanentDelete` y `onEmptyTrash` deben actualizar `refreshKey` o llamar directamente a `load()` al finalizar.
- Si se usan Server Actions, además de `revalidatePath('/ventas/historial')` y `revalidatePath('/ventas/historial/eliminadas')`, el Client Component debe actualizar su propio estado.

### Imports necesarios en `cashRegisterRepository.ts`

El repositorio actual importa solo `eq, and, desc, gte, lte`. Para las nuevas funciones agregar:
- `isNull`, `isNotNull`, `inArray` desde `drizzle-orm`.
- `executeInTransaction` desde `@/application/transactionService` si se decide implementar `hardDeleteAllDeletedInRange` en el repositorio; alternativamente, la transacción puede vivir en el servicio.

### Tipos locales y `Money`

- `src/domain/types.ts` usa `Money` para los totales, pero la API y los componentes usan `number`. Mantener la consistencia: en `src/components/caja/caja-history.tsx` se usa una interface `CashRegister` local con campos `number`; agregar allí `deletedAt: string | null`.
- La API serializa fechas como strings (`string | null`) al cliente. Tener esto en cuenta en los componentes.

### `statusFilter` en modo papelera

Cuando `deletedOnly` es `true`, `CajaHistory` consulta `CAJA_ELIMINADAS_API`. Ese endpoint no acepta `status` porque la papelera lista cajas ya eliminadas (estado lógico, no `status`). En modo papelera, ignorar `statusFilter` y no enviarlo como query param.

### `closureService.generateClosure` y ventas desvinculadas

En `src/application/services/closureService.ts`, la consulta de ventas activas debe agregar `isNotNull(sales.cashRegisterId)` para excluir ventas que quedaron desvinculadas tras hard delete de cajas. Sin este filtro, los cierres diarios seguirán contando esas ventas.

### Anulación de ventas desde cajas eliminadas

Además de ocultar el botón en `SalesHistory` (`allowCancel={false}`), considerar agregar una validación en `saleService.cancelSale` para rechazar la anulación si la venta pertenece a una caja con `deletedAt` no nulo. Esto evita que un POST manual a `/api/ventas/[id]/anular` modifique ventas de una caja eliminada.

### Relaciones en `findById`

`cashRegisterRepository.findById` debe seguir cargando las ventas con `with: { sales: { ... } }`. Al agregar `includeDeleted`, el `where` debe combinarse con `and(eq(cashRegisters.id, id), includeDeleted ? undefined : isNull(cashRegisters.deletedAt))`.

### Columna de acciones en la tabla

Extender el `Table` de `CajaHistory` con una columna adicional al final para los botones de acción. Los clicks en los botones deben llamar a `event.stopPropagation()` para evitar navegar al detalle.

### Navegación desde la papelera

En `/ventas/historial/eliminadas/page.tsx` usar `detailRoute="/ventas/historial"`, de modo que al hacer clic en una caja eliminada se vaya a `/ventas/historial/[id]` (misma página de detalle). Esa página, al recibir `getCashRegisterById(id, true)`, podrá mostrar cajas eliminadas con el banner correspondiente.

## Convenciones y restricciones

- Todo el código, comentarios y textos de usuario deben estar en español.
- No hardcodear URLs de API, credenciales, rangos de fechas fijos ni textos de UI. Usar `src/config/api.ts` y `src/config/caja.ts`.
  - Agregar en `src/config/caja.ts` una constante `DEFAULT_CAJA_HISTORY_DAYS` (por ejemplo `30`) para el rango por defecto de historial y papelera.
- No duplicar componentes ni helpers existentes. Extender `CajaHistory` y `SalesHistory` con props.
- No exponer datos sensibles en los logs de error.
- Usar transacciones de Drizzle (`executeInTransaction` o `db.transaction`) para las operaciones de hard delete y vaciado de papelera.
- Requerir autenticación en todos los endpoints (`requireAuth`).
- Manejar `NotFoundError`, `ValidationError` y `UnauthorizedError` con los códigos HTTP correspondientes.
- Agregar `data-testid` a los botones si hay tests E2E que los validen.
- Si se generan migraciones, no commitear archivos de `drizzle/` que contengan datos reales; solo el esquema/migración.
- El listado y vaciado de la papelera deben filtrar por `deletedAt`, no por `openedAt`.
- El componente `CajaHistory` es cliente, por lo que las acciones deben terminar invocando su función interna de recarga; `router.refresh()` o `revalidatePath` solos no actualizan el estado del Client Component.
- El hard delete definitivo solo debe ejecutarse sobre cajas que ya estén en la papelera (`deletedAt is not null`).
- Los cierres diarios ya generados no se recalculan automáticamente. Para cierres futuros, `generateClosure` debe excluir las ventas cuyo `cashRegisterId` sea `null` (es decir, las ventas desvinculadas de cajas hard-deleteadas), de lo contrario seguirán contándose ingresos de cajas eliminadas.

## Criterios de verificación

### Automáticos

- [ ] Ejecutar `npm run lint` sin errores.
- [ ] Ejecutar `npm run build` sin errores.
- [ ] Ejecutar `npm test` sin fallos; si se agregan funciones, añadir tests unitarios en `src/application/services/cashRegisterService.test.ts`.
- [ ] Ejecutar `npx playwright test` y confirmar que los tests E2E pasan o ajustarlos si cambió el comportamiento intencional.

### Manuales

1. Abrir una caja, realizar algunas ventas y cerrarla.
2. Ir a `/ventas/historial` y verificar que la caja aparece.
3. Hacer clic en "Eliminar" en la fila de la caja. Confirmar que:
   - La caja desaparece del historial normal.
   - Aparece en `/ventas/historial/eliminadas`.
4. Hacer clic en la caja eliminada para ver el detalle. Confirmar que:
   - Aparece el banner "Esta caja fue eliminada".
   - No se puede anular ventas desde ese detalle.
5. Desde `/ventas/historial/eliminadas`, probar:
   - **Restaurar**: la caja vuelve a `/ventas/historial`.
   - **Eliminar definitivamente**: la caja desaparece de la papelera; las ventas asociadas conservan `cashRegisterId = null`.
   - **Vaciar papelera**: todas las cajas en la papelera se eliminan definitivamente.
6. Abrir una caja y, sin cerrarla, intentar eliminarla desde el historial. Confirmar que se muestra un error y la operación no se realiza.
7. Verificar que `findOpen()` nunca devuelve una caja eliminada y que el panel de ventas no se rompe.
8. Verificar que `/cierre/historial` y `/cierre` no muestran cajas eliminadas.
9. Verificar que la papelera filtra por la fecha de eliminación y que "Vaciar papelera" solo borra las cajas mostradas en el rango actual.
10. Para un día con ventas, hard-deletear la caja antes de generar el cierre diario; confirmar que el cierre diario de ese día no incluye las ventas desvinculadas.

## Entregables esperados

- `src/db/schema.ts` actualizado con `deletedAt` en `cash_registers`.
- `src/domain/types.ts` actualizado.
- Migración de Drizzle generada y aplicada en el entorno correspondiente.
- Repositorio y servicio de cajas con operaciones de soft delete, restore, hard delete y listado de eliminadas.
- Endpoints `DELETE /api/caja/[id]`, `POST /api/caja/[id]/restaurar`, `DELETE /api/caja/[id]/permanente` y `GET/DELETE /api/caja/eliminadas`.
- `src/config/api.ts` con `CAJA_API` y `CAJA_ELIMINADAS_API`.
- `src/config/caja.ts` con `DEFAULT_CAJA_HISTORY_DAYS`.
- `src/components/caja/caja-history.tsx` extendido para soportar modo papelera y acciones.
- `src/components/caja/cash-register-actions.tsx` para los botones de eliminar/restaurar/eliminar definitivamente/vaciar papelera.
- `src/components/ventas/sales-history.tsx` con prop `allowCancel`.
- `src/app/(panel)/ventas/historial/page.tsx` con enlace a cajas eliminadas.
- `src/app/(panel)/ventas/historial/[id]/page.tsx` con botones de acción y banner para cajas eliminadas.
- `src/app/(panel)/ventas/historial/eliminadas/page.tsx` nueva.
- Tests unitarios ajustados o añadidos.
- Lint, build y tests pasando.
