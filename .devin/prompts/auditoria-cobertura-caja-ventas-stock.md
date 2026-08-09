# Prompt: Auditoría y cobertura del resumen de caja actual, flujo de ventas y descuento de stock

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

## Problema reportado

> En la página de ventas no se abrió la caja y no se registraron ventas, pero en la página de cierre el resumen de la caja actual muestra una venta, lo cual es incorrecto.
>
> El resumen de caja actual solo debe mostrarse cuando exista una caja abierta y contenga ventas reales; de lo contrario debe informar claramente que no hay una caja abierta.
>
> Además, se requiere ampliar la cobertura y eficacia de las páginas de ventas, cajas y cierres, y corroborar que el descuento de stock funcione correctamente al realizar ventas.

## Hipótesis de causas principales

1. **Datos residuales en la base de datos**: existe una fila en `cash_registers` con `status = 'open'` que tiene `totalSales > 0` o `total > 0` aunque no corresponda a una sesión real de ventas (datos de prueba, migraciones manuales o cajas previas sin cerrar).
2. **Cierre automático no aplica correctamente**: `getOpenCashRegister()` no cierra una caja abierta que ya superó las `AUTO_CLOSE_HOURS` y sigue devolviendo un resumen con ventas antiguas.
3. **Inconsistencia entre `/ventas` y `/cierre`**: aunque ambas pantallas consultan `/api/caja/resumen`, una de ellas podría estar usando otro estado o datos en caché que muestran información obsoleta.
4. **Confusión entre caja actual y cierre diario**: el `ClosurePanel` genera un `dailyClosures` por fecha y podría mostrar datos que el usuario interpreta como caja actual.
5. **Stock inconsistente al vender**: el descuento de insumos críticos, la disponibilidad mostrada o el reintegro en anulaciones podrían no estar sincronizados con el resumen de caja.

## Objetivos

1. Determinar la causa exacta por la que el resumen de caja actual refleja una venta sin que se haya abierto caja o registrado ventas.
2. Corregir el flujo para que el resumen de caja actual solo se muestre cuando haya una caja abierta y, idealmente, refleje solo ventas reales vinculadas a esa caja.
3. Garantizar que, si no hay caja abierta, tanto `/ventas` como `/cierre` informen claramente al usuario con un mensaje visible y botón para abrir caja.
4. Auditar y mejorar la eficacia de las páginas de ventas, cajas y cierres.
5. Verificar que el descuento de stock al vender, el reintegro al anular y la disponibilidad mostrada en el terminal de ventas funcionen correctamente.
6. Agregar o actualizar tests unitarios y E2E que cubran los escenarios críticos.

## Archivos y áreas a auditar obligatoriamente

### Páginas y componentes de UI

- `src/app/(panel)/ventas/page.tsx`
- `src/app/(panel)/cierre/page.tsx`
- `src/components/ventas/sales-terminal.tsx`
- `src/components/caja/caja-panel.tsx`
- `src/components/caja/caja-status.tsx`
- `src/components/cierre/closure-panel.tsx`
- `src/hooks/useCashRegister.ts`
- `src/app/(panel)/cierre/historial/page.tsx`
- `src/app/(panel)/ventas/historial/page.tsx`
- `src/components/ventas/sales-history.tsx`

### Servicios, repositorios y endpoints

- `src/application/services/cashRegisterService.ts`
- `src/application/services/saleService.ts`
- `src/application/services/closureService.ts`
- `src/repositories/cashRegisterRepository.ts`
- `src/repositories/saleRepository.ts`
- `src/app/api/caja/resumen/route.ts`
- `src/app/api/caja/abrir/route.ts`
- `src/app/api/caja/cerrar/route.ts`
- `src/app/api/ventas/route.ts`
- `src/app/api/ventas/[id]/anular/route.ts`
- `src/app/api/productos/disponibilidad/route.ts`
- `src/app/api/productos/route.ts`

### Datos y configuración

- `src/db/schema.ts`
- `src/db/seeds.ts`
- `src/config/caja.ts`
- `src/config/api.ts`
- `drizzle/*.sql` (migraciones)

### Tests existentes

- `src/application/services/cashRegisterService.test.ts`
- `src/application/services/saleService.test.ts`
- `src/application/services/closureService.test.ts`
- `src/repositories/cashRegisterRepository.test.ts`
- `src/lib/auth.test.ts`
- Tests E2E de Playwright en `tests/` o `e2e/`

## Checklist de auditoría

### 1. Datos residuales y consistencia de la base de datos

- [ ] Conectar a la base de datos configurada en `DATABASE_URL`.
- [ ] Ejecutar consultas de auditoría:
  - `SELECT * FROM cash_registers WHERE status = 'open' AND deleted_at IS NULL;`
  - `SELECT id, cash_register_id, status, total, payment_method, created_at FROM sales ORDER BY created_at DESC LIMIT 20;`
  - `SELECT * FROM sale_items ORDER BY id DESC LIMIT 20;`
  - `SELECT * FROM daily_closures ORDER BY date DESC LIMIT 10;`
- [ ] Verificar si la caja abierta tiene `totalSales > 0` o `total > 0` y, de ser así, cruzar con los registros de `sales` y `sale_items`.
- [ ] Revisar si existe alguna caja o venta de prueba residual.
- [ ] Si se encuentran datos residuales, documentarlos y **eliminarlos solo con confirmación del usuario**.
- [ ] Revisar `src/db/seeds.ts` y las migraciones en `drizzle/` para confirmar que no crean cajas, ventas ni cierres de ejemplo.

### 2. Estado y resumen de la caja actual

- [ ] `cashRegisterRepository.findOpen()` debe devolver solo cajas con `status = 'open'` y `deletedAt IS NULL`.
- [ ] `cashRegisterService.getOpenCashRegister()` debe devolver `null` cuando no haya caja abierta.
- [ ] `cashRegisterService.getOpenCashRegister()` debe cerrar automáticamente una caja que supere `AUTO_CLOSE_HOURS` y devolver `null`.
- [ ] `cashRegisterService.getOpenCashRegisterSummary()` debe devolver `null` cuando `getOpenCashRegister()` devuelva `null`.
- [ ] `/api/caja/resumen/route.ts` debe devolver `{ status: 'closed' }` cuando no haya caja abierta.
- [ ] `useCashRegister` debe dejar `cashRegister` en `null` cuando el endpoint indique que no hay caja.
- [ ] `CajaPanel` debe mostrar un mensaje claro "No hay una caja abierta" y el botón "Abrir caja" cuando no exista caja.
- [ ] `CajaStatus` en la página de ventas debe mostrar un mensaje coherente con `CajaPanel`.
- [ ] Si la caja existe pero `totalSales === 0`, el resumen debe mostrar `Ventas: 0`, total `$0.00` y productos vacíos, nunca una venta inexistente.
- [ ] Si la caja existe y `totalSales > 0`, validar que las ventas realmente pertenezcan a esa caja (`sales.cashRegisterId = cashRegister.id`) y tengan `status = 'active'`.

### 3. Caja, ventas y cierres

- [ ] Verificar que no se pueda confirmar una venta sin caja abierta; `saleService.confirmSale` debe lanzar `ValidationError`.
- [ ] `sales-terminal` debe bloquear agregar productos al carrito si no hay caja abierta.
- [ ] `sales-terminal` debe refrescar el estado de caja antes de confirmar la venta.
- [ ] `CajaPanel` debe deshabilitar el botón de cierre si no hay caja.
- [ ] `closure-panel` no debe confundirse con la caja actual: genera cierres diarios (`dailyClosures`) por fecha.
- [ ] `closureService.generateClosure` debe considerar solo ventas con `cashRegisterId` no nulo en el rango de fechas.
- [ ] Verificar que no se permita generar dos cierres diarios para la misma fecha.

### 4. Stock y disponibilidad en ventas

- [ ] `saleService.calculateAvailability` debe calcular correctamente la disponibilidad de productos compuestos según recetas con `autoDiscount = true`.
- [ ] `saleService.calculateAvailabilityForProductIds` debe ser coherente con `calculateAvailability`.
- [ ] `sales-terminal` debe mostrar `availability` correcta y bloquear cantidades mayores a la disponible.
- [ ] `confirmSale` debe validar stock antes de insertar la venta.
- [ ] `confirmSale` debe descontar stock de insumos críticos (`autoDiscount = true`) y de bebidas (`criticalSupplyType = 'beverage'`).
- [ ] `confirmSale` debe registrar movimientos de stock en `stockMovements` con `type = 'sale'`.
- [ ] `confirmSale` debe actualizar el resumen de caja de forma atómica dentro de la transacción.
- [ ] `cancelSale` solo debe permitir anular ventas de cajas abiertas.
- [ ] `cancelSale` debe reintegrar el stock de los insumos y bebidas.
- [ ] `cancelSale` debe registrar movimientos de stock con `type = 'cancellation'`.
- [ ] `cancelSale` debe actualizar el resumen de caja restando la venta anulada.
- [ ] Verificar que productos `manual_supply` no se vendan directamente (`sales-terminal` los filtra; `confirmSale` los rechaza).

### 5. Concurrencia, seguridad y robustez

- [ ] `openCashRegister` debe usar una transacción con `FOR UPDATE` o capturar violaciones de índice único para evitar dos cajas abiertas.
- [ ] `confirmSale` y `cancelSale` deben leer la caja con `FOR UPDATE` antes de actualizar el resumen.
- [ ] El `idempotencyKey` debe evitar ventas duplicadas.
- [ ] No hardcodear URLs, credenciales, intervalos ni textos; usar `src/config/api.ts`, `src/config/caja.ts` y variables de entorno.

## Pasos de corrección sugeridos

1. **Auditar datos residuales**
   - Ejecutar las consultas de la sección 1 y documentar hallazgos.
   - Si hay cajas o ventas de prueba, pedir confirmación antes de eliminar o corregir.

2. **Corregir resumen de caja actual**
   - Asegurar que `getOpenCashRegisterSummary()` devuelva `null` cuando no haya caja abierta.
   - Verificar que `CajaPanel` y `CajaStatus` manejen correctamente el estado `cashRegister === null`.
   - Opcionalmente, agregar un mensaje de empty-state más prominente en `CajaPanel`.

3. **Normalizar visualización cuando la caja está abierta pero sin ventas**
   - Mostrar `Ventas: 0`, totales en cero y listas vacías.
   - No mostrar tarjetas de productos/insumos si no hay datos.

4. **Verificar y mejorar el flujo de stock**
   - Revisar que `calculateAvailability` y `calculateAvailabilityForProductIds` sean consistentes.
   - Verificar que `confirmSale` y `cancelSale` actualicen stock y resumen de caja atómicamente.
   - Confirmar que `sales-terminal` deshabilite productos sin stock.

5. **Ampliar tests**
   - `cashRegisterService.getOpenCashRegisterSummary` con caja abierta sin ventas → totales en 0.
   - `cashRegisterService.getOpenCashRegisterSummary` sin caja abierta → `null`.
   - `saleService.confirmSale` sin caja abierta → `ValidationError`.
   - `saleService.confirmSale` y `cancelSale` verifican stock correctamente.
   - Tests E2E para flujo completo: abrir caja, vender, anular, cerrar caja, generar cierre.

## Comandos de verificación

```bash
npm run lint
npm test
npm run build
npx playwright test --project=chromium
```

Si se modifica el esquema o se agregan migraciones:

```bash
npx drizzle-kit generate
npx drizzle-kit push
```

## Resultado esperado

- El resumen de caja actual solo se muestra cuando existe una caja abierta.
- Si no hay caja abierta, `/ventas` y `/cierre` informan claramente al usuario y ofrecen abrir una nueva caja.
- Si la caja está abierta pero no tiene ventas, se muestran totales en cero y un mensaje indicando que no hay ventas aún.
- El descuento y reintegro de stock en ventas y anulaciones es correcto y consistente con el resumen de caja.
- No quedan datos residuales ni ventas fantasma en el resumen de caja actual.
- Lint, tests, build y tests E2E pasan correctamente.

## Consideraciones importantes

- **No eliminar ni modificar datos reales sin confirmación del usuario**.
- **No hardcodear URLs, credenciales, valores de rango de fechas ni textos**.
- **Mantener todo el código, comentarios y mensajes en español**.
- **No modificar `.env.local` ni agregar secretos**.
- Si se requiere modificar el esquema de base de datos, generar la migración correspondiente con `npx drizzle-kit generate`.
