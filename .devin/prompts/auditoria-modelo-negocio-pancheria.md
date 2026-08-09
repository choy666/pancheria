# Prompt: Auditoria del modelo de negocio de la pancheria

## Contexto del proyecto

- Nombre: `pancheria`
- Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui v4, Drizzle ORM con PostgreSQL (Neon), NextAuth v5.
- Arquitectura: repositorios + servicios de aplicacion + dominio.

Dominio actual relevado:

- `products` (`src/db/schema.ts`):
  - `type`: `critical_supply` | `compound` | `manual_supply`.
  - `criticalSupplyType`: `bread` | `sausage` | `beverage` (solo para `critical_supply`).
  - `price`, `unit`, `stock`, `minStock`, `isActive`.
- `recipes` (`src/db/schema.ts`):
  - Relacionan un producto `compound` con insumos (`supplyId` apunta a `products`).
  - `quantity`: cantidad consumida por unidad vendida.
  - `autoDiscount`: si es `true`, el sistema descuenta stock del insumo al vender y reintegra al anular.
  - Solo los productos de tipo `critical_supply` pueden tener `autoDiscount = true`.
- `sales` / `saleItems` (`src/db/schema.ts`):
  - Una venta tiene varios items; cada item apunta a un producto, cantidad, precio unitario y subtotal.
- `stockMovements` (`src/db/schema.ts`):
  - Registra movimientos de stock por venta, anulacion, ajuste manual o reposicion.
- Logica de venta (`src/application/services/saleService.ts`):
  - Solo se venden productos de tipo `compound` o `critical_supply` con `criticalSupplyType = 'beverage'`.
  - Para `compound`, la disponibilidad se calcula sobre los insumos con `autoDiscount = true`.
  - Al confirmar, descuenta stock de supplies con `autoDiscount = true` y de bebidas.
  - Al anular, reintegra.
- Logica de recetas (`src/application/services/recipeService.ts`):
  - Exige que una receta tenga al menos un insumo `critical_supply` con `autoDiscount = true`.
  - No permite insumos duplicados ni auto-referencia.
- Formularios (`src/components/productos/product-form.tsx`, `src/components/productos/recipe-editor.tsx`, `src/components/ventas/sales-terminal.tsx`).

## Nota sobre datos existentes

- Las promos, productos, stock y ventas actualmente cargados en el sistema (incluyendo los datos de ejemplo de `src/db/seeds.ts` y cualquier registro previo en la base de datos) **no tienen relevancia** para arrancar con lo que realmente importa.
- El auditor debe tomar como fuente de verdad **unicamente el modelo de negocio compartido mas abajo**.
- El dominio actual del codigo sirve solo para entender las capacidades tecnicas del sistema (tablas, servicios, validaciones, UI), no para conservar ni adaptar los datos de ejemplo.
- Cualquier propuesta debe partir desde cero: catalogo de productos, promos, recetas y stock basado en lo que se detalla a continuacion.

## Modelo de negocio a auditar

Se debe verificar que el sistema permita gestionar los siguientes productos, promos, extras y reglas de stock.

### Insumos / productos base

A continuacion la lista de productos/insumos que la pancheria manejaria. Deben poder crearse, editarse, eliminarse y modificarse su stock manual o automaticamente. Stock inicial propuesto:

| # | Producto | Stock inicial sugerido |
| -: | ---------------- | ----: |
| 1 | Pan | 32 |
| 2 | Salchichas | 10 |
| 3 | Gas | 2 |
| 4 | Caja chica | 4 |
| 5 | Porta super | 2 |
| 6 | Sorbetes | 4 |
| 7 | Folex | 4 |
| 8 | Bolsas camisetas | 4 |
| 9 | Mayonesa | 0 |
| 10 | Ketchup | 2 |
| 11 | Mostaza | 5 |
| 12 | Salsa golf | 1 |
| 13 | Cheddar | 2 |
| 14 | Parmesano | 7 |
| 15 | Fugazeta | 3 |
| 16 | Aceituna | 1 |
| 17 | Salame | 6 |
| 18 | Roquefort | 2 |
| 19 | Barbacoa | 6 |
| 20 | Chimichurri | 3 |
| 21 | Picante | 2 |
| 22 | Choclo grano | 7 |
| 23 | Choclo crema | 0 |
| 24 | Choclo arveja | 0 |
| 25 | Huevos | 4 |
| 26 | Tomates | 4 |
| 27 | Morrones | 2 |
| 28 | Cebollas | 2 |
| 29 | Provenzal | 4 |
| 30 | Ajo | 4 |
| 31 | Papas pay | 0 |
| 32 | Coca de 1L | 10 |
| 33 | Coca de 1,5L | 8 |
| 34 | Coca de 350cc | 0 |
| 35 | Pritty | 0 |
| 36 | Doble cola | 0 |
| 37 | Jugos Tutti | 0 |
| 38 | Cerveza grande | 0 |
| 39 | Cerveza chica | 4 |
| 40 | Rollo de cocina | 7 |
| 41 | Aceite | 4 |
| 42 | Vinagre | 4 |
| 43 | Detergente | 3 |
| 44 | Lavandina | 2 |
| 45 | Liquido piso | 0 |
| 46 | Sal gruesa | 4 |
| 47 | Vasos | 9 |
| 48 | Cinta | 4 |
| 49 | Tartarina | 11 |
| 50 | Caldo | 2 |

Nota: en la fuente original el numero 49 aparecia duplicado (Tartarina y Caldo). Se corrige el ultimo a 50 para evitar colisiones.

### Promos / combos a vender

Cada promo se vende como una unidad y debe descontar del stock exactamente lo que indica. A continuacion se detallan los productos vendibles (combos y algunos items individuales), su precio y el descuento de stock esperado.

| Promo | Descripcion | Precio | Descuento de stock por unidad vendida |
| ----- | ----------- | ------: | ------------------------------------- |
| Promo 1 | Super Pancho + 5 aderezos | $1.000 | 2 salchichas + 1 pan |
| Promo 2 | Super Pancho + 5 aderezos + vaso de gaseosa | $1.500 | 2 salchichas + 1 pan |
| Promo 3 | Super Pancho completo (aderezos y salsas) + vaso de gaseosa | $2.000 | 2 salchichas + 1 pan |
| Promo Amigos 1 | 2 Super Panchos + aderezos + 2 vasos de gaseosa | $2.500 | 4 salchichas + 2 panes |
| Promo Amigos 2 | 2 Super Panchos completos + 2 vasos de gaseosa | $3.500 | 4 salchichas + 2 panes |
| Promo Pritty 1 | Super Pancho + aderezos + Pritty 500cc | $2.000 | 2 salchichas + 1 pan + 1 Pritty 500cc |
| Promo Pritty 2 | Super Pancho completo + Pritty 500cc | $2.500 | 2 salchichas + 1 pan + 1 Pritty 500cc |
| Promo Popular | 5 Super Panchos completos + Doble Cola 2,25L | $10.000 | 10 salchichas + 5 panes + 1 Doble Cola 2,25L |
| Promo Familiar | 9 Super Panchos + aderezos + Doble Cola 2,25L | $11.000 | 18 salchichas + 9 panes + 1 Doble Cola 2,25L |
| Promo Familiar 2 | 9 Super Panchos completos + Doble Cola 2,25L | $16.000 | 18 salchichas + 9 panes + 1 Doble Cola 2,25L |
| Promo Kids | Super Pancho completo + Juguito Tutti 200cc | $2.000 | 2 salchichas + 1 pan + 1 Juguito Tutti 200cc |

### Extras / agregados

| Item | Descripcion | Precio | Regla de stock |
| ---- | ----------- | ------: | -------------- |
| Extras o agregados | Agregado de toppings | $200 c/u | No debe descontar nada del stock |
| Vaso de gaseosa | Vaso de gaseosa sola | $500 | No debe descontar nada del stock |
| Bebidas | Bebidas dependiendo las que existan en stock | $ variable | Si debe descontar del stock la bebida seleccionada |

## Objetivos de la auditoria

1. Determinar si el dominio actual (`critical_supply`, `compound`, `manual_supply`) es suficiente para representar todos los productos, promos y extras del modelo compartido, sin considerar los datos de ejemplo ni registros previos.
2. Mapear cada producto/insumo de la lista a un tipo y configuracion adecuados en el sistema.
3. Mapear cada combo/promo a un producto `compound` (o a la estrategia mas escalable), con sus recetas y cantidades exactas.
4. Verificar que al vender cualquier promo o combo se descuenten los insumos correctos y en las cantidades indicadas.
5. Resolver como vender productos que no descontaran stock (`Agregado de toppings`, `Vaso de gaseosa`).
6. Verificar que las bebidas se vendan individualmente y descuenten stock.
7. Identificar cambios necesarios en el schema, servicios, UI, tests y seed para que el modelo de negocio funcione de forma total y escalable.
8. Proponer mejoras de UX para crear productos y recetas de la forma mas simple y rapida posible.
9. Garantizar que el sistema siga siendo funcional y que las promos y productos escalen sin redisenar el nucleo.

## Archivos y areas a auditar obligatoriamente

- `src/db/schema.ts`
- `src/db/seeds.ts`
- `src/application/services/productService.ts`
- `src/application/services/recipeService.ts`
- `src/application/services/saleService.ts`
- `src/application/services/stockService.ts`
- `src/repositories/productRepository.ts`
- `src/repositories/recipeRepository.ts`
- `src/app/api/productos/route.ts`
- `src/app/api/productos/[id]/route.ts`
- `src/app/api/recetas/route.ts`
- `src/app/api/ventas/route.ts`
- `src/app/api/stock/ajustar/route.ts`
- `src/components/productos/product-form.tsx`
- `src/components/productos/recipe-editor.tsx`
- `src/components/productos/product-actions.tsx`
- `src/components/ventas/sales-terminal.tsx`
- `src/components/stock/stock-list.tsx`
- `src/config/api.ts`
- Tests en `src/application/services/*.test.ts`

## Checklist de auditoria

### 1. Productos / insumos

- [ ] Todos los productos de la lista pueden crearse sin errores.
- [ ] Se define una estrategia clara de tipo para cada uno:
  - `critical_supply` + `bread` para Pan.
  - `critical_supply` + `sausage` para Salchichas.
  - `critical_supply` + `beverage` para Coca, Pritty, Doble cola, Jugos Tutti, Cerveza, etc.
  - `manual_supply` para aderezos, salsas, toppings, cubiertos, vasos, rollos de cocina, insumos de limpieza, etc.
- [ ] Los productos `manual_supply` no se muestran en la terminal de ventas.
- [ ] El stock inicial se puede cargar facilmente por seed o por la UI.
- [ ] Se puede editar el stock manualmente sin afectar recetas.
- [ ] El `soft delete` no deja recetas huérfanas ni rompe integridad.
- [ ] Se detectan productos con stock cero o negativo y se visualizan adecuadamente.

### 2. Combos / promos

- [ ] Cada promo se modela como un producto `compound`.
- [ ] Cada promo tiene un precio fijo y una unidad representativa (por ejemplo `combo`, `unidad`, `promo`).
- [ ] La receta de cada promo incluye:
  - Pan (`critical_supply` `bread`, `autoDiscount = true`) en cantidad correspondiente.
  - Salchicha (`critical_supply` `sausage`, `autoDiscount = true`) en cantidad correspondiente.
  - Bebida (`critical_supply` `beverage`, `autoDiscount = true`) cuando corresponda (Pritty, Doble cola, Juguito Tutti, etc.).
  - Aderezos/salsas (`manual_supply` o `critical_supply` con `autoDiscount = false`) cuando se quiera trazarlos sin descuentar stock.
- [ ] La disponibilidad de un combo se calcula correctamente sobre el minimo de unidades disponibles de todos sus insumos con `autoDiscount = true`.
- [ ] Cuando hay varios combos que comparten insumos (Pan, Salchicha), la disponibilidad de cada uno considera el stock compartido.
- [ ] Se puede vender la misma promo varias veces, descontando proporcionalmente.

### 3. Extras que no descontaran stock

- [ ] Se define una estrategia para vender `Agregado de toppings` ($200 c/u) y `Vaso de gaseosa` ($500) sin descontar stock.
- [ ] Opciones posibles a evaluar y recomendar:
  - Nuevo tipo de producto `service` / `extra` vendible sin receta.
  - Permitir productos `compound` con recetas vacias o sin `autoDiscount`.
  - Producto `manual_supply` marcadolo como vendible (no recomendado, romperia semantica).
- [ ] La opcion elegida no rompe las validaciones de `recipeService.saveRecipe` ni `saleService.confirmSale`.
- [ ] El resumen de caja contabiliza correctamente la venta de extras.

### 4. Bebidas

- [ ] Cada bebida es un `critical_supply` con `criticalSupplyType = 'beverage'`.
- [ ] Las bebidas se venden individualmente y descuentan stock.
- [ ] Cuando una bebida forma parte de una promo, la receta de la promo la descuenta.
- [ ] Las bebidas se visualizan en la terminal de ventas con su disponibilidad real.
- [ ] Se puede elegir bebida en combos donde aplica (Pritty, Doble Cola, Juguito Tutti) sin romper la promo.

### 5. Ventas y stock

- [ ] `saleService.confirmSale` valida stock antes de confirmar.
- [ ] Al vender un combo se descuentan exactamente los insumos esperados.
- [ ] Los insumos `manual_supply` en recetas con `autoDiscount = false` no se descuentan.
- [ ] `saleService.cancelSale` reintegra los insumos consumidos.
- [ ] `stockMovements` registra cada descuento y reintegro.
- [ ] La caja refleja las ventas y el resumen de productos/insumos correctamente.
- [ ] No se permite vender un producto sin caja abierta.

### 6. UI/UX

- [ ] La creacion de producto es simple: nombre, tipo, tipo de insumo critico, precio, unidad, stock, stock minimo, activo.
- [ ] El editor de recetas permite agregar insumos, cantidades y marcar `autoDiscount` de forma clara.
- [ ] La terminal de ventas muestra solo productos vendibles (`compound` y bebidas).
- [ ] Se agrupan o destacan promos y productos individuales.
- [ ] Se indica cuando un producto esta sin stock o por debajo del minimo.
- [ ] El flujo de apertura de caja, venta y cierre es rapido y usable en el dia a dia.

### 7. Escalabilidad

- [ ] El sistema permite agregar nuevas promos sin cambios de schema.
- [ ] El sistema permite agregar nuevas bebidas/toppings/salsas sin cambios de schema.
- [ ] El sistema permite combos variables o con opciones en el futuro.
- [ ] El seed propuesto puede ejecutarse en un entorno limpio y cargar el catalogo inicial del modelo de negocio, sin depender de datos de ejemplo anteriores.

## Entregables esperados

1. **Inventario recomendado**: tabla con cada producto, tipo, `criticalSupplyType`, unidad y stock inicial.
2. **Catalogo de promos**: tabla con cada combo, precio, receta sugerida (insumos y cantidades) y mapeo a tipo de producto.
3. **Catalogo de extras y bebidas**: definicion de como vender items que no descontaran stock y bebidas que si lo hacen.
4. **Cambios tecnicos propuestos**: schema, servicios, API, componentes, tests y seed necesarios.
5. **Consejos de escalabilidad**: como preparar el sistema para futuras variantes, combos dinamicos, tamanos de bebida, etc.
6. **Plan de implementacion priorizado**: ordenar las recomendaciones por impacto y esfuerzo, con la razon del orden.
7. **Riesgos detectados**: inconsistencias, gaps o limitaciones que impedirian que el modelo de negocio funcione hoy.

## Reglas para el auditor

- Todo analisis debe basarse en el codigo existente (`src/db/schema.ts`, servicios, componentes) y en el modelo de negocio detallado arriba.
- Ignorar promos, productos, stock y ventas existentes; el proposito es arrancar desde el modelo de negocio compartido.
- No inventar datos sensibles, credenciales ni URLs.
- No proponer hardcodear precios, nombres ni stocks en el codigo fuente; deben ser configurables via seed, variables de entorno o base de datos.
- No realizar cambios destructivos (migraciones, borrado de datos, modificaciones en produccion) sin confirmacion explicita del usuario.
- Si se proponen cambios de schema, incluir el SQL o los pasos de migracion con Drizzle.
- Si se proponen tests, seguir el estilo de los tests existentes en `src/application/services/*.test.ts` y Playwright en `tests/` o `e2e/` si existen.

## Instruccion final

Audita el proyecto `pancheria` comparandolo con el modelo de negocio descrito. Identifica los gaps, propone los cambios concretos necesarios para que cada producto, combo, extra y bebida funcione correctamente, y ordena las recomendaciones por impacto. El sistema debe ser totalmente funcional y escalable para futuros productos, promos y ventas.
