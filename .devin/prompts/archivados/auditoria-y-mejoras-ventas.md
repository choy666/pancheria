# Prompt: auditoría, depuración y mejoras de UX del módulo de ventas (`/ventas`)

> **Estado:** resuelto y archivado.  
> **Resolución:** se implementaron los productos agotados ocultos por defecto con toggle, el badge "Mixto" y `aria-pressed` en pagos, la refactorización de `SalesTerminal` en `SalesProductCard`/`SalesCart`, el helper `src/lib/ventas-helpers.ts`, y el desglose de pagos en el historial de ventas. Ver `src/components/ventas/sales-terminal.tsx`, `src/components/ventas/sales-product-card.tsx`, `src/components/ventas/sales-cart.tsx`, `src/components/pagos/payment-parts-input.tsx`, `src/lib/ventas-helpers.ts` y `src/components/ventas/sales-history.tsx`. El contexto histórico queda en `.devin/informes/lecciones-aprendidas.md` (sección 14).

## Contexto

Proyecto: `panchería` — Sistema de gestión de stock, ventas, productos, recetas, caja y cierre de caja.

Stack: Next.js 16.3.3 (App Router), React 19.2.8, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM 0.45.2 con PostgreSQL (Neon), NextAuth v5, Jest, Playwright.

Documentación de referencia obligatoria:

- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/pancheria.prompt.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-estado.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/entornos.md" />

Código relevante:

- Terminal de ventas: <ref_file file="C:/developer/paginas/pancheria/src/components/ventas/sales-terminal.tsx" />
- Historial de ventas por caja: <ref_file file="C:/developer/paginas/pancheria/src/components/ventas/sales-history.tsx" />
- Página `/ventas`: <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/ventas/page.tsx" />
- Página `/ventas/historial`: <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/ventas/historial/page.tsx" />
- Página `/ventas/historial/eliminadas`: <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/ventas/historial/eliminadas/page.tsx" />
- Página de detalle de caja: <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/ventas/historial/[id]/page.tsx" />
- Componente de pagos: <ref_file file="C:/developer/paginas/pancheria/src/components/pagos/payment-parts-input.tsx" />
- Estado de caja: <ref_file file="C:/developer/paginas/pancheria/src/components/caja/caja-status.tsx" />
- APIs de ventas: <ref_file file="C:/developer/paginas/pancheria/src/app/api/ventas/route.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/app/api/ventas/disponibilidad/route.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/app/api/ventas/[id]/anular/route.ts" />
- Servicios de ventas: <ref_file file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" />
- Tests del terminal: <ref_file file="C:/developer/paginas/pancheria/src/components/ventas/sales-terminal.test.tsx" />

## Estado actual relevante

- La terminal de ventas (`/ventas`) usa `SalesTerminal`, que carga productos activos con disponibilidad (`GET /api/productos?includeAvailability=true`) y luego consulta disponibilidad del carrito (`POST /api/ventas/disponibilidad`).
- Ya existe soporte de pagos mixtos: `PaymentPartsInput` permite dividir el total entre efectivo y transferencia, y `saleService` almacena el desglose en `sale_payments`.
- `sales-history.tsx` muestra las ventas de una caja con paginación y permite anular.
- El historial de cajas (`/ventas/historial`) y el detalle (`/ventas/historial/[id]`) reutilizan `CajaHistory`, `CashRegisterSummary` y `SalesHistory`.

## Problemas y oportunidades detectados

1. **Productos agotados siguen visibles en el catálogo.** `sales-terminal.tsx` filtra por `isPublicSellableProduct`, pero los productos con `availability <= 0` se muestran con `opacity-50`. Esto genera clics fallidos y confusión. Los servicios (`type === 'service'`) nunca se agotan y deben seguir mostrándose.
2. **El método de pago seleccionado no se distingue visualmente.** En `payment-parts-input.tsx`, los botones "Todo efectivo" / "Todo transferencia" siempre usan `variant="outline"`, y los inputs no resaltan cuál método está en uso. No es obvio si el pago es mixto, todo efectivo o todo transferencia.
3. **`SalesTerminal` está sobrecargado.** Mezcla carga de productos, lógica de carrito, diálogo de promos, disponibilidad, pagos y confirmación en un solo componente. Dificulta mantenimiento y tests.
4. **Textos de disponibilidad pueden ser confusos.** "En este pedido: 0 más" no comunica claramente "sin stock"; el usuario sugiere ocultar el producto directamente o mostrar un estado más explícito.
5. **Historial de ventas podría mejorar la legibilidad del pago.** Ahora concatena `"Efectivo $X + Transferencia $Y"`. Se podrían usar chips/badges separados.
6. **Posibles duplicaciones y errores sutiles.** Por ejemplo, `additional` y `maxAdditional` se calculan en varios lugares; `updateQuantity` usa `item.quantity + additional` como límite, que puede ser inconsistente si la disponibilidad cambió; `error` y `cartShortage` comparten la misma presentación.
7. **Falta feedback visual al agregar productos.** Las tarjetas no indican cuántas unidades del producto ya están en el carrito.

## Objetivo

Auditar, depurar, limpiar y mejorar el módulo de ventas (`/ventas` y sus dependencias) para que:

- el catálogo sea rápido e intuitivo (productos agotados ocultos por defecto),
- el método de pago seleccionado sea inmediatamente reconocible,
- el código esté mejor organizado y testeado,
- la experiencia del operador al vender sea más eficiente.

## Alcance

Aplicar cambios en:

- `src/components/ventas/sales-terminal.tsx`
- `src/components/ventas/sales-history.tsx`
- `src/components/pagos/payment-parts-input.tsx`
- `src/app/(panel)/ventas/**`
- `src/app/api/ventas/**` (solo si es necesario para soportar los cambios de UI/UX)
- `src/application/services/saleService.ts` (solo si se detectan inconsistencias)
- Tests unitarios y E2E relacionados

No modificar:

- flujo de pedidos públicos (`/pedido`),
- esquema de base de datos,
- políticas de rate-limit, autenticación o permisos,
- lógica de cierre diario (salvo visualización de pagos en historial).

## Reglas de negocio y restricciones

1. **Productos vendibles:** en `/ventas` se muestran `compound`, `critical_supply` con `criticalSupplyType === 'beverage'` y `service` (ver `isPublicSellableProduct`).
2. **Ocultar agotados:** por defecto no mostrar productos cuya disponibilidad sea `<= 0`, excepto servicios. Mantener una opción para mostrar/ocultar agotados si el operador lo necesita.
3. **No eliminar `productIds` del endpoint de disponibilidad:** `POST /api/ventas/disponibilidad` debe seguir recibiendo el listado de IDs del catálogo visible (ver lección en <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />).
4. **Servicios sin límite:** `type === 'service'` tiene `availability = Number.MAX_SAFE_INTEGER` y nunca se bloquea por stock.
5. **Pagos mixtos:** se permite dividir el total entre `cash` y `transfer`. La suma debe coincidir exactamente con el total.
6. **Idempotencia y transacciones:** mantener `idempotencyKey`, `executeInTransaction` y bloqueos de caja.
7. **No hardcodear** URLs, credenciales, colores ni textos. Usar configuraciones existentes.
8. **Soft delete:** respetar cajas eliminadas: en `sales-history.tsx`, `allowCancel={!cashRegister.deletedAt}`.
9. **Accesibilidad:** botones de pago deben usar `aria-pressed`, inputs deben tener `aria-label` si no hay label visible.
10. **Tests:** ajustar `sales-terminal.test.tsx` y tests E2E de ventas si cambia el comportamiento de productos agotados.

## Implementación detallada

### 1. Catálogo del terminal: ocultar agotados

- En `sales-terminal.tsx`, al cargar productos, filtrar los que tengan `availability <= 0` y no sean servicios, o hacerlo en el render.
- Agregar un control (switch o checkbox) "Mostrar productos agotados" para casos excepcionales.
- Actualizar el texto "En este pedido: X más" para productos agotados: mostrar "Sin stock" o similar.
- Asegurar que `productIds` enviado a `POST /api/ventas/disponibilidad` siga siendo el de productos visibles.

### 2. Visualización del método de pago

- En `payment-parts-input.tsx`:
  - Si el pago actual es solo efectivo, el botón "Todo efectivo" debe resaltarse (`variant="default"`) y "Todo transferencia" quedar outline.
  - Si es solo transferencia, viceversa.
  - Si es mixto, ambos outline pero con un badge o texto "Mixto" visible, o resaltar ambos con un indicador de porcentaje/monto.
  - Agregar iconos o colores distintivos para cada método.
  - Considerar que, al editar un input, el restante se actualice automáticamente o al menos se muestre claramente.

### 3. Refactor de `SalesTerminal`

- Extraer subcomponentes:
  - `SalesProductCard`
  - `SalesCart`
  - `SalesCartItem`
- Extraer hooks si es conveniente:
  - `useSalesProducts` (carga y filtrado)
  - `useCartAvailability` (polling de disponibilidad)
- Mover funciones puras (`sellablePriority`, `sortSellableProducts`, `getDefaultSelectedRecipeItemIds`) a `src/lib/ventas-helpers.ts` si no existen.
- Revisar la lógica de `additional`/`maxAdditional`/`max` para evitar condiciones de carrera y cálculos duplicados.

### 4. Historial de ventas

- En `sales-history.tsx`, mostrar el desglose de pagos como chips/badges separados en lugar de texto concatenado.
- Revisar la columna de acciones: mostrar "—" o un badge cuando no se puede anular.
- Considerar agregar un tooltip con el detalle de preparación de la receta.

### 5. Limpieza general

- Revisar imports no usados en los archivos tocados.
- Eliminar variables, estados y funciones muertas.
- Verificar que `error` y `cartShortage` no se pisen mutuamente.
- Normalizar nombres: `paymentOverrides` vs `paymentParts`.
- Revisar `console.log` o comentarios obsoletos.

### 6. Accesibilidad y focus

- Agregar `aria-pressed` a botones de método de pago.
- Mejorar `aria-label` de botones `+` y `-` del carrito.
- Asegurar focus visible en tarjetas de producto.

### 7. Tests

- Actualizar `sales-terminal.test.tsx` si se ocultan productos agotados por defecto.
- Agregar tests para:
  - productos agotados no se renderizan por defecto,
  - toggle "Mostrar agotados" funciona,
  - botón de método de pago seleccionado resalta correctamente,
  - pago mixto sigue funcionando.
- Verificar tests E2E de ventas (`ventas-disponibilidad.spec.ts`, `ventas-historial.spec.ts`, etc.) y ajustar selectores si cambian.

## Consideraciones de seguridad y entorno

- No hardcodear credenciales, URLs de API, secretos ni parámetros sensibles.
- `DATABASE_URL` y `DATABASE_URL_UNPOOLED` deben apuntar a la base correcta. No usar producción para pruebas.
- `npm run test:e2e` y `npx drizzle-kit push` solo en base de datos descartable (`test`, `e2e`, `testing`, `qa` o `staging`).
- No commitear `.env.local` ni `.env.e2e`.
- Respaldar la base de datos antes de empujar migraciones en producción (ver <ref_file file="C:/developer/paginas/pancheria/.devin/informes/entornos.md" />).

## Criterios de aceptación

- [ ] Los productos agotados no se muestran por defecto en el catálogo de `/ventas`; los servicios siempre se muestran.
- [ ] Existe una opción para mostrar/ocultar productos agotados.
- [ ] El método de pago activo (efectivo, transferencia o mixto) se distingue visualmente en `payment-parts-input.tsx`.
- [ ] Los botones "Todo efectivo" / "Todo transferencia" resaltan cuando el pago corresponde exactamente a ese método.
- [ ] El carrito y la confirmación de venta siguen funcionando correctamente, incluyendo pagos mixtos.
- [ ] `SalesTerminal` tiene componentes más pequeños y legibles; la lógica de disponibilidad no se duplica.
- [ ] El historial de ventas muestra el desglose de pagos de forma clara.
- [ ] No se rompen los tests existentes; se agregan tests nuevos para los cambios de comportamiento.
- [ ] No hay código muerto, imports sin usar ni variables obsoletas en los archivos tocados.

## Verificaciones

Ejecutar en orden:

1. `npm run lint`
2. `npx tsc --noEmit`
3. `npm test`
4. `npm run build`
5. `npm run test:e2e` (solo en base de datos descartable y con confirmación, siguiendo <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />)

Si alguna verificación falla, corregir antes de continuar. Documentar decisiones no triviales en `.devin/informes/lecciones-aprendidas.md` si aplica.
