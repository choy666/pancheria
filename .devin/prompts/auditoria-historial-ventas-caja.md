# Prompt: Auditoría y corrección de venta hardcodeada/fantasma en el historial de caja

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

Problema reportado:

> Al abrir una caja y realizar una venta, al acceder al historial de ventas de la caja aparece **1 venta hardcodeada que nunca se realizó y en primer lugar**. La venta tiene las siguientes características:
>
> - Hora: `23:02`
> - Producto: `Panchuque completo x1`
> - Total: `$1500.00`
> - Método de pago: `Efectivo`
> - Estado: `Anulada`
>
> **Importante**: esta venta se repite en **todas las cajas que se abran**. Por ejemplo, al abrir la caja con ID `3` y acceder a `http://localhost:3000/ventas/historial/3`, se visualiza esta misma venta, aunque nunca se haya realizado en esa caja.
>
> Se requiere auditar las secciones de caja, ventas e historial en busca de valores hardcodeados, inconsistencias, relaciones mal configuradas o duplicidad de código que generen errores o muestren valores incorrectos.

## Causa probable

Dado que la venta **se muestra en todas las cajas**, las hipótesis principales son:

1. **La relación `cashRegisters → sales` en Drizzle no está filtrando por `cash_register_id`**, por lo que `cashRegisterRepository.findById(id)` con `with: { sales }` devuelve **todas** las ventas del sistema en lugar de las vinculadas a esa caja.
2. **Existe una venta residual en la tabla `sales`** con `cash_register_id` nulo, duplicado o incorrecto, y el frontend/repositorio no descarta ventas huérfanas.
3. **El componente `SalesHistory` está recibiendo un arreglo mezclado o estático** en lugar de `cashRegister.sales` exclusivamente.
4. **El componente `caja-history.tsx` o la página de detalle navegan a una ruta que muestra datos de otra caja** (confusión entre `/ventas/historial/[id]` y `/cierre/[id]`).

## Estrategia de búsqueda

1. Abrir la caja con ID `3` y acceder a `/ventas/historial/3`.
2. Verificar si la venta `Panchuque completo x1 - $1500.00 - Efectivo - Anulada` aparece.
3. Abrir una segunda caja nueva (por ejemplo, ID `4`) y acceder a `/ventas/historial/4`.
4. Confirmar si la **misma** venta aparece también en la caja `4`.
5. Ejecutar en la base de datos:
   ```sql
   SELECT id, cash_register_id, total, payment_method, status, created_at
   FROM sales
   WHERE status = 'cancelled'
   ORDER BY created_at DESC;
   ```
6. Si existe una venta cancelada con `Panchuque completo`, anotar su `cash_register_id` y verificar si coincide con la caja actual o es `NULL`.

## Objetivo

1. Identificar y eliminar la causa de la venta fantasma/hardcodeada que aparece en el historial de ventas de una caja.
2. Auditar la sección de caja, ventas e historial para detectar valores hardcodeados, datos de ejemplo residuales, lógica duplicada o inconsistencias.
3. Corregir cualquier problema encontrado y garantizar que el historial de ventas de cada caja refleje únicamente las ventas reales vinculadas a esa caja.
4. Eliminar o consolidar código duplicado entre componentes y páginas relacionadas.

## Archivos y áreas a auditar obligatoriamente

### Historial de ventas de caja

- `src/app/(panel)/ventas/historial/[id]/page.tsx`
- `src/app/(panel)/ventas/historial/page.tsx`
- `src/components/ventas/sales-history.tsx`

### Caja y cierre

- `src/components/caja/caja-history.tsx`
- `src/components/caja/caja-panel.tsx`
- `src/components/caja/caja-status.tsx`
- `src/app/(panel)/cierre/[id]/page.tsx`
- `src/app/(panel)/cierre/historial/page.tsx`
- `src/app/(panel)/cierre/page.tsx`
- `src/components/cierre/closure-history.tsx`
- `src/components/cierre/closure-panel.tsx`

### Servicios, repositorios y endpoints

- `src/application/services/cashRegisterService.ts`
- `src/application/services/saleService.ts`
- `src/application/services/closureService.ts`
- `src/repositories/cashRegisterRepository.ts`
- `src/repositories/saleRepository.ts`
- `src/repositories/dailyClosureRepository.ts`
- `src/app/api/caja/[id]/route.ts`
- `src/app/api/caja/historial/route.ts`
- `src/app/api/caja/resumen/route.ts`
- `src/app/api/caja/abrir/route.ts`
- `src/app/api/caja/cerrar/route.ts`
- `src/app/api/ventas/route.ts`
- `src/app/api/ventas/[id]/anular/route.ts`
- `src/app/api/cierre/route.ts`
- `src/app/api/cierre/historial/route.ts`

### Datos y configuración

- `src/db/seeds.ts`
- `src/db/schema.ts`
- `src/config/api.ts`
- `src/config/caja.ts`
- Variables de entorno (`.env.local` y `.env.example`)

## Checklist de auditoría

### 1. Datos hardcodeados o de ejemplo

- [ ] Buscar en todo `src/` literales que parezcan ventas de prueba: objetos con `paymentMethod`, `total`, `createdAt`, `items`, `product`, `quantity`, etc.
- [ ] Revisar `src/db/seeds.ts` y confirmar que **no** crea ventas, cajas de prueba ni movimientos de stock de ejemplo.
- [ ] Verificar que las migraciones SQL en `drizzle/` no insertan datos (`INSERT INTO sales`, `INSERT INTO sale_items`, etc.).
- [ ] Buscar `mock`, `dummy`, `fake`, `sample`, `fixture`, `test-*` en componentes y páginas de producción (excluyendo archivos `*.test.ts`).
- [ ] Confirmar que ningún endpoint devuelve un arreglo estático de ventas o cajas.

### 2. Datos residuales en la base de datos

- [ ] Conectar a la base de datos configurada en `DATABASE_URL`.
- [ ] Ejecutar consultas de auditoría:
  - `SELECT * FROM sales ORDER BY created_at DESC LIMIT 20;`
  - `SELECT * FROM sale_items ORDER BY id DESC LIMIT 20;`
  - `SELECT * FROM cash_registers ORDER BY opened_at DESC LIMIT 10;`
- [ ] Identificar ventas con `cash_register_id` nulo o vinculadas a cajas abiertas que no correspondan a flujos reales.
- [ ] Si existen ventas de prueba residuales, **eliminarlas solo si el usuario lo confirma** (son datos de producción/negocio).

### 3. Relaciones y consultas de Drizzle

- [ ] Verificar `cashRegistersRelations` y `salesRelations` en `src/db/schema.ts`.
- [ ] Confirmar que `cashRegisterRepository.findById` y `saleRepository.findByCashRegisterId` filtran correctamente por `cash_register_id`.
- [ ] **Verificar si `findById` con `with: { sales }` devuelve solo las ventas de la caja consultada o todas las del sistema.** Si devuelve todas, reemplazar la carga por `saleRepository.findByCashRegisterId(id)` en el servicio o en la página.
- [ ] Revisar que `SalesHistory` reciba exactamente `cashRegister.sales ?? []` sin concatenar ni modificar datos.
- [ ] Verificar que no se mezclen ventas de cajas distintas por errores en relaciones o índices.
- [ ] Revisar si existen ventas con `cash_register_id IS NULL` que puedan mostrarse incorrectamente.

### 4. Duplicidad de código e inconsistencias

- [ ] Funciones `formatDateTime` y `safeFormatDuration` duplicadas en:
  - `src/app/(panel)/cierre/[id]/page.tsx`
  - `src/app/(panel)/ventas/historial/[id]/page.tsx`
  - `src/components/caja/caja-history.tsx`
- [ ] Lógica de cálculo de resumen duplicada entre `cashRegisterService.calculateCashRegisterSummary` y `closureService.generateClosure`.
- [ ] Cálculo de rangos de fechas inconsistente:
  - `caja-history.tsx` usa `addDays(end, -30)`.
  - `closure-history.tsx` usa `new Date().setDate(start.getDate() - 30)`.
  - El servidor `cierre/historial/route.ts` usa `new Date()` como default para `start` y `end`, mientras que `caja/historial/route.ts` usa `subDays(end, 30)`.
- [ ] Consolidar helpers en `src/lib/utils.ts` o crear `src/lib/date.ts` si no existe.

### 5. Hardcodeo de constantes y textos

- [ ] Verificar que no haya URLs, credenciales o rangos de fechas fijos en el código. Usar `src/config/api.ts` y `src/config/caja.ts`.
- [ ] Confirmar que textos de UI estén definidos en el componente correspondiente y no en constantes globales sin sentido.
- [ ] Revisar que `CAJA_REFRESH_INTERVAL_MS` se obtenga de `process.env.NEXT_PUBLIC_CAJA_REFRESH_INTERVAL_MS` con fallback en `src/config/caja.ts`.

### 6. Estados y cierres automáticos

- [ ] Revisar `cashRegisterService.getOpenCashRegister` y el cierre automático a las `AUTO_CLOSE_HOURS` horas.
- [ ] Confirmar que el cierre automático no genere registros de ventas o resúmenes incorrectos.
- [ ] Verificar que `autoClosed` se muestre correctamente en el historial.

## Pasos de corrección sugeridos

1. **Eliminar datos de ejemplo de ventas**
   - Si el seed o migraciones crean ventas, eliminarlos o convertirlos en opcionales y desactivados por defecto.
   - Asegurar que el seed nunca cree ventas reales en producción.

2. **Corregir relaciones y consultas**
   - Si se encuentra una relación mal configurada en Drizzle, corregir `schema.ts`, regenerar migraciones (`npx drizzle-kit generate`) y aplicarlas (`npx drizzle-kit push`) solo en entornos autorizados.
   - **Si `cashRegisterRepository.findById(id)` con `with: { sales }` devuelve todas las ventas del sistema en lugar de solo las de la caja `id`, aplicar una de estas dos soluciones:**
     - **Opción A (recomendada si la relación Drizzle falla):** no confiar en `cashRegister.sales`. En `src/app/(panel)/ventas/historial/[id]/page.tsx` obtener las ventas con `saleRepository.findByCashRegisterId(cashRegister.id)` y pasar ese arreglo a `SalesHistory`.
     - **Opción B:** modificar `cashRegisterRepository.findById` para no incluir `sales` en el `with`, o agregar un `where` explícito dentro de `with: { sales }` que filtre `eq(sales.cashRegisterId, id)`.
   - Filtrar ventas por `cashRegisterId` y, si aplica, por `status` en el repositorio.

3. **Consolidar helpers duplicados**
   - Mover `formatDateTime`, `safeFormatDuration` y `formatLastUpdated` a `src/lib/date.ts` (o similar).
   - Importar esas funciones en todas las páginas y componentes que las usen.
   - Eliminar las definiciones duplicadas.

4. **Unificar cálculo de resumen**
   - Evaluar si `calculateCashRegisterSummary` y `generateClosure` pueden compartir una función auxiliar en `src/application/services/summaryCalculations.ts` para evitar duplicidad.

5. **Corregir rangos de fechas por defecto**
   - Asegurar que el cliente y el servidor usen el mismo default (últimos 30 días) cuando no se reciben parámetros.
   - Considerar usar `date-fns` en `closure-history.tsx` para calcular el inicio del rango.

6. **Corregir formato de hora en `sales-history.tsx`**
   - Revisar si `formatTime` debe usar `getHours`/`getMinutes` local en lugar de `getUTCHours`/`getUTCMinutes` para mostrar la hora correcta en la zona horaria del usuario.
   - Esta corrección puede evitar que ventas reales parezcan "fantasma" por mostrar una hora incorrecta.

## Criterios de verificación

- [ ] Ejecutar `npm run lint` sin errores.
- [ ] Ejecutar `npm run build` sin errores.
- [ ] Ejecutar `npm test` y confirmar que no se rompen tests unitarios.
- [ ] Ejecutar `npx playwright test` y confirmar que los tests E2E pasan o ajustarlos si cambió el comportamiento intencional.
- [ ] Probar el flujo completo localmente:
  1. Abrir caja `A`.
  2. Realizar una venta.
  3. Ir a `/ventas/historial`.
  4. Seleccionar la caja `A`.
  5. Verificar que en el historial de ventas de la caja aparezca **solo** la venta recién realizada, sin ventas adicionales o desconocidas. **En particular, no debe aparecer la venta `23:02 - Panchuque completo x1 - $1500.00 - Efectivo - Anulada` si no se realizó en esta caja.**
  6. Cerrar la caja `A` (o dejarla abierta) y abrir una caja `B`.
  7. Acceder a `/ventas/historial/[id-caja-B]` y confirmar que la venta `Panchuque completo` tampoco aparece ahí.
  8. Realizar una venta en la caja `B` y verificar que solo aparece la venta de la caja `B`.
- [ ] Verificar que los totales (efectivo, transferencia, cantidad de ventas) coincidan con las ventas listadas.

## Notas importantes

- No hardcodear credenciales, URLs de APIs ni parámetros sensibles.
- Usar `src/config/api.ts` y `src/config/caja.ts` para constantes de endpoints e intervalos.
- Cualquier eliminación de datos de la base de datos debe ser confirmada por el usuario antes de ejecutarla.
- Si se encuentran ventas de prueba necesarias para tests, moverlas a archivos `*.test.ts` o a un script de seed de desarrollo separado, nunca al flujo de producción.
- Todas las explicaciones, comentarios y documentación deben estar en español.
