# Prompt: Auditoría de factibilidad (solo lectura) — nueva sucursal: inventario de 59 ítems + menú vendible + trazabilidad + facturación

## Contexto

Proyecto: `pancheria` (repo choy666/pancheria) — Sistema de gestión de stock, ventas, productos, recetas, caja, cierre diario, multi-sucursal, catálogo público de pedidos, chat por pedido y videos.

Stack: Next.js 16.3.3 (App Router), React 19.2.8, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM 0.45.2 con PostgreSQL (Neon), NextAuth v5, Jest, Playwright.

Documentación de referencia obligatoria (leer antes de analizar):
- `CONTEXTO.md`, `AGENTS.md`, `README.md`
- `.devin/informes/lecciones-aprendidas.md`, `guia-funcionamiento-pancheria.md`, `entornos.md`, `checklist-pre-push.md`, `reporte-estado.md`
- `.devin/prompts/README.md` (convenciones de prompts e informes)
- `src/db/schema.ts` y las migraciones de `drizzle/`
- `.devin/prompts/archivados/promos-con-servicios-y-manuales.md` y `plan-rediseno-card-y-modal-pedido.md` (decisiones sobre recetas, opcionales, extras y resúmenes)

Archivos de código centrales para esta auditoría (leer con prioridad):
- `src/lib/catalog.ts` (`isPublicSellableProduct`) y `src/repositories/catalogRepository.ts` (`publicSellableConditions`)
- `src/lib/summary-helpers.ts` (`addItemToSummary`, `fillMissingCriticalSupplies`) y `src/application/services/summaryService.ts`
- `src/lib/branch-resolver.ts` (`listPublicBranches`, `getDefaultBranchId`)
- `src/application/services/branchService.ts` (`createBranch`, `deleteBranch`, `getBranchDeletionSummary`)
- `src/db/catalog-copy.ts` (`copyCatalogToBranch`)
- `src/application/services/recipeService.ts` (`saveRecipe`)
- `src/components/promo/promo-options-dialog.tsx` (selección de opcionales en UI)
- `src/lib/zod-schemas.ts` (`selectedRecipeItemIds`, validación de receta)
- `src/lib/availability-helpers.ts` (`calculateCompoundAvailability`)
- `src/application/services/orderService.ts` y `saleService.ts` (reservas, conversión a venta, mensaje automático de chat)

Todo en español. Severidades según la convención del proyecto: **crítico**, **mayor**, **menor**, **informativo**.

## Objetivo

Determinar con evidencia si el proyecto permite, tal como está:

A. Crear una NUEVA SUCURSAL y cargarle un inventario de 59 ítems.
B. Cargar en esa sucursal el MENÚ vendible de Panchería Popular (11 promos + extras) con recetas correctas, vendible por `/pedido` y `/ventas`.
C. Que cada venta de una promo deje detallado qué descuenta stock, qué no descuenta y qué se registra y dónde (incluido el conteo de vasos y toppings extra).
D. Registrar y, si aplica, facturar esas ventas correctamente.

Entregar veredicto, brechas y un plan de implementación por PRs chicos.

## Reglas estrictas (auditoría de solo lectura)

1. NO modifiques código, esquema, migraciones, seeds ni datos. Solo podés crear/editar el informe y los índices documentales (ver Entregable). Sin commit ni push.
2. NO te conectes a ninguna base. El esquema se lee de `src/db/schema.ts` y `drizzle/*.sql`. NO ejecutes `npm run test:e2e`, `npx tsx src/db/seeds.ts`, `drizzle-kit push/migrate` ni `npx vercel env pull`. NO actives `SEED_SAMPLE_CATALOG`.
3. NO leas ni imprimas valores de `.env*`. No hardcodees credenciales ni URLs.
4. Si una verificación requiere escritura, solo en base descartable (nombre terminado en `test`/`e2e`/`testing`/`qa`/`staging`, vía `.env.e2e`) y pedime confirmación antes. Nunca reutilices `.devin/tmp/env.ts` contra la base de desarrollo: pisa `.env.local` con `.env.e2e`.
5. Evidencia: `archivo → función/export/tabla`. Líneas solo si las verificaste contra el `HEAD`. No inventes hallazgos; lo no verificable va como `UNKNOWN / UNVERIFIED`.
6. Podés correr: `git status`, `git log`, `git diff`, `git rev-parse HEAD`, `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run knip`, `npm run build` (no requiere base).

## A. Inventario a cargar (59 ítems; unidad entre paréntesis)

Nota: el listado original tenía conteos erróneos en algunos encabezados; estos son los reales y suman 59.

1. Insumos críticos (2): Pan super pancho (unidad), Salchichas (paquete de 6 u.)
2. Descartables y packaging (9): Caja descartable chica (unidad/fardo), Caja descartable grande (unidad/fardo), Porta panchos super (unidad/fardo), Sorbetes (paquete), Vasos (tira), Bolsas (unidad), Folex (paquete), Rollo de cocina (rollo), Cintas (unidad)
3. Gas y cocina (7): Gas (garrafa), Aceite (litro/botella), Vinagre (botella), Sal gruesa (paquete), Ajo (bolsa), Provenzal (bolsita), Caldos (unidad)
4. Limpieza (3): Líquido para piso (bidón), Lavandina (bidón), Detergente (litro)
5. Salsas (7, sachet): Mayonesa, Ketchup, Mostaza, Salsa golf, Barbacoa, Chimichurri, Picante
6. Toppings y aderezos (6, sachet): Cheddar, Parmesano, Fugazzeta, Aceituna, Roquefort, Salame
7. Frescos y almacén (6): Choclo (lata), Huevos (unidad), Tomate (unidad), Cebolla (unidad), Morrones (unidad), Papas (unidad)
8. Bebidas (17, unidad): Coca-Cola 1 L, Coca-Cola 1,5 L, Coca-Cola chica, Doble cola 1 L (unidad/fardo), Doble cola chica, Pritty 1 L, Agua chica 500 ml, Agua 1,5 L, Agua de pera chica, Agua de manzana chica, Agua de pera 1 L, Agua de manzana 1 L, Agua de pomelo 1 L, Fanta 1,5 L, Jugo Tutti 475 ml, Cerveza grande 700 ml, Cerveza chica 475 ml
9. Postres (2, unidad): Postre Oreo, Flan

Las cantidades iniciales NO están definidas: primero se carga el catálogo (stock 0) y después se ajusta el stock. El stock real incluye medidas como "½ bolsa", "¾" o "a raspar".

## B. Menú vendible de Panchería Popular (fuente: dueño del local)

### Definiciones de pancho

- **Pancho común** (4 aderezos): Mayonesa, Ketchup, Salsa golf, Mostaza.
- **Pancho completo** (13 aderezos): los 4 anteriores + Barbacoa, Aceituna, Cheddar, Fugazzeta, Parmesano, Roquefort, Salame, Picante, Chimichurri. Además incluye los 5 toppings.
- **Toppings (5):** Choclo en grano, Huevo picado, Papas pay, Criollita, Mayonesa provenzal.
- "Súper Pancho + aderezos" en una promo = pancho común; "completo" = pancho completo. "Armá tu pancho a tu gusto": combinar aderezos y toppings libremente.

### Servicios y extras (no descuentan stock de ningún producto)

- **Vaso de gaseosa ($500):** servicio extra con precio. Se vende suelto y también va incluido en promos. NO descuenta stock de ningún producto, pero el dueño quiere llevar el conteo de cuántos vasos se vendieron (sueltos + dentro de promos).
- **Topping extra ($200 c/u):** agregado cobrable, mismo esquema que el vaso.

### Promos

| Promo | Precio | Composición según el menú |
|---|---|---|
| Pancho Popular | $1.000 | 1 Súper Pancho + 5 aderezos |
| Promo 1 | $1.500 | 1 Súper Pancho + 5 aderezos + vaso de gaseosa |
| Promo 2 | $2.000 | 1 Súper Pancho completo + vaso de gaseosa |
| Promo Pritty 1 | $2.000 | 1 Súper Pancho + aderezos + Pritty 500 cc |
| Promo Pritty 2 | $2.500 | 1 Súper Pancho completo + Pritty 500 cc |
| Promo Amigos 1 | $2.500 | 2 Súper Panchos + aderezos + 2 vasos de gaseosa |
| Promo Amigos 2 | $3.500 | 2 Súper Panchos completos + 2 vasos de gaseosa |
| Promo Popular | $10.000 | 5 Súper Panchos completos + Doble Cola 2,25 L |
| Promo Familiar | $11.000 | 9 Súper Panchos + aderezos + Doble Cola 2,25 L |
| Promo Familiar Plus | $16.000 | 9 Súper Panchos completos + Doble Cola 2,25 L |
| Popu Kids | $2.000 | 1 Súper Pancho completo + Juguito Tutti 200 cc |

### Inconsistencias ya detectadas (incluilas en el informe y proponé cómo resolverlas)

- El menú dice "+ 5 aderezos" pero el pancho común tiene 4 aderezos definidos.
- Menú: Pritty 500 cc / Doble Cola 2,25 L / Juguito Tutti 200 cc. Inventario: Pritty 1 L / Doble cola 1 L y chica / Jugo Tutti 475 ml. Los productos del menú no existen en el inventario.
- Nombres distintos: Papas pay vs Papas; Criollita vs Cebolla; Huevo picado vs Huevos; Mayonesa provenzal vs Provenzal (bolsita) + Mayonesa. Evaluá qué nombre verá el snapshot de receta (`supplyName`) y el operador.
- Aceituna, Cheddar, Fugazzeta, Parmesano, Roquefort y Salame figuran como "Toppings y aderezos" en inventario pero el menú los trata como aderezos; los toppings del menú son otros cinco.
- Bebidas sueltas, cerveza y postres NO están en el menú.
- El vaso descartable (Vasos, tira) y la gaseosa que se sirve NO se descuentan por el servicio "vaso de gaseosa": decisión del dueño. Documentalo como riesgo informativo (el consumo real queda solo como conteo de servicio).

## Estado verificado contra `HEAD` (`2bcf87c`, 2026-10-04)

Los siguientes puntos ya fueron verificados en código: **no los re-derives**, usalos como base y verificá solo lo listado en "Pendiente de verificar".

### Modelo de datos

- Tipos de producto (`product_type` enum, `src/db/schema.ts`): `critical_supply`, `compound`, `manual_supply`, `service`. `critical_supply` solo admite `criticalSupplyType` ∈ `bread`/`sausage`/`beverage`.
- `products.unit` es `varchar(50)` editable en `ProductForm`. **No existen** columnas de categoría ni SKU: la distinción "fardo/tira/sachet/bolsa" solo cabe en `unit` o en el nombre.
- **`stock`, `minStock`, `recipes.quantity`, `sale_items.quantity`, `order_items.quantity`, `*_item_recipes.quantity` y `stock_movements.quantity` son `integer`** → fracciones como "½ bolsa" o "a raspar" NO son representables.
- **No hay unicidad de nombre de producto**: ni constraint `(branchId, name)` en el schema (solo índice no-unique `products_name_idx`) ni chequeo `findByName` en `productService`. La clave `(branchId, nombre)` para carga masiva sería solo convención del script.
- `branches.name` es unique case-sensitive en DB; `createBranch`/`updateBranch` agregan chequeo case-insensitive en app (`src/application/services/branchService.ts`).
- `users.branchId` es NOT NULL con `onDelete: 'restrict'`: todo operador pertenece a una sola sucursal; la sucursal nueva necesita usuario propio para operar.

### Recetas y opcionales

- `saveRecipe` (`src/application/services/recipeService.ts`): exige ≥1 ítem con `autoDiscount`; todo `critical_supply` DEBE tener `autoDiscount=true`; los no-críticos NO pueden tener `autoDiscount`; rechaza `supplyId` duplicados y auto-referencia; el default de `isOptional` es `!autoDiscount` (o sea, un aderezo **obligatorio** dentro de una promo requiere `isOptional: false` explícito). Re-guardar una receta es delete+insert (`deleteByCompoundProductId` + `insertMany`) — relevante para idempotencia de la carga.
- `recipes` NO tiene `notes` ni unique `(compoundProductId, supplyId)`. Las aclaraciones (`notes`) viven en `order_items`/`sale_items` (migración `0034`) → son **por línea de pedido/venta, no por ítem de receta**.
- **El cliente puede activar Y desactivar cualquier ítem `isOptional` de la receta** (no solo quitar): `PromoOptionsDialog` muestra todos los opcionales como toggles inicializados por `selectedByDefault`, y el servidor valida `selectedRecipeItemIds` contra los `supplyId` opcionales sin exigir `selectedByDefault`. Lo que NO puede: agregar insumos ajenos a la receta ni tocar ítems no-opcionales. → "Armá tu pancho a tu gusto" es modelable hoy (evaluar precio fijo y UX).
- Los ítems de receta no tienen precio propio: quitar/agregar opcionales no cambia el precio de la promo. Un `service` puede ser opción gratuita dentro de una promo Y producto cobrable standalone con `price` propio (`CONTEXTO.md` §4).

### Vendibilidad y visibilidad pública

- Vendible al público (`isPublicSellableProduct` + `publicSellableConditions`): `compound`, `service` y `critical_supply` con `criticalSupplyType='beverage'`, con `isActive=true` y `deletedAt IS NULL`. Los `manual_supply` NO son vendibles ni se exponen.
- Se puede ocultar una bebida sin borrarla vía `isActive=false` (la condición pública exige `isActive`).
- `listPublicBranches` (`src/lib/branch-resolver.ts`): **no hay flag de visibilidad/activo en `branches`** — toda sucursal existente aparece en el selector de `/pedido` inmediatamente, incluso vacía (comentario explícito en el código). Cap defensivo `MAX_LIMIT=100`.
- `/api/public/catalogo` acepta `limit` hasta 200 → el catálogo público resultante cabe en una página.

### Flujo de pedidos, ventas y registro

- `pending` no reserva stock; `receiveOrder` (→ `in_process`) crea reservas en `order_stock_reservations` + movimiento `reserve`; `paid` descuenta; cancelar un `in_process` libera con `reserve_release` (`src/application/services/orderService.ts`).
- Snapshots por venta/pedido en `sale_item_recipes`/`order_item_recipes` con `selected`, `supplyName`, `supplyType`, `autoDiscount`, `isOptional`, `selectedByDefault`.
- Mensaje automático del chat al crear pedido: `orderService.ts` inserta mensaje con `senderType='operator'`, `senderName='Sistema'`, con insumos incluidos/quitados por promo.
- Pagos mixtos: tabla `sale_payments` (cash/transfer). Precios históricos: `sale_items.unitPrice`/`order_items.unitPrice` snapshot. Dinero: `numeric(10,2)` en DB, UI muestra enteros sin centavos (`formatMoney`).
- Idempotencia: `idempotencyKey` + huella SHA-256 en `sales`/`orders`.

### Resúmenes de caja (`src/lib/summary-helpers.ts` → `addItemToSummary`)

- `productsSummary`: unidades por **nombre de producto** vendido (incluye services sueltos y bebidas).
- `criticalSuppliesSummary`: bebidas vendidas sueltas + insumos con `autoDiscount=true` de los snapshots (`selected=true`); se rellena con ceros para todos los críticos activos (`fillMissingCriticalSupplies`).
- `recipeSuppliesSummary`: **todos** los ítems de snapshots con `selected=true` por `supplyName`, sin filtrar por `supplyType` → incluye `manual_supply` (aderezos/toppings) y `service` (vasos) dentro de promos. Tarjeta "Insumos de recetas" en cierre + CSV.
- Consecuencia verificada: **vasos sueltos quedan en `productsSummary` y vasos en promo en `recipeSuppliesSummary`** — contadores distintos, sin vista unificada (hipótesis del enunciado confirmada).

### Sucursales

- `createBranch` solo inserta la fila de `branches` (nombre, horarios, dirección, teléfonos, redes, ubicación). NO crea operador, caja, productos ni recetas.
- `deleteBranch` es hard delete en cascada app-level (`branchRepository.deleteCascade`) + cleanup de archivos (imágenes, adjuntos de chat, videos) y rate-limits; `getBranchDeletionSummary` expone flags de riesgo (sucursal por defecto, propia, última, caja abierta, pedidos activos).
- Altas: `src/app/(panel)/sucursales/nueva`, `/sucursales/[id]/editar`, `/usuarios/nuevo`. Seed con `NEW_BRANCH_*` (ver `src/db/seeds.ts`).
- **`copyCatalogToBranch` vive en `src/db/catalog-copy.ts`** (NO en `branchService`); consumidores: `src/db/seeds.ts` y `tests/e2e/helpers.ts`; **no hay UI**. Limitaciones verificadas que la descartan como solución tal cual:
  - Inserta `stock: 0` pero luego **copia el stock del origen** vía `adjustStock`/`restock` por cada producto con stock > 0 → no deja stock en 0.
  - **Pierde `isOptional`/`selectedByDefault`** en las recetas (solo copia `quantity`+`autoDiscount`; los defaults del schema quedan en `false`) → degradaría los aderezos quitables a obligatorios.
  - No copia imágenes (`imageUrl`/`imageKey` omitidos).
  - Es no-op si el destino tiene ≥1 producto; no soporta copia parcial ni reintentos incrementales.
- Alertas de stock bajo (`stockService.listStockAlerts`): cubren `critical_supply` Y `manual_supply` con `minStock > 0`.

### Facturación

- **No existe integración fiscal ni comprobante**: nada de AFIP/ARCA/factura electrónica/ticket/PDF/impresión en `src/`, `package.json` ni `.env.example`. "Facturar" hoy = registrar venta + caja + cierre.

### Otros

- `SEED_SAMPLE_CATALOG` existe en `seeds.ts`, apagado por defecto; seed solo en base vacía.
- Caché de servidor (`src/lib/server-cache.ts`, `DATA_CACHE_REVALIDATE_S`, tags `branches`/`public-catalog`): escrituras directas a la base NO invalidan tags.
- Paginación panel: `PAGE_SIZE_OPTIONS` 10/25/50/100; `fetchAllPages` carga el catálogo completo para `/ventas` y `PromoForm`.

## Pendiente de verificar (sí auditar con evidencia)

- `calculateCompoundAvailability` (`src/lib/availability-helpers.ts`): confirmar que la disponibilidad de un `compound` depende solo de los `autoDiscount` y que los opcionales no la afectan → con stock 0 en pan/salchicha, ¿las 11 promos quedan no disponibles aunque los aderezos sean manuales?
- Pedir con caja cerrada o sin horarios: `getCashRegisterShiftStatus`/`resolveCashRegisterAlert` (`src/lib/cash-register-helpers.ts`), `/api/public/sucursal/estado` y la guarda real al crear pedido.
- `convertOrderToSale`: cómo pasan los snapshots `order_item_recipes` → `sale_item_recipes` y el reintegro en anulación.
- Cobertura de tests existente (unitarios y E2E) para sucursales, recetas, opcionales y resúmenes.
- Cualquier otra afirmación no listada arriba.

## Qué auditar

1. **Creación de sucursal.** Qué crea y qué NO (operador, horarios, caja, productos, recetas) — ya verificado parcialmente arriba; completar con: si arrastra datos de otra sucursal, y qué sucede en la operación real (¿se puede pedir con caja cerrada o sin horarios? confirmar la guarda en `createOrder`/`receiveOrder`, no solo el estado mostrado).
2. **Modelo de datos del inventario (A).** Tipo recomendado por categoría (hipótesis: Pan → `critical_supply` bread; Salchichas → `critical_supply` sausage; Bebidas → `critical_supply` beverage; resto → `manual_supply`). Dónde guardar "fardo/tira/sachet/bolsa" (solo `unit` o nombre). Cómo representar "½ bolsa" o "a raspar" siendo `stock` entero (¿unidad mínima divisible, p. ej. "medio paquete"? evaluar opciones). Evaluar si falta un unique `(branchId, name)` para la carga masiva.
3. **Modelado del menú (B).** Para cada promo, ¿se puede expresar como `compound` con receta? Confirmá con evidencia:
   - Dos conjuntos fijos de aderezos (común de 4, completo de 13 + toppings a confirmar) como opcionales `manual_supply`, sabiendo que el cliente puede marcar/desmarcar cualquiera de la receta pero no agregar ajenos. Ver cómo encaja "Armá tu pancho a tu gusto" (¿promo aparte con todo opcional?) y el topping extra pagado.
   - Cantidades 1, 2, 5 y 9 panchos con Pan/Salchicha críticos y `quantity` entera; Salchichas por paquete de 6 vs por unidad (no existe conversión de unidades — evaluá cargar por unidad).
   - Bebidas dentro de la promo (Pritty 500 cc, Doble Cola 2,25 L, Tutti 200 cc) como `critical_supply` beverage con `autoDiscount` — y cómo resolver que no existen en el inventario.
   - Vaso de gaseosa como `service` con precio: incluirlo en recetas con cantidad 1 o 2 (obligatorio con `isOptional:false` vs opcional), venderlo suelto y agregarlo como línea de carrito a cualquier pedido. Confirmar si un `service` dentro de una promo suma su `price` al total o va incluido gratis (hipótesis según `CONTEXTO.md`: gratis dentro de promo).
   - Topping extra ($200): ¿un solo producto "Topping extra" o uno por topping? ¿Cómo sabe el operador cuál se eligió (`notes` de la línea, nombre del servicio)? ¿Descuenta stock de lata/sachet o queda sin descuento?
   - Visibilidad pública: con los 59 ítems cargados, qué aparece en `/pedido`, `/ventas`, `/api/public/catalogo` y `/api/public/disponibilidad`. Las 17 bebidas críticas serían públicas aunque el menú no las venda sueltas: se pueden ocultar con `isActive=false` (evaluá el efecto colateral: `isActive` también las saca de `/stock` y recetas — verificar qué filtra cada consulta). ¿Qué pasa con Cerveza (alcohol) y con Postres (sin tipo claro si se vendieran sueltos: `service` los haría vendibles pero sin stock)?
4. **Trazabilidad por promo (C). Obligatorio.** Para CADA una de las 11 promos y los 2 extras, armá una matriz con: (a) qué descuenta stock automáticamente y con qué movimiento (`stock_movements`, `reserve`/`reserve_release`/`sale`), (b) qué NO descuenta pero queda informado, (c) qué se registra y dónde (`sale_items`, `sale_item_recipes`/`order_item_recipes` con `selected`, `cash_registers` y cierre: `productsSummary`/`criticalSuppliesSummary`/`recipeSuppliesSummary`, historial de ventas, detalle del pedido en el panel, mensaje automático del chat, anulación/reintegro). Hipótesis ya confirmada: descuentan Pan, Salchichas y bebida crítica; aderezos, toppings y vasos solo se registran. Específicamente respondé: ¿se puede obtener en un solo lugar el total de vasos vendidos (sueltos + dentro de promos) y el total de cada topping/aderezo? Hoy quedan en contadores distintos (`productsSummary` vs `recipeSuppliesSummary`, verificado) — proponé el cambio mínimo y dónde se mostraría.
5. **Carga masiva.** No hay importación CSV/JSON ni alta masiva (verificado: sin `csv` en `src/`/`scripts/`); `copyCatalogToBranch` existe pero es inadecuada para este caso (ver Estado verificado). Evaluá: UI manual, script idempotente en `scripts/` (dry-run por defecto, `--apply` explícito, sucursal destino por parámetro/env, clave `(branchId, nombre)` — sin constraint en DB, implementarla en el script o evaluar migración —, stock inicial 0, transacción, datos en archivo versionado), seed o migración. Incluí la carga de recetas y promos, no solo productos. Considerá duplicados, reintentos y la invalidación de caché tras escrituras directas (los helpers de test mutan directo; un script debe llamar `revalidateTag` o documentar el TTL).
6. **Venta y stock end-to-end.** Seguí una Promo Familiar (9 panchos + Doble Cola 2,25 L) y una Amigos 1 (2 vasos) desde `/pedido` hasta caja: disponibilidad, reserva, descuento, snapshots, anulación y reintegro. Precios históricos, totales en pesos enteros (UI sin centavos), pagos mixtos (`sale_payments`). El catálogo cabe en la paginación pública (limit ≤200, verificado).
7. **Facturación (D).** Confirmado: la app solo registra ventas/caja/cierre; NO hay comprobante, ticket, PDF ni integración fiscal (ARCA/AFIP). Decilo explícitamente: "facturar" fiscalmente queda fuera del alcance actual; listá qué faltaría sin implementarlo. Separalo de "registrar la venta correctamente".
8. **Operación multi-sucursal.** Aislamiento por `branchId`, operador asignado (`users.branchId` único y obligatorio), selector del admin (`src/lib/selected-branch.ts`), horarios y caja de la sucursal nueva, riesgos de `deleteBranch`. `copyCatalogToBranch` ya evaluada arriba: si el plan la usa, debe corregirse antes (stock copiado, pérdida de `isOptional`/`selectedByDefault`, sin imágenes, no parcial).
9. **Calidad y riesgos.** Tests existentes de sucursales, productos, recetas y resúmenes de caja (unitarios y E2E), cobertura faltante, necesidad de migración, impacto en caché, `knip`, lint y tipos.

## Entregable

Creá `.devin/informes/auditoria-nueva-sucursal-stock-<YYYY-MM-DD>.md` (fecha del día de ejecución) con encabezado `**Estado:** abierto`, fecha y `git rev-parse HEAD`, y estas secciones:

1. **Veredicto** para A (inventario), B (menú vendible), C (trazabilidad) y D (facturación) por separado: PREPARADO / PARCIALMENTE PREPARADO / NO PREPARADO, con 2–3 líneas cada uno.
2. **Tabla de requisitos**: requisito | estado (OK / Falta / Riesgo) | severidad | evidencia (archivo → función) | esfuerzo (S/M/L).
3. **Mapeo propuesto** de los 59 ítems y de las 11 promos + extras a tipo, unidad y receta, marcando lo que no tiene tipo válido y las inconsistencias menú/inventario.
4. **Matriz de trazabilidad por promo** (punto 4 de la auditoría).
5. **Brechas bloqueantes**, ordenadas por impacto.
6. **Plan de implementación en PRs chicos**: archivos a tocar, si requiere migración (`npx drizzle-kit generate`, aplicación con `migrate`; producción según `entornos.md`, con backup), tests a agregar y verificación (`npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`, `npm run knip`, `npx drizzle-kit check`; E2E solo en base descartable), más lo que pida `checklist-pre-push.md`.
7. **Decisiones que debo tomar** (máximo 6, con tu recomendación para cada una). Incluí como mínimo: si el completo incluye los 5 toppings; 4 vs 5 aderezos en el común; nombres de productos del menú vs inventario (Pritty 500 cc, Doble Cola 2,25 L, Tutti 200 cc, Papas pay, etc.); Salchichas por unidad o por paquete; si Cerveza/Postres/bebidas sueltas se publican; alcance de "facturar".
8. **Riesgos y no probado**, con el motivo.

Actualizá en el mismo cambio los índices `.devin/informes/README.md` y el bloque Estructura de `.devin/README.md`. Sin commit ni push. Avisame cuando termines.
