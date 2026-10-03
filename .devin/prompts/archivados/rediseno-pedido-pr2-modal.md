# Prompt: PR 2 del rediseño de `/pedido` — modal de personalización

> **Estado: archivado — ejecutado.** Implementado y mergeado en `main` (2026-10-02, commit `3a029e4`); informe en `../../informes/archivados/rediseno-pedido-pr2-2026-10-02.md`.

## Contexto

Proyecto: `pancheria`. Stack: Next.js 16, React 19, TS, Tailwind v4, shadcn/ui
sobre Base UI, Drizzle/PostgreSQL.

Continuación de [plan-rediseno-card-y-modal-pedido.md](plan-rediseno-card-y-modal-pedido.md)
**después del PR 1 ya implementado**. Estado y decisiones:
[rediseno-pedido-pr1-2026-10-02.md](../../informes/archivados/rediseno-pedido-pr1-2026-10-02.md).

## Estado vigente tras PR 1 (ya hecho — no repetir)

- Tema claro con scope `[data-theme='light']` aplicado en
  `src/app/(public)/layout.tsx`; `<html>` sigue `dark` para panel/ventas.
- Tokens de marca: `bg-brand-red` (`#D81F26`), `bg-brand-mustard` (`#F9B217`),
  `text-brand-ink` (`#1a1a1a`); `--font-heading` = Anton, `--font-sans` =
  Poppins dentro del scope claro.
- `PromoOptionsDialog` ya tiene prop `variant?: 'public' | 'sales'`
  (default `sales` = oscuro). En `variant="public"` el `DialogContent`
  recibe `data-theme="light"` — requisito porque portalea a `document.body`.
  Ya se pasa `variant="public"` desde la card de catálogo y desde la edición
  de línea en `pedido-client.tsx`.
- Card pública nueva: hero con gradiente rojo→mostaza + `ProductCardImage`
  (fallback monograma + skeleton + `priority` en primera fila), pill PROMO,
  badge `N en tu pedido` sobre el hero, quick-add con defaults en
  `add-product-${id}` y botón circular `customize-product-${id}`.
  **Decisión PR 1**: la card NO es `role="button"` (evita interactives
  anidados); no reintroducirlo.
- Tests unitarios actualizados: `product-card-base.test.tsx`,
  `product-card.test.tsx` (wrapper público), `promo-options-dialog.test.tsx`
  (tests nuevos de `variant`), `product-style.test.ts`.

## Objetivo del PR 2

Rediseñar `PromoOptionsDialog` (`src/components/promo/promo-options-dialog.tsx`)
según el mockup del plan, manteniendo compatibilidad con `/ventas`:

1. **Variante pública (`variant="public"`)**:
   - Hero con la imagen del producto (`ProductCardImage` o equivalente) y
     botón cerrar en círculo blanco arriba a la derecha.
   - Nombre + precio rojo en la misma fila; descripción corta debajo
     (recibir `imageUrl`/`description` por props; pasarlos desde
     `ProductCardBase`, `pedido-client.tsx`/`usePedidoClient` — también en
     `editingLine` — y `sales-terminal.tsx` con valores o undefined).
   - Sección **"A TU GUSTO"**: una fila por insumo opcional con toggle —
     `role="switch"`/`aria-pressed`, texto "✓ Lleva" (rojo) / "Sin <nombre>"
     (gris). Reemplaza checkboxes. Respetar `selectedByDefault` e
     `initialSelectedIds` (edit).
   - Sección **"SUMALE"** para servicios opcionales (`supplyType === 'service'`):
     mismo toggle, sin precio (los opcionales no cobran — ver decisión 6 del plan).
   - Los insumos NO opcionales ya no se listan como filas.
   - Stepper de cantidad `− 1 +` (arranca en 1, ≥ 44 px); **oculto en
     `mode="edit"`** (la línea es una unidad).
   - Footer fijo con CTA `Agregar · {formatMoney(productPrice × qty)}`;
     en edit: "Guardar cambios" (o `confirmLabel`).
   - **Sin campo de aclaraciones** (PR 3).
   - Mobile: hoja desde abajo; escritorio: dialog centrado. **No existe
     Drawer/vaul** — resolver con el mismo `DialogContent` + clases
     condicionales (bottom-sheet en `<sm`, centrado en `sm:`) o evaluar
     dependencia. Cuerpo con scroll, `max-h` en `dvh`.
2. **Variante `sales`**: sin hero, sin cambio visual de fondo (oscuro); puede
   adoptar la misma estructura de secciones/stepper si queda limpio, o
   conservar su layout actual — la regla es no romper `mode="edit"`,
   `confirmLabel` ni sus tests.

## Cambios de payload

- `PromoOptionsConfirmPayload` gana `quantity: number`.
- `usePedidoClient`/`sales-terminal`: para productos personalizables crear
  **N líneas** (una por unidad, `lineId` propio) llamando `addItem(product,
  ids)` N veces o equivalente, respetando `availability` (el tope ya lo
  impone `useSellableCart`). En `mode="edit"` quantity siempre 1.
- `useSellableCart`/`useCart`: no hace falta tocar el modelo (una línea por
  unidad ya existe); verificar que N llamadas respeten disponibilidad.

## E2E a migrar (documentado en el informe del PR 1)

- Specs que abren el modal con `add-product-${id}` → ahora ese botón es
  quick-add; usar `customize-product-${id}`.
- El locator `Agregar al pedido` cambia al CTA con precio: regex
  `Agregar ·` o testid nuevo.
- Correr `npm run test:e2e` solo con `.env.e2e` en base descartable (ver
  `AGENTS.md`).

## Tests unitarios a actualizar

- `promo-options-dialog.test.tsx`: textos de secciones ("Podés sacar" →
  "A TU GUSTO"/"SUMALE"), CTA con precio, stepper (incrementa/decrementa,
  oculto en edit), toggles con `aria-pressed`/`role="switch"`, payload con
  `quantity`, hero en variante pública / ausente en sales.
- `product-card-base.test.tsx`: si cambia la integración con el diálogo
  (props nuevas pasadas).
- `pedido-client.test.tsx` si el flujo de edición/agregado cambia firma.

## Verificaciones

`npm run lint` · `npx tsc --noEmit` · `npm test` · `npm run knip` ·
`npm run build`. Capturas mobile + desktop del modal en ambas variantes.
Dejar informe corto en `.devin/informes/` y actualizar índices
(`.devin/informes/README.md`, `.devin/README.md`).

## Fuera de alcance (no hacer)

- Aclaraciones por ítem (PR 3, requiere migración + cocina).
- Extras cobrables ("+ $X" en SUMALE) — feature aparte con pricing
  server-side.
- Cambios en backend/schema.
