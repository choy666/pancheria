# Prompt: Pendientes de pedidos con múltiples líneas personalizadas

## Estado

Todas las tareas se completaron y se verificaron con la batería completa de comandos. El feature está listo para producción.

```text
npx tsc --noEmit          OK
npm run lint              OK
npm test                  125 suites / 1205 tests OK
npm run build             OK
npm run knip              OK
npm run test:e2e          104 tests OK
```

## Resumen de cambios aplicados

- `src/components/pedido/pedido-success-dialog.tsx`: clave única por línea de pedido confirmado, evitando keys duplicadas de React.
- `src/components/pedidos/usePedidoDetail.ts`: agregó `recipeSnapshot` al tipo `OrderDetailItem` para mostrar recetas en el detalle del panel.
- `tests/e2e/helpers.ts`: `setupSecondBranchForE2E` configura `openingHours` válidos para la sucursal secundaria.
- `tests/e2e/pedido.spec.ts`: nuevo test de cobertura de panel y chat con múltiples líneas del mismo producto.
- `src/lib/product-helpers.test.ts`: cobertura directa de `validateCartAvailability` con selecciones distintas.

## Pendientes resueltos

1. **Warning de React: keys duplicadas** — corregido en `pedido-success-dialog.tsx`; se auditaron `pedido-catalog-section.tsx`, `sales-terminal.tsx` y `promo-options-dialog.tsx` sin encontrar duplicación semántica.
2. **Flaky test E2E de sucursal no default** — causado por `openingHours: []`; resuelto en `tests/e2e/helpers.ts`.
3. **Cobertura E2E de panel y chat** — agregado test que verifica dos líneas con resúmenes distintos y el mensaje de preparación del sistema.
4. **Test directo de `validateCartAvailability`** — cobertura de dos líneas del mismo producto con consumo combinado de insumos.
5. **Duplicación leve de tarjetas de producto** — se decidió no extraer `BaseProductCard` por las diferencias de interacción, badge y contenido.
6. **Sincronización del plan** — `plan-pedidos-personalizados-multiples-lineas.md` y este prompt se actualizaron con el estado final.
