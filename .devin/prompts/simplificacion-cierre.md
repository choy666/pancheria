# Prompt: Simplificación de `/cierre` — quitar tarjetas de insumos y limpiar el pipeline de resúmenes

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja, pedidos públicos y multi-sucursal.

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM con PostgreSQL (Neon), NextAuth v5.

Documentación de referencia obligatoria:
- `AGENTS.md`
- `.devin/informes/lecciones-aprendidas.md`
- `.devin/informes/checklist-pre-push.md`
- `.devin/informes/guia-funcionamiento-pancheria.md` — §resúmenes de caja (queda desactualizada con este cambio, actualizarla)
- `.devin/informes/auditoria-nueva-sucursal-stock-2026-10-04.md` §"Implementado" — origen de `suppliesSummary`/`buildSuppliesSummary` que este cambio retira

Todo el trabajo, comentarios y documentación en español.

## Objetivo

Simplificar `/cierre`: la página muestra hoy tres tarjetas de insumos redundantes y resulta confusa. Quedarán solo tres tarjetas — "Resumen de caja", "Productos vendidos" y "Consumo de insumos críticos" — con estados vacíos claros. El pipeline de datos de los resúmenes retirados se limpia de punta a punta. No existe ningún dato hardcodeado hoy; la verificación de que todo valor traza al API queda como checklist de auditoría a documentar en el PR.

## Estado actual verificado (no re-derivar)

- `/cierre` = `src/app/(panel)/cierre/page.tsx` → `CajaPanel` (`src/components/caja/caja-panel.tsx`) → `GET /api/caja/resumen` cada ~5 s (`useCashRegister`, `getCajaRefreshInterval`) → `CashRegisterSummary` (`src/components/caja/cash-register-summary.tsx`).
- `CashRegisterSummary` es **compartido** con el detalle de caja cerrada `src/app/(panel)/ventas/historial/[id]/page.tsx` (SSR vía `parseCashRegisterSummary`). Las tarjetas se quitan del componente: desaparecen de ambas vistas (decisión tomada).
- Las 5 cards actuales: "Resumen de caja" (líneas 143-262), "Productos vendidos" (264-283), "Consumo de insumos críticos" (285-304), "Insumos de recetas" (306-331, `recipe-supplies-card`), "Consumo total por insumo" (333-358, `supplies-summary-card`).
- Datos: ninguno hardcodeado. `productsSummary`/`criticalSuppliesSummary`/`recipeSuppliesSummary` son JSONB de `cash_registers` (`src/db/schema.ts` ~274-282) escritos incrementalmente por `saleService.updateCashRegisterSummary` (`src/application/services/saleService.ts` 56-129 → `addItemToSummary` en `src/lib/summary-helpers.ts`) y recalculados al cerrar/auto-cerrar por `calculatePagedSummaryFromSales`→`finalizeSummary` (`src/application/services/summaryService.ts`, esparcido con `...summary` en `cashRegisterService.ts` líneas ~95 y ~315). `suppliesSummary` NO se persiste: se deriva en lectura en `parseCashRegisterSummary` (`cashRegisterService.ts` 188-227) con `buildSuppliesSummary` + `productRepository.findAll(branchId, true)`.
- `fillMissingCriticalSupplies` (`summary-helpers.ts` 72-81) rellena con 0 los insumos críticos activos sin ventas — comportamiento deliberado que el E2E `tests/e2e/caja-cierre-vacios.spec.ts` verifica. Conservarlo tal cual.
- `/api/panel/resumen` devuelve el mismo resumen pero el dashboard (`dashboard-client.tsx`) solo usa totales/estado — no requiere cambios de UI.
- Ningún spec E2E referencia `recipe-supplies-card`/`supplies-summary-card`; `flujo-diario.spec.ts`, `ventas-pago-mixto.spec.ts` y `caja-cierre-vacios.spec.ts` solo usan `cash-register-product-item`/`cash-register-supply-item` (cards que permanecen).
- El tour apunta a `data-tour="caja-panel"` (contenedor), no a las cards — no se rompe.

## Decisiones ya tomadas (no re-debatir)

1. Las tarjetas se eliminan del componente compartido: desaparecen también del detalle `/ventas/historial/[id]`.
2. Limpieza completa: `recipeSuppliesSummary` deja de acumularse en ventas, de persistirse al cerrar y de exponerse en payloads; `suppliesSummary` y `buildSuppliesSummary` se eliminan (incluida la query `findAll` de `parseCashRegisterSummary`).
3. La columna `cash_registers.recipe_supplies_summary` y los datos históricos permanecen — **sin migración** (`schema.ts` no se toca).
4. Estados vacíos: las cards restantes muestran un mensaje cuando no hay datos (p. ej. "Sin ventas registradas" / "Sin consumo registrado") en lugar de una lista vacía.

## Reglas de negocio

1. Todo valor visible debe seguir proviniendo del payload del API o del SSR — prohibido introducir literales de negocio, nombres de productos o umbrales en la UI.
2. La auditoría de "datos hardcodeados" se reduce a verificar que cada campo renderizado traza a `cashRegister.*` del payload (ya es así hoy); documentar en el PR la verificación, no "arreglar" nada que no esté roto.
3. Cajas históricas cerradas con `recipe_supplies_summary` poblado siguen mostrándose igual (la card ya no existe; el dato queda en DB).
4. `aria-*`/`data-testid` de las cards restantes intactos; los testids de las cards eliminadas desaparecen con ellas.
5. Sin cambios en `/api/caja/abrir`, `/api/caja/cerrar` más allá de lo que devuelven; el polling y la lógica de auto-cierre no se tocan.

## Implementación detallada

### UI

- `src/components/caja/cash-register-summary.tsx`
  - Eliminar las cards "Insumos de recetas" (306-331) y "Consumo total por insumo" (333-358).
  - Quitar `recipeSuppliesSummary`/`suppliesSummary` de `CashRegisterSummaryData` (34-35) y sus lecturas (84-85).
  - Estados vacíos: en "Productos vendidos" y "Consumo de insumos críticos", si el mapa está vacío mostrar `<p className="text-sm text-muted-foreground">` con el mensaje en vez del `<ul>` vacío. ("Consumo de insumos críticos" en caja abierta casi nunca estará vacío por `fillMissingCriticalSupplies`, pero sí puede estarlo en el detalle SSR de cajas cerradas viejas.)
  - Verificar que la grilla `lg:grid-cols-2` con 3 cards se ve bien en desktop y mobile.

### Servicios y helpers

- `src/lib/summary-helpers.ts`
  - `addItemToSummary`: quitar el parámetro `recipeSuppliesSummary` y las escrituras sobre él (seguir acumulando `criticalSuppliesSummary` para `autoDiscount`/`beverage` — es lo que descuenta stock).
  - Eliminar `buildSuppliesSummary` y su JSDoc.
- `src/application/services/summaryService.ts`
  - `SummaryState`: quitar `recipeSuppliesSummary` y `productTypesByName` (solo existía para `buildSuppliesSummary`).
  - `finalizeSummary`: devolver solo `productsSummary` y `criticalSuppliesSummary` (además de totales).
- `src/application/services/saleService.ts`
  - `updateCashRegisterSummary`: quitar el mapa y el campo persistido `recipeSuppliesSummary` (líneas 83-88, 106, 125).
- `src/application/services/cashRegisterService.ts`
  - `parseCashRegisterSummary`: reducir a `productsSummary` + `criticalSuppliesSummary` (+ `fillMissingCriticalSupplies`); eliminar `recipeSuppliesSummary`, `suppliesSummary`, la query `productRepository.findAll` y el import de `buildSuppliesSummary`; ajustar `CashRegisterSummaryInput`.
  - Ojo: los `...summary` de los cierres (líneas ~95, ~315) quedan correctos sin tocar — el spread ya no incluirá los campos retirados.
- `src/config/caja.ts`: quitar `recipeSuppliesSummary` de la interfaz `CashRegister` (línea ~95).

### Tests

- `src/components/caja/cash-register-summary.test.tsx`: reemplazar los tests de `supplies-summary-card` por tests de estados vacíos y de que las cards eliminadas ya no renderizan (`queryByTestId('recipe-supplies-card')`/`queryByTestId('supplies-summary-card')` → `null`).
- `src/lib/summary-helpers.test.ts`: reescribir los casos de `addItemToSummary` sin `recipeSuppliesSummary`; eliminar tests de `buildSuppliesSummary`.
- `src/application/services/summaryService.test.ts`, `cashRegisterService.test.ts`, `saleService.test.ts`: actualizar asserts que esperan `recipeSuppliesSummary`/`suppliesSummary`.
- `src/application/services/orderService.test.ts` (~134-136), `src/components/ventas/sales-terminal.test.tsx` (~117-119), `src/app/api/panel/resumen/route.test.ts` (~59-62): quitar los campos de los mocks.
- No tocar specs E2E (ninguno referencia las cards eliminadas).

### Documentación

- `.devin/informes/guia-funcionamiento-pancheria.md`: actualizar la descripción de resúmenes de caja (~línea 201-215) — quitar la mención a la tarjeta "Insumos de recetas" y ajustar qué acumula cada JSONB.
- `.devin/informes/arquitectura/flujos-de-datos.md` (~línea 125): el cierre ahora congela `products_summary` y `critical_supplies_summary` (anotar que `recipe_supplies_summary` quedó legacy en cajas históricas).
- `lecciones-aprendidas.md`: la nota histórica sobre la tarjeta "Insumos de recetas" puede quedar, pero marcarla como retirada para no confundir.

## Consideraciones de seguridad y entorno

- No hay cambios de schema ni migraciones; la columna histórica queda intacta.
- No tocar `.env*` ni variables.
- Ejecutar E2E solo contra base descartable según `AGENTS.md`.

## Verificaciones

| Comando | Propósito |
| ------- | --------- |
| `npm run lint` | Estilo |
| `npx tsc --noEmit` | Tipos (los campos retirados no deben quedar referenciados) |
| `npm test` | Unitarios actualizados |
| `npm run knip` | `buildSuppliesSummary` y código muerto |
| `npm run build` | Build de producción |
| `npx playwright test tests/e2e/caja-cierre-vacios.spec.ts tests/e2e/flujo-diario.spec.ts tests/e2e/ventas-historial.spec.ts` | E2E de caja en base de prueba |
| Manual | `/cierre` con caja abierta sin ventas y con ventas (promo con aderezos + venta suelta): solo 3 cards, mensajes de vacío correctos; `/ventas/historial/[id]` de una caja cerrada vieja: sin las dos cards, sin errores |

## Checklist de auditoría "sin hardcodear" (incluir evidencia en el PR)

- [ ] Cada valor mostrado en `/cierre` traza a un campo del payload de `/api/caja/resumen` o del SSR — listar el mapeo.
- [ ] `formatMoney`, `formatDateTime`, `PAYMENT_METHOD_LABELS`, `getAutoCloseHours`/`autoCloseHours` del servidor: confirmar que no se introdujeron literales.
- [ ] Ningún nombre de producto/insumo en la UI (todo viene del mapa por `supplyName`/`productName`).

## Riesgos

- Quitar "Consumo total por insumo" elimina la única vista consolidada de aderezos/servicios consumidos; si el negocio lo necesita a futuro habrá que re-derivarlo (el histórico `recipe_supplies_summary` sigue en DB).
- Cambiar firmas de `addItemToSummary`/`finalizeSummary` obliga a actualizar varios archivos de test — es el grueso del trabajo, no la UI.
