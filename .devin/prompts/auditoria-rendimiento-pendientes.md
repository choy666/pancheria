# Prompt: Solución de hallazgos pendientes — Auditoría de rendimiento

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos y cierre de caja.

El prompt `optimizacion-rendimiento-fluidez.md` fue aplicado previamente y el informe de auditoría posterior detectó los siguientes pendientes que deben resolverse para dejar el proyecto completo.

## Objetivo

Aplicar las correcciones restantes sin alterar el comportamiento funcional, priorizando el rendimiento real y manteniendo la arquitectura existente.

## Hallazgos a resolver

### 1. Recálculo de resumen de caja en detalle de caja abierta

**Archivo:** `src/app/(panel)/ventas/historial/[id]/page.tsx`

**Problema:** al visualizar una caja abierta (`isOpen === true`) el componente ejecuta:

```ts
const liveSummary = isOpen
  ? await cashRegisterService.calculateCashRegisterSummary(cashRegister.id)
  : null;
```

Esto recalcula el resumen iterando todas las ventas, lo que contradice la optimización hecha en `/api/caja/resumen`. El resumen ya se mantiene actualizado en `cash_registers` gracias a las actualizaciones incrementales de `confirmSale` y `cancelSale`.

**Implementación:**

1. En `src/application/services/cashRegisterService.ts`, extraer la lógica de parseo y relleno de insumos críticos en una función reutilizable, por ejemplo `parseCashRegisterSummary(cashRegister, fillMissingCriticalSupplies)`.
2. Hacer que `getOpenCashRegisterSummary()` use esa función con `fillMissingCriticalSupplies = true`.
3. En `src/app/(panel)/ventas/historial/[id]/page.tsx`:
   - Eliminar la llamada a `calculateCashRegisterSummary`.
   - Para cajas abiertas, obtener el resumen parseado con `parseCashRegisterSummary(cashRegister, true)`.
   - Para cajas cerradas, usar `safeJsonParse` o la misma función con `false`.
   - Usar directamente `cashRegister.total`, `cashRegister.cashTotal`, `cashRegister.transferTotal` y `cashRegister.totalSales`.

**Resultado esperado:** el detalle de caja abierta ya no ejecuta una query adicional ni recalcula todo el historial.

### 2. N+1 en generación de cierres diarios

**Archivo:** `src/application/services/closureService.ts`

**Problema:** la función `generateClosure` itera sobre `activeSales` y, por cada producto compuesto, ejecuta:

```ts
const recipe = await db.query.recipes.findMany({
  where: eq(recipes.compoundProductId, product.id),
  with: { supply: true },
});
```

Esto genera un patrón N+1 si hay muchos productos compuestos en las ventas.

**Implementación:**

1. Antes del bucle de ventas, recolectar todos los `compoundProductId` distintos en un `Set`.
2. Si el set no está vacío, hacer una sola consulta:
   ```ts
   const allRecipes = await db.query.recipes.findMany({
     where: inArray(recipes.compoundProductId, Array.from(compoundProductIds)),
     with: { supply: true },
   });
   ```
3. Construir un `Map<number, RecipeWithSupply[]>` (`recipesByProduct`) agrupando por `compoundProductId`.
4. En el bucle, reemplazar la consulta individual por `recipesByProduct.get(product.id) ?? []`.
5. Importar `inArray` si no está importado.

**Resultado esperado:** la generación de cierres diarios hace como máximo una consulta de recetas, independientemente de la cantidad de productos compuestos.

### 3. Pausar reloj de `caja-panel` y `caja-status` al ocultar pestaña (opcional)

**Archivos:**
- `src/components/caja/caja-panel.tsx`
- `src/components/caja/caja-status.tsx`

**Problema:** ambos componentes tienen `setInterval(() => setNow(new Date()), 60000)` que sigue ejecutándose aunque la pestaña esté oculta.

**Implementación:**

1. Pausar el intervalo con `document.hidden` / `visibilitychange`.
2. Reanudar al volver a visible.
3. Asegurar el cleanup correcto.

**Resultado esperado:** los relojes no consumen ciclos en pestañas ocultas, consistente con el polling del panel de caja.

## Archivos y áreas a tocar obligatoriamente

- `src/app/(panel)/ventas/historial/[id]/page.tsx`
- `src/application/services/cashRegisterService.ts`
- `src/application/services/closureService.ts`
- `src/components/caja/caja-panel.tsx` (opcional)
- `src/components/caja/caja-status.tsx` (opcional)
- `src/application/services/closureService.test.ts` (actualizar si cambia el mock)

## Consideraciones importantes

1. **No truncar ni eliminar datos reales**.
2. **Mantener compatibilidad** con el comportamiento actual: totales, resúmenes y cierres diarios deben quedar igual.
3. **No hardcodear URLs ni credenciales**.
4. **Mantener formato en español** en mensajes y documentación.
5. **No modificar `.env.local` ni agregar secretos**.

## Comandos de verificación

```bash
npm run lint
npm test
npm run build
npx playwright test --project=chromium
```

## Resultado esperado

- No quedan recálculos del resumen de caja en requests frecuentes.
- No quedan patrones N+1 en servicios que consultan recetas.
- Lint, tests, build y E2E siguen pasando.
