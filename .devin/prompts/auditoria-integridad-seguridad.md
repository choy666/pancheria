# Prompt: Auditoría de integridad, concurrencia y seguridad

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos y cierre de caja.

Auditorías anteriores resolvieron problemas de rendimiento (N+1, resumen de caja precalculado, polling, skeletons, config, tests E2E). El análisis posterior detectó fallas de integridad de datos, condiciones de carrera, y aspectos de seguridad/escalabilidad que no estaban cubiertos por los prompts anteriores.

## Objetivo

Corregir los hallazgos de alta y media prioridad, mejorar los de baja prioridad cuando sea viable, y dejar el proyecto consistente ante concurrencia, datos y escalabilidad.

## Hallazgos a resolver

### 1. Condición de carrera al abrir caja (alta prioridad)

**Archivos:**
- `src/db/schema.ts`
- `src/application/services/cashRegisterService.ts`
- `src/repositories/cashRegisterRepository.ts` (opcional)
- `src/application/services/cashRegisterService.test.ts` (actualizar)

**Problema:** `openCashRegister()` consulta si hay una caja abierta y luego crea una. Entre ambas operaciones puede entrar otro request y crear una segunda caja abierta. La tabla `cash_registers` no impide múltiples filas con `status = 'open'`.

**Implementación:**

1. Agregar un índice único parcial en `cash_registers`:
   ```ts
   (table) => ({
     openStatusIdx: uniqueIndex('cash_registers_open_status_idx')
       .on(table.status)
       .where(isNull(table.deletedAt)),
   })
   ```
   Nota: la condición exacta debe ser `WHERE status = 'open' AND deleted_at IS NULL`. Ajustar la expresión de Drizzle según sea necesario (`sql` si hace falta).
2. En `cashRegisterService.openCashRegister`, envolver la verificación y la creación en una transacción con bloqueo pesimista. Alternativa: capturar el error de unicidad del índice y devolver `ValidationError('Ya existe una caja abierta.')`.
3. Si se usa transacción, utilizar `tx.select().from(cashRegisters).where(...).for('update')` o el mecanismo que Drizzle/PostgreSQL provea para evitar que otra transacción abra una caja simultáneamente.
4. Generar migración con `npx drizzle-kit generate` y aplicarla solo en el entorno autorizado con `npx drizzle-kit push`.
5. Actualizar tests unitarios para reflejar el nuevo comportamiento (mock de transacción o manejo de error de unicidad).

**Resultado esperado:** siempre existe cero o una caja abierta, incluso bajo concurrencia.

---

### 2. Condición de carrera en resumen de caja durante la venta (alta prioridad)

**Archivos:**
- `src/application/services/saleService.ts`
- `src/application/services/cashRegisterService.ts`
- `src/application/services/saleService.test.ts` (actualizar)

**Problema:** `confirmSale` lee el resumen de la caja fuera de la transacción y luego lo actualiza con la suma calculada en memoria. Dos ventas concurrentes pueden leer el mismo `total`/`productsSummary` y la última escritura pisa a la primera.

**Implementación:**

1. Dentro de la transacción de `confirmSale` (y `cancelSale`), volver a leer la fila de `cash_registers` con bloqueo pesimista justo antes de actualizar el resumen. Ejemplo conceptual:
   ```ts
   const [lockedCashRegister] = await tx
     .select()
     .from(cashRegisters)
     .where(eq(cashRegisters.id, cashRegister.id))
     .for('update');
   ```
   o con `findFirst({ for: 'update' })` si Drizzle lo soporta en relational queries.
2. `updateCashRegisterSummary` debe recibir el `cashRegister` releído dentro de la transacción (con el bloqueo), no el leído fuera.
3. Si PostgreSQL `FOR UPDATE` genera problemas de portabilidad, alternativa: separar la actualización del resumen en una función idempotente que use `UPDATE cash_registers SET total = total + ?, totalSales = totalSales + 1 ... WHERE id = ?`. Para los JSON `productsSummary` y `criticalSuppliesSummary` no es tan directo, por lo que el bloqueo pesimista es preferible.
4. Actualizar tests unitarios: simular lectura del `cashRegister` dentro del mock de transacción.

**Resultado esperado:** ventas concurrentes actualizan el resumen de forma atómica, sin pérdida de escrituras.

---

### 3. Anulación de ventas en cajas cerradas (alta prioridad)

**Archivos:**
- `src/application/services/saleService.ts`
- `src/components/ventas/sales-history.tsx`
- `src/app/(panel)/ventas/historial/[id]/page.tsx` (si aplica)
- `src/application/services/saleService.test.ts` (actualizar)

**Problema:** `cancelSale` solo verifica que la caja no esté eliminada. No valida que esté abierta. `SalesHistory` permite anular si `allowCancel` es true, y en detalle de caja se pasa `allowCancel={!cashRegister.deletedAt}`, sin importar si la caja está cerrada.

**Implementación:**

1. En `cancelSale`, rechazar si `sale.cashRegister?.status !== 'open'`:
   ```ts
   if (!sale.cashRegister || sale.cashRegister.status !== 'open') {
     throw new ValidationError('No se puede anular una venta de una caja cerrada o eliminada.');
   }
   ```
2. En `SalesHistory`, usar `allowCancel` para controlar UI, pero preferir que la decisión final sea del servicio.
3. En `src/app/(panel)/ventas/historial/[id]/page.tsx` mantener `allowCancel={!cashRegister.deletedAt}`; el servicio ya rechazará si la caja está cerrada.
4. Actualizar tests de `cancelSale` con caja cerrada (debe lanzar `ValidationError`).

**Resultado esperado:** una vez cerrada la caja, sus ventas no son anulables, protegiendo la integridad del cierre diario.

---

### 4. Borrado de productos usados como insumos en recetas (media prioridad)

**Archivos:**
- `src/application/services/productService.ts`
- `src/application/services/productService.test.ts` (actualizar)

**Problema:** `updateProduct` rechaza cambiar el tipo si el producto es insumo de una receta, pero `deleteProduct` no lo verifica. Se puede hacer soft-delete de un insumo crítico y seguir consumiéndolo en productos compuestos.

**Implementación:**

1. En `deleteProduct(id)`:
   ```ts
   const usedAsSupply = await db.query.recipes.findFirst({
     where: eq(recipes.supplyId, id),
   });

   if (usedAsSupply) {
     throw new ValidationError(
       'No se puede eliminar el producto porque está usado en una receta.'
     );
   }
   ```
2. Alternativa (más permisiva): advertir o agregar un flag `force` para eliminar a pesar de estar en recetas, descontando automáticamente de las recetas afectadas. Para este prompt, la validación restrictiva es suficiente.
3. Actualizar tests: caso de producto usado en receta → `ValidationError`; caso normal → soft delete.

**Resultado esperado:** no se pueden eliminar productos que aún son insumos activos de recetas.

---

### 5. Consulta pesada en detalle de caja (media prioridad)

**Archivos:**
- `src/repositories/cashRegisterRepository.ts`
- `src/repositories/saleRepository.ts` (si se agrega método)
- `src/components/ventas/sales-history.tsx`
- `src/app/(panel)/ventas/historial/[id]/page.tsx`

**Problema:** `cashRegisterRepository.findById` trae todas las ventas de la caja con ítems y productos. Cajas con muchas ventas producen queries y renderizados pesados.

**Implementación (opción mínima):**

1. Agregar en `saleRepository` un método `findByCashRegisterId(cashRegisterId, limit, offset)` con paginación.
2. Modificar `page.tsx` para pasar solo las últimas `N` ventas o implementar paginación con query params (`?page=`).
3. Si se opta por paginación, actualizar `SalesHistory` para manejar botones “Anteriores / Siguientes” o infinite scroll.

**Implementación (opción simple):**

1. Limitar la carga a las últimas 50 ventas en `findById`:
   ```ts
   with: {
     sales: {
       limit: 50,
       orderBy: (sales, { desc }) => [desc(sales.createdAt)],
       with: { items: { with: { product: true } } },
     },
   },
   ```
2. Mostrar un mensaje en la UI si hay más ventas.

**Resultado esperado:** el detalle de caja carga de forma predecible sin importar la cantidad de ventas.

---

### 6. Rate limiting en login (baja prioridad)

**Archivos:**
- `src/application/services/authService.ts`

**Problema:** `verifyCredentials` no limita intentos fallidos, dejando abierta la posibilidad de fuerza bruta.

**Implementación (mínima, en memoria):**

1. Agregar un `Map<string, { count: number; lastAttempt: number }>` indexado por IP o username.
2. En `verifyCredentials`, si un usuario/IP supera N intentos en M minutos, lanzar `ValidationError` o agregar un retardo exponencial.
3. Para entornos serverless/escalados, considerar almacenar intentos en Redis o en tabla `login_attempts` (queda fuera de este prompt por ser baja prioridad).

**Resultado esperado:** mitigación básica de fuerza bruta en `/login`.

---

### 7. Índices faltantes para consultas frecuentes (baja prioridad)

**Archivos:**
- `src/db/schema.ts`
- `src/application/services/cashRegisterService.ts`
- `src/application/services/productService.ts`

**Problema:** consultas frecuentes filtran por `products.type` + `products.isActive` y por `cash_registers.status` + `cash_registers.deletedAt` sin índices explícitos.

**Implementación:**

1. Agregar índices en `products`:
   ```ts
   (table) => ({
     typeIsActiveIdx: index('products_type_is_active_idx').on(table.type, table.isActive),
   })
   ```
2. Agregar índice en `cash_registers` para `findOpen`:
   ```ts
   (table) => ({
     statusDeletedAtIdx: index('cash_registers_status_deleted_at_idx')
       .on(table.status, table.deletedAt),
   })
   ```
3. Generar migración con `npx drizzle-kit generate` y aplicar en entorno autorizado.

**Resultado esperado:** consultas frecuentes escalan mejor con volúmenes grandes.

---

## Archivos y áreas a tocar obligatoriamente

- `src/db/schema.ts`
- `src/application/services/cashRegisterService.ts`
- `src/application/services/saleService.ts`
- `src/application/services/productService.ts`
- `src/components/ventas/sales-history.tsx`
- `src/repositories/cashRegisterRepository.ts`
- `src/repositories/saleRepository.ts` (para paginación)
- `src/application/services/authService.ts` (rate limiting)
- Tests unitarios asociados

## Consideraciones importantes

1. **No truncar ni eliminar datos reales**.
2. **Mantener compatibilidad** con el comportamiento actual; solo restringir casos inválidos.
3. **No hardcodear URLs ni credenciales**.
4. **Mantener formato en español** en mensajes y documentación.
5. **No modificar `.env.local` ni agregar secretos**.
6. **Si se toca el esquema de base de datos**, generar migraciones solo en el entorno autorizado con `npx drizzle-kit generate` y `npx drizzle-kit push`.
7. **Drizzle/PostgreSQL**: usar `for('update')` si está disponible en la versión instalada de Drizzle ORM; si no, usar `sql` o consultar documentación oficial.

## Comandos de verificación

```bash
npm run lint
npm test
npm run build
npx playwright test --project=chromium
```

Para aplicar migraciones (solo en entorno autorizado):

```bash
npx drizzle-kit generate
npx drizzle-kit push
```

## Resultado esperado

- No pueden existir dos cajas abiertas simultáneas.
- Las ventas concurrentes no pierden actualizaciones del resumen de caja.
- No se anulan ventas de cajas cerradas.
- No se eliminan productos que son insumos de recetas activas.
- El detalle de caja no colapsa con muchas ventas.
- Login tiene una protección básica contra fuerza bruta.
- Las consultas frecuentes cuentan con índices adecuados.
- Lint, tests, build y E2E siguen pasando.
