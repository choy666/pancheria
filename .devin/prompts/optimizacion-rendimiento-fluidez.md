# Prompt: Optimización de rendimiento, eficacia y fluidez del sistema

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

## Hallazgos actuales

1. **N+1 en la terminal de ventas**: `src/components/ventas/sales-terminal.tsx` carga la lista de productos y luego ejecuta una llamada `fetch` por cada producto vendible a `/api/productos/disponibilidad?productId=X`. Si hay 20 productos, se realizan 20 peticiones HTTP consecutivas.
2. **Resumen de caja recalculado en cada poll**: `src/application/services/cashRegisterService.ts` recalcula totales, productos e insumos críticos iterando todas las ventas activas cada vez que se consulta `/api/caja/resumen`.
3. **`setTimeout(..., 0)` innecesario**: `src/components/ventas/sales-terminal.tsx` y `src/hooks/useCashRegister.ts` usan `setTimeout` dentro de `useEffect` para iniciar la carga, lo que retrasa artificialmente el render sin beneficio.
4. **Polling fijo cada 5 segundos**: el panel de caja consulta `/api/caja/resumen` periódicamente sin pausar en pestañas inactivas ni adaptarse a la actividad del usuario.
5. **`next.config.ts` vacío**: no aprovecha compresión, análisis de bundle ni optimizaciones de paquetes.
6. **Loading states inconsistentes**: varios componentes muestran `<p>Cargando...</p>` en lugar de skeletons/spinners.
7. **Tests E2E destructivos**: `tests/e2e/global-setup.ts` trunca tablas y re-seedea la base de datos, lo que impide ejecutar los tests contra producción.

## Objetivo

Implementar mejoras de rendimiento y fluidez priorizando el impacto real del usuario sin alterar el comportamiento funcional del sistema.

Prioridad:

1. Eliminar el patrón N+1 en `/ventas`.
2. Evitar recalcular el resumen de caja en cada request.
3. Quitar los `setTimeout(..., 0)` innecesarios.
4. Mejorar el polling del panel de caja.
5. Agregar optimizaciones de configuración y skeletons.
6. Dejar `playwright.config.ts` listo para correr tests contra producción (sin `global-setup` destructivo).

## Implementación detallada

### 1. Batch de disponibilidad de productos

#### Opción recomendada A: extender `/api/productos`

1. En `src/application/services/productService.ts`, agregar una función `listActiveProductsWithAvailability()`.
2. Para cada producto activo, calcular la disponibilidad reutilizando `saleService.calculateAvailability(productId)`.
3. En `src/app/api/productos/route.ts`, agregar un parámetro opcional `?includeAvailability=true` o un endpoint separado `/api/productos/disponibilidad` que acepte `productIds` como lista.
4. Actualizar `src/components/ventas/sales-terminal.tsx` para que haga **una sola llamada** y reciba un mapa de disponibilidades.

#### Opción B: modificar `/api/productos/disponibilidad`

1. Permitir `productIds=1,2,3,...`.
2. En `src/app/api/productos/disponibilidad/route.ts`, parsear el array y devolver:
   ```json
   { "1": 10, "2": 5, "3": 0 }
   ```
3. Actualizar `sales-terminal.tsx` para construir una sola URL con todos los IDs.

Consideraciones:

- Mantener `saleService.calculateAvailability` para casos unitarios.
- Si se elige la Opción A, eliminar el fetch individual de `sales-terminal.tsx`.
- Si se elige la Opción B, mantener compatibilidad con `productId` unitario por si se usa en otro lugar.
- No hardcodear URLs; usar `PRODUCTOS_API` y `PRODUCTOS_DISPONIBILIDAD_API` de `src/config/api.ts`.

### 2. Precálculo del resumen de caja

1. En `src/db/schema.ts` la tabla `cash_registers` ya posee campos `total`, `cashTotal`, `transferTotal`, `totalSales`, `productsSummary` y `criticalSuppliesSummary`.
2. En `src/application/services/cashRegisterService.ts`:
   - `closeCashRegister` ya calcula y guarda el resumen al cerrar. Verificar que el cálculo sea correcto y completo.
   - `getOpenCashRegisterSummary` no debe recalcular `calculateCashRegisterSummary`; en su lugar, debe devolver los valores almacenados en el registro de caja, más el resumen de ventas que aún no se persistieron.
3. Actualizar `confirmSale` y `cancelSale` en `src/application/services/saleService.ts` para que, al finalizar, actualicen los totales y resúmenes acumulados en la caja abierta sin recalcular todo el historial.
4. Opcionalmente, agregar un campo `updatedAt` o `summaryUpdatedAt` a `cash_registers` si se requiere trazabilidad.

### 3. Eliminar `setTimeout(..., 0)`

- En `src/components/ventas/sales-terminal.tsx`, reemplazar el `setTimeout` que envuelve `load()` por una llamada directa dentro del `useEffect`.
- En `src/hooks/useCashRegister.ts`, reemplazar el `setTimeout` que envuelve `fetchCaja()` por una llamada directa.

### 4. Polling más inteligente del panel de caja

1. En `src/hooks/useCashRegister.ts`:
   - Pausar el `setInterval` cuando la pestaña esté oculta (`document.visibilityState`).
   - Opcional: aumentar el intervalo a 10-15 segundos si no hay actividad reciente.
   - Incluir `getCajaRefreshInterval()` como límite mínimo, respetando `NEXT_PUBLIC_CAJA_REFRESH_INTERVAL_MS`.
2. Considerar usar SWR o React Query para deduplicar requests concurrentes si se abren varias pestañas.

### 5. Optimizar `next.config.ts`

1. Agregar compresión:
   ```ts
   const nextConfig: NextConfig = {
     compress: true,
   };
   ```
2. Si se agregan imágenes en el futuro, configurar `images.remotePatterns` o `images.unoptimized: true`.
3. Considerar agregar `@next/bundle-analyzer` como devDependency y un script `analyze`.
4. Si el bundle de `lucide-react` o `date-fns` crece, agregar `experimental.optimizePackageImports`.

### 6. Skeletons y estados de carga

1. Crear o reutilizar un componente `Skeleton` en `src/components/ui/skeleton.tsx`.
2. Reemplazar los textos `<p>Cargando...</p>` en componentes clave:
   - `src/components/ventas/sales-terminal.tsx`
   - `src/components/caja/caja-panel.tsx`
   - `src/components/caja/caja-status.tsx`
   - `src/components/stock/stock-list.tsx`
   - `src/components/cierre/closure-history.tsx`
   - `src/components/productos/product-form.tsx` (si aplica)
3. Usar `Loader2` de `lucide-react` con `animate-spin` si se prefiere spinner.

### 7. Tests E2E contra producción

1. Verificar que `playwright.config.ts` soporte variables de entorno:
   - `BASE_URL`: URL objetivo (producción o local).
   - `NO_GLOBAL_SETUP`: evita truncar la base de datos.
   - `NO_WEB_SERVER`: no levanta `npm run dev`.
2. En `tests/e2e/global-setup.ts`, mantener el truncado solo cuando no esté definido `NO_GLOBAL_SETUP`.
3. Crear un test E2E mínimo de smoke (`tests/e2e/smoke.spec.ts`) que solo verifique login y carga de páginas protegidas, sin mutar datos.

### 8. Linter y build

- Ejecutar `npm run lint` y `npm run build` después de cada cambio.
- Ejecutar `npm test` para validar tests unitarios.
- Ejecutar `npx playwright test` contra local para validar flujos E2E en ambiente seguro.

## Archivos y áreas a tocar obligatoriamente

### Cliente

- `src/components/ventas/sales-terminal.tsx`
- `src/hooks/useCashRegister.ts`
- `src/components/caja/caja-panel.tsx`
- `src/components/caja/caja-status.tsx`
- `src/components/ui/skeleton.tsx` (crear si no existe)
- `src/components/stock/stock-list.tsx`
- `src/components/cierre/closure-history.tsx`

### API

- `src/app/api/productos/route.ts`
- `src/app/api/productos/disponibilidad/route.ts`
- `src/app/api/caja/resumen/route.ts`

### Servicios

- `src/application/services/productService.ts`
- `src/application/services/saleService.ts`
- `src/application/services/cashRegisterService.ts`
- `src/application/services/cashRegisterService.test.ts` (actualizar tests)

### Configuración

- `next.config.ts`
- `playwright.config.ts`
- `package.json` (si se agrega `@next/bundle-analyzer`)
- `tests/e2e/global-setup.ts`
- `tests/e2e/smoke.spec.ts` (crear si se implementa smoke test)

## Consideraciones importantes

1. **No truncar ni eliminar datos reales**: el precálculo de resumen de caja es una actualización controlada; no debe borrar ventas ni insumos.
2. **Mantener compatibilidad**: si `/api/productos/disponibilidad` cambia a aceptar múltiples IDs, conservar soporte para `productId` unitario.
3. **No hardcodear URLs ni credenciales**: usar constantes de `src/config/api.ts` y variables de entorno.
4. **Mantener formato en español** en comentarios, mensajes de error y documentación.
5. **No modificar `.env.local` ni agregar secretos al repositorio**.
6. **Si se cambia el esquema de base de datos**, generar migraciones solo en el entorno autorizado con `npx drizzle-kit generate` y `npx drizzle-kit push`.

## Comandos de verificación

```bash
npm run lint
npm run build
npm test
npx playwright test
```

Para correr un smoke test contra producción:

```bash
$env:BASE_URL='https://pancheria-alpha.vercel.app'
$env:NO_GLOBAL_SETUP='1'
$env:NO_WEB_SERVER='1'
npx playwright test tests/e2e/login.spec.ts
```

## Resultado esperado

- La pantalla `/ventas` carga en una sola llamada a productos + una sola llamada a disponibilidad (batch).
- El panel de caja consulta el resumen sin recalcular todo el historial en cada poll.
- Los tiempos de carga percibidos mejoran y no hay requests en bucle.
- El build y los tests siguen pasando.
