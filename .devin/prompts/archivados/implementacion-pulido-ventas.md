# Prompt: Pulido final del terminal `/ventas` (Fase 3 de §8.2 de la auditoría — opcional)

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja, pedidos públicos y multi-sucursal.

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM con PostgreSQL (Neon), NextAuth v5.

Documentación de referencia obligatoria:
- `AGENTS.md`
- `.devin/informes/lecciones-aprendidas.md`
- `.devin/informes/checklist-pre-push.md`
- `.devin/informes/archivados/auditoria-sincronizacion-ventas-pedido-2026-10-25.md` — **fuente de verdad**: §8.2 Fase 3, §8.1 filas de prioridad media/baja, §1.3 (densidad de la card), anexo A (capturas comparativas).

Todo el trabajo, comentarios y documentación en español.

## Alcance

**Fase de pulido, todos los ítems opcionales e independientes entre sí.** Ejecutar solo los que el usuario confirme; cada uno se puede mergear por separado. Requiere las Fases 1 (tema claro, `implementacion-tema-claro-ventas.md`) y 2 (quick-add, `implementacion-quick-add-ventas.md`) ya implementadas.

## Estado actual verificado (punto de partida — no re-derivar)

Verificado contra `HEAD` `bbcb1b8`; asume la estructura post-Fase 2 (card sales con botones `add-sale-product`/`customize-sale-product`):

- La card `sales` no tiene imagen ni pill PROMO (`product-card-base.tsx:249-320`); la variante `catalog` sí (hero `aspect-video` + `ProductCardImage` + fallback monograma + gradiente de marca, 136-241).
- La barra móvil del POS es una barra fina `fixed bottom-0` con `border-t bg-background/95` (`sales-cart.tsx:354-372`, testid `cart-mobile-bar`); la pública es una pill roja flotante `rounded-full bg-brand-red` (`pedido-client.tsx:261-283`, testid `mobile-cart-bar` — ojo: los nombres están invertidos entre superficies).
- `PromoOptionsDialog` `variant="sales"`: centrado, sin hero, con `showCloseButton` (`promo-options-dialog.tsx:251-264`); `variant="public"` trae hero + bottom-sheet mobile (256-279).
- El precio del POS usa `ProductCardPrice` `font-mono text-primary` (`product-card-price.tsx`); el público usa `font-heading` (Anton) en rojo de marca.
- El patrón "contenido claro + chrome oscuro" de Fase 1 no está documentado como lección todavía.

## Ítems

### 1. Hero/imagen en la card `sales` (decisión con evidencia)

- **Decisión abierta de la auditoría (§1.3):** la card sin imagen muestra más productos por pantalla (mejor para mostrador); la imagen ayuda a operadores nuevos.
- Evaluar hero `aspect-video` como en `catalog` (mismo `ProductCardImage` + fallback) y comparar densidad real (cards por viewport en 1280×900 y 390×844) antes de decidir.
- Si se adopta: reubicar `ProductCardSalesExtra` ("Podés sumar"/"Sin stock") y los badges para que sigan visibles; la pill "Promo" y el badge `N en venta` se superponen al hero como en `catalog`.
- Si se descarta: documentar el motivo en el informe y cerrar el ítem.

### 2. `PromoOptionsDialog` para el POS con hero/bottom-sheet

- Decidir si el diálogo del POS adopta el hero y/o la hoja inferior mobile de `variant="public"`, ahora que el tema ya puede ir en claro vía `dataTheme` (Fase 1).
- Si se adopta parcial (p. ej. bottom-sheet sin hero): el desacople `variant`/`dataTheme` ya hecho lo permite sin duplicar componente.
- Criterio: el diálogo del POS prioriza velocidad; el hero ocupa ~40% del alto en mobile — medir antes de adoptar.

### 3. Barra móvil como pill

- Restilar `cart-mobile-bar` (`sales-cart.tsx:357-370`) al patrón pill flotante de `mobile-cart-bar` (`pedido-client.tsx:265-281`): wrapper `fixed inset-x-0 bottom-0 z-40 p-3 lg:hidden` + `Button` `h-12 w-full rounded-full` con texto "Ver venta · N ítems · $total".
- **Conservar `data-testid="cart-mobile-bar"`** en el elemento interactivo (los specs `responsive`/`ventas-*` lo usan); el testid público NO se migra.
- Ajustar el spacer (`h-14` → `h-20`, línea 356) como hace la pública.

### 4. Precio de la card: mono vs Anton

- Decisión pendiente de la auditoría (§2.2): `font-mono` facilita comparación vertical en grilla densa; `font-heading` (Anton) mejora lectura de montos a distancia y emparenta con `/pedido`.
- Si se adopta Anton solo en la card sales: hacerlo en la variante `sales` de `ProductCardBase` (no tocar `ProductCardPrice`, que se usa en el panel oscuro — verificar sus otros usos antes de cambiarlo).

### 5. Documentar el patrón híbrido

- Agregar a `.devin/informes/lecciones-aprendidas.md` (junto a §18 del rediseño `/pedido`): el patrón "contenido claro + chrome oscuro" por `data-theme` en una sola página del panel, la propagación de `dataTheme` por props a portales compartidos (`PromoOptionsDialog`, `ConfirmDialog`, controles de caja) y la trampa de `dark:` dentro de scopes claros (`<html class="dark">` sigue activo: los `dark:*` se aplican igual dentro de `[data-theme='light']`).

## Fuera de alcance

- Nada estructural: no tocar datos, endpoints, esquema, polling, carrito, ni el layout de dos columnas.
- `/ventas/historial` permanece oscura y sin cambios.

## Criterios de aceptación

- [ ] Cada ítem ejecutado tiene captura antes/después en `.devin/informes/shots/` (1280 + 390).
- [ ] `cart-mobile-bar` (testid) y `data-tour` intactos.
- [ ] Los ítems descartados quedan documentados con motivo en el informe.

## Verificaciones

| Comando | Propósito |
| ------- | --------- |
| `npm run lint` + `npx tsc --noEmit` | Estilo y tipos |
| `npm test` | Unitarios |
| `npm run build` | Build |
| `npm run test:accessibility` (con `.env.e2e`) | Contraste del pulido |
| `npm run test:e2e` (con `.env.e2e`, base descartable) | Regresión `ventas-*`, `responsive` |

## Cierre de la tarea

- Actualizar `.devin/informes/archivados/auditoria-sincronizacion-ventas-pedido-2026-10-25.md` §8.2 con el estado de cada ítem (implementado/descartado + motivo).
- Cuando las tres fases estén cerradas: archivar el informe de la auditoría y los prompts de implementación en `archivados/` según la convención, actualizando `.devin/prompts/README.md`, `.devin/informes/README.md` y el bloque Estructura de `.devin/README.md`.
- Si se mergea un PR, `reporte-estado.md` §0 se actualiza según la convención del proyecto.
