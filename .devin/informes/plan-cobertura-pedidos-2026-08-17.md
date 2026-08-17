# Plan de cobertura e implementación — Pedidos, sucursal y cliente

**Fecha:** 2026-08-17  
**Basado en:** <ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-auditoria-pedidos-sucursal-cliente-2026-08-17.md" />  
**Proyecto:** `pancheria`

---

## Objetivo

Implementar las recomendaciones del informe de auditoría con el menor riesgo posible, asegurando que cada cambio tenga **tests unitarios o E2E** que lo cubran y que se ejecuten las verificaciones estándar antes de dar por terminada cada fase.

---

## Principios del plan

1. **Un cambio a la vez.** No mezclar refactor grande con cambio de negocio crítico.
2. **Tests antes o junto con el fix.** Preferir escribir el test que reproduce el escenario y luego el cambio.
3. **Verificaciones por fase.** Cada fase debe pasar `npx tsc --noEmit`, `npm run lint` y `npm test`.
4. **Base de datos de prueba para E2E.** No ejecutar `npm run test:e2e` contra datos reales.
5. **Sin credenciales hardcodeadas.** Todos los valores sensibles desde variables de entorno.
6. **Documentación al día.** Actualizar prompts, `lecciones-aprendidas.md` y `reporte-estado.md` a medida que se resuelven hallazgos.

---

## Fase 1 — Precios históricos en `convertOrderToSale` (crítico)

### Objetivo
Evitar que un cambio de precio posterior genere una venta con `total` distinto al del pedido.

### Archivos a modificar
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" />
  - `buildSaleItemValues`: aceptar `unitPrice` y `subtotal` opcionales por ítem.
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" />
  - `convertOrderToSale`: construir los ítems usando `unitPrice` y `subtotal` de `order.items`.
- <ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" /> (no cambios, validar que `unitPrice`/`subtotal` están mapeados como `numeric` con `mode: 'number'`).
- Tests: <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.test.ts" /> y <ref_file file="C:/developer/paginas/pancheria/src/application/services/saleService.test.ts" />.

### Implementación
1. Cambiar la firma de `buildSaleItemValues` a:
   ```ts
   buildSaleItemValues(
     productById: Map<number, ProductRow>,
     items: { productId: number; quantity: number; unitPrice?: number; subtotal?: number }[]
   )
   ```
2. Si `unitPrice` está presente, usarlo para `unitPrice` y `subtotal`. Si no, calcular desde `product.price` como hoy.
3. En `convertOrderToSale`, mapear `order.items` a `{ productId, quantity, unitPrice: item.unitPrice, subtotal: item.subtotal }` y pasar ese array.
4. Mantener `createOrder` y `confirmSale` sin cambios de API; simplemente no pasan `unitPrice`/`subtotal` y continúan usando precio actual.

### Tests de cobertura
- `orderService.test.ts`: agregar test `convierte pedido a venta conservando el precio histórico`.
  - Crear producto con `price: 1000`.
  - Crear pedido.
  - Cambiar `product.price` a `1200`.
  - Llamar `convertOrderToSale`.
  - Verificar que `sale.total === 1000 * cantidad` y `saleItem.unitPrice === 1000`.
- `saleService.test.ts`: agregar test `buildSaleItemValues respeta unitPrice y subtotal opcionales`.

### Verificaciones
- `npx tsc --noEmit`
- `npm run lint`
- `npm test -- --testPathPatterns="orderService|saleService"`
- `npm run build` (antes de mergear).

---

## Fase 2 — Validación de `branchId` entero en `/pedido`

### Objetivo
Rechazar valores decimales, negativos o no numéricos en el query param `branchId`.

### Archivos a modificar
- <ref_file file="C:/developer/paginas/pancheria/src/app/(public)/pedido/page.tsx" />
- Tests: <ref_file file="C:/developer/paginas/pancheria/tests/e2e/pedido-sucursal-y-stock.spec.ts" />.

### Implementación
1. Reemplazar `Number(params.branchId)` por `Number.parseInt(params.branchId, 10)`.
2. Mantener la redirección a `/pedido` si `Number.isNaN(parsed) || parsed <= 0`.
3. Considerar extraer un helper `parseBranchId(value: unknown): number | null` en `src/lib/branch-resolver.ts` para reutilizar en otras rutas.

### Tests de cobertura
- E2E: agregar test `redirige a /pedido cuando branchId no es un entero positivo`.
  - Navegar a `/pedido?branchId=1.5`, `/pedido?branchId=-1`, `/pedido?branchId=abc`.
  - Verificar que la URL final es `/pedido` (sin query o con `branchId` de default).

### Verificaciones
- `npx tsc --noEmit`
- `npm run lint`
- `npx playwright test tests/e2e/pedido-sucursal-y-stock.spec.ts` (base de prueba).

---

## Fase 3 — `branchId` explícito en el panel de pedidos

### Objetivo
Hacer explícita la sucursal del listado y evitar desfases entre prop y cookie.

### Archivos a modificar
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/pedidos-list.tsx" />
  - Incluir `branchId=${branchId}` en la URL de `authenticatedFetch`.
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/pedidos/route.ts" />
  - Leer `branchId` del query.
  - Validar que coincida con `getCurrentBranchId(session)` (operadores) o que pertenezca a una sucursal válida (administradores).
- <ref_file file="C:/developer/paginas/pancheria/src/lib/zod-schemas.ts" />
  - Agregar schema opcional `branchId: z.coerce.number().int().positive().optional()` si se centraliza.
- Tests: <ref_file file="C:/developer/paginas/pancheria/src/app/api/pedidos/route.test.ts" /> y E2E.

### Implementación
1. En `PedidosList` cambiar el `load` para que la URL sea:
   ```ts
   const params = new URLSearchParams({
     branchId: String(branchId),
     status,
     page: String(page),
     limit: String(limit),
   });
   ```
2. En `GET /api/pedidos`:
   - Parsear `branchId` del query.
   - Obtener `currentBranchId = await getCurrentBranchId(session)`.
   - Si hay `query.branchId` y el usuario es `operator`, rechazar si no coincide con `currentBranchId`.
   - Si el usuario es `admin`, permitir `query.branchId` pero validar que la sucursal exista.
   - Usar el `branchId` resultante para `orderService.getOrders`.

### Tests de cobertura
- `route.test.ts`:
  - `admin puede listar pedidos de otra sucursal enviando branchId`.
  - `operator no puede listar pedidos de otra sucursal`.
  - `sin branchId se usa la sucursal actual`.
- E2E:
  - El test existente de cambio de sucursal en panel (`pedido-sucursal-y-stock.spec.ts`) se extiende para validar que el listado cambia de sucursal.

### Verificaciones
- `npx tsc --noEmit`
- `npm run lint`
- `npm test -- --testPathPatterns="pedidos/route"`
- E2E en base de prueba.

---

## Fase 4 — Rate limiting de pedidos públicos

### Objetivo
Documentar la limitación actual y/o implementar un store compartido.

### Opción A — Documentar (rápida, menor riesgo)
1. Agregar en `AGENTS.md` y `.env.example` una nota:
   > `PUBLIC_ORDER_RATE_LIMIT_*` se aplican en memoria por instancia de función serverless. En múltiples instancias el límite no se comparte; para rate limiting global usar una base de datos compartida o KV.
2. No modificar código.

### Opción B — Implementar store compartido (mayor alcance, requiere decisión)
1. Elegir backend: tabla `order_rate_limit` en PostgreSQL o KV (Vercel KV / Redis).
2. Crear `src/lib/order-rate-limit-store.ts` con interfaz similar a `RateLimitStore`.
3. Reemplazar `rateLimitMap` en <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/pedido/route.ts" />.
4. Si se usa PostgreSQL, agregar migración con `drizzle-kit generate` + `push`.

### Tests de cobertura
- `route.test.ts`: test de rate limit con múltiples requests.
- Si se implementa store compartido: test unitario del store.

### Verificaciones
- `npx tsc --noEmit`
- `npm run lint`
- `npm test -- --testPathPatterns="public/pedido/route"`
- `npx drizzle-kit check` (si hay migración).

---

## Fase 5 — Consolidar lógica de cancelación

### Objetivo
Eliminar la duplicación entre `cancelOrder` y `cancelSale`.

### Archivos a modificar
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" />
  - Extraer helpers privados o exportados:
    - `buildReintegrationContext(tx, branchId, items, includeDeleted?)`
    - `reintegrateStockAndUpdateCashRegister(tx, branchId, cashRegister, items, productById, recipesByProduct, source, movementType, operation)`
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" />
  - Reutilizar los helpers en `cancelOrder`.
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" />
  - Reutilizar en `cancelSale`.

### Implementación
1. Mover la parte de reintegro de stock + resumen de caja a un helper.
2. `cancelOrder` se encarga de validar token/estado, luego llama al helper sin caja.
3. `cancelSale` se encarga de validar caja, luego llama al helper con caja.

### Tests de cobertura
- `orderService.test.ts`: `reintegra stock al cancelar pedido`.
- `saleService.test.ts`: `reintegra stock y actualiza resumen de caja al anular venta`.
- Verificar que `cancelSale` sigue rechazando ventas de cajas cerradas.

### Verificaciones
- `npx tsc --noEmit`
- `npm run lint`
- `npm test -- --testPathPatterns="orderService|saleService"

---

## Fase 6 — Decidir y aplicar postura sobre `useEffect`/`setState`

### Objetivo
Alinear documentación y código.

### Opción A — Prohibir `setState` en `useEffect` (más trabajo)
1. En `PedidoClient`:
   - Eliminar el `useEffect` de carga inicial (líneas 148-173).
   - Mantener `useEffect` del intervalo periódico (líneas 175-198).
   - `initialProducts` del Server Component es la fuente de verdad del primer render.
2. En `useCart`:
   - Eliminar el `useEffect` que reacciona a `branchId` (líneas 109-114); confiar en el remonte por `key={branchId}`.
   - Mantener el `useEffect` de persistencia en `localStorage` (líneas 116-132).
3. Actualizar `eslint.config.mjs` para incluir la regla real o documentar la decisión.
4. Actualizar `lecciones-aprendidas.md` y `recomendaciones-pedidos-sucursal-stock.md` aclarando la excepción permitida para persistencia.

### Opción B — Permitir el patrón (menor trabajo)
1. Actualizar `lecciones-aprendidas.md` y `recomendaciones-pedidos-sucursal-stock.md` para:
   - Eliminar la afirmación de que se eliminó todo `setState` en `useEffect`.
   - Explicitar qué casos están permitidos (carga asíncrona con flag `isMountedRef`, persistencia derivada).
2. No cambiar `eslint.config.mjs`.

### Tests de cobertura
- `useCart.test.ts`: `limpia el carrito al cambiar de sucursal en tiempo de ejecución` (ya existe, debe seguir pasando).
- E2E: cambio de sucursal limpia el carrito.

### Verificaciones
- `npm run lint`
- `npx tsc --noEmit`
- `npm test -- --testPathPatterns="useCart|pedido-client"`
- E2E en base de prueba.

---

## Fase 7 — Eliminar carga inicial duplicada del catálogo

### Objetivo
Evitar el doble fetch de catálogo al montar `PedidoClient`.

### Archivos a modificar
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.tsx" />

### Implementación
1. Eliminar el `useEffect` de carga inicial o convertirlo en un flag que solo se dispare cuando el usuario vuelve a la pestaña (opcional).
2. Asegurar que `products` inicia con `initialProducts`.
3. Mantener el `useEffect` del intervalo periódico.
4. Considerar agregar `revalidateTag` o `router.refresh()` si se quiere actualizar con SSR.

### Tests de cobertura
- E2E: `no se dispara una segunda petición de catálogo al cargar /pedido`.
- Unit test (si se mockea `fetch`): verificar que no se llama `fetch` inmediatamente al montar.

### Verificaciones
- `npx tsc --noEmit`
- `npm run lint`
- E2E en base de prueba.

---

## Fase 8 — Actualizar documentación de prompts

### Objetivo
Evitar que documentos desactualizados o con líneas fijas confundan a futuros agentes.

### Archivos a modificar
- `.devin/prompts/auditoria-pedidos-sucursal-cliente.md`
  - Mover a `.devin/prompts/archivados/auditoria-pedidos-sucursal-cliente.md`.
- `.devin/prompts/README.md`
  - Mover la entrada del prompt a **Prompts resueltos y archivados**.
- `.devin/prompts/recomendaciones-pedidos-sucursal-stock.md`
  - Reemplazar `<ref_snippet ... lines="..."/>` por `<ref_file .../>` o nombres de función (`validateProductsForOperation`, `buildSaleItemValues`, `insertSaleAndUpdateCashRegister`).
- `.devin/informes/lecciones-aprendidas.md`
  - Renumerar secciones (7, 8, 8 repetidas).
  - Ajustar la nota de `useEffect`/`setState` según la decisión de la Fase 6.
- `.devin/informes/reporte-estado.md`
  - Agregar resumen de los hallazgos resueltos y los pendientes.

### Tests de cobertura
- No aplica.

### Verificaciones
- Revisión manual del markdown.
- `npm run lint` (si lintea markdown; si no, solo lectura).

---

## Fase 9 — Seguridad de `.env.local`

### Objetivo
Proteger secretos expuestos en el workspace.

### Acciones
1. **No modificar `.env.local` sin confirmación**, pero advertir que contiene:
   - `DATABASE_URL` / `DATABASE_URL_UNPOOLED` con credenciales de Neon.
   - `NEXTAUTH_SECRET`.
   - `ADMIN_PASSWORD`.
2. Recomendar al usuario:
   - Rotar `NEXTAUTH_SECRET` y `ADMIN_PASSWORD` si el workspace fue compartido.
   - Rotar la contraseña de la base de datos (`npg_*`) si la URL fue expuesta.
   - Verificar que `.env.local` esté en `.gitignore` (lo está).
   - No subir `.env.local` a Vercel/GitHub; usar `vercel env add` u otro secret manager.

### Tests de cobertura
- No aplica.

---

## Orden recomendado de ejecución

1. Fase 1 (precios históricos) — crítico, primero.
2. Fase 8 (documentación) — movimiento del prompt y ajuste de lecciones; se puede hacer en paralelo con Fase 1 si no se toca código.
3. Fase 6 (decisión `useEffect`/`setState`) — antes de tocar Fase 7.
4. Fase 7 (carga duplicada) — depende de la decisión de Fase 6.
5. Fase 2 (validación `branchId` entero) — cambio pequeño e independiente.
6. Fase 3 (`branchId` en panel) — puede hacerse en paralelo con Fase 2.
7. Fase 5 (consolidar cancelación) — refactor, ideal tras estabilizar Fase 1.
8. Fase 4 (rate limit) — decisión de arquitectura; puede postergarse si se documenta.
9. Fase 9 (seguridad) — acciones manuales del usuario.
10. Verificaciones finales.

---

## Checklist de cierre del plan

- [ ] Fase 1 implementada y cubierta por tests.
- [ ] Fase 2 implementada y cubierta por tests.
- [ ] Fase 3 implementada y cubierta por tests.
- [ ] Fase 4 resuelta (documentación o implementación).
- [ ] Fase 5 implementada y cubierta por tests.
- [ ] Fase 6 decidida (código o documentación).
- [ ] Fase 7 implementada y cubierta por tests.
- [ ] Fase 8 completada.
- [ ] Fase 9 recomendaciones comunicadas al usuario.
- [ ] `npm run lint` pasa.
- [ ] `npx tsc --noEmit` pasa.
- [ ] `npm test` pasa.
- [ ] `npm run build` pasa.
- [ ] `npm run test:e2e` pasa en base de datos de prueba.

---

## Notas

- No ejecutar `npx tsx src/db/seeds.ts`, `npx drizzle-kit generate`, `npx drizzle-kit push` ni `npm run test:e2e` sin confirmación explícita del usuario.
- Si se implementa un store de rate limit en PostgreSQL (Fase 4), requiere migración y `push` en entorno de prueba.
