# Runbook — Alta operativa de una sucursal nueva

**Estado:** vigente | **Fecha:** 2026-10-04

Checklist operativo para poner en marcha una sucursal nueva con el catálogo de
Panchería Popular (59 ítems de inventario + menú de 11 promos + extras). Es el
PR-6 del plan de `auditoria-nueva-sucursal-stock-2026-10-04.md` — sin código,
solo procedimiento verificado contra la implementación real.

> **Regla de oro:** todo el recorrido se ensaya primero en una base
> **descartable** (`.env.e2e`, nombre terminado en `test`/`e2e`/`testing`/`qa`/
> `staging`). Nada se ejecuta por primera vez contra producción.

---

## 0. Antes de empezar (datos a tener a mano)

| Dato | Dónde se define | ¿Ya está? |
|---|---|---|
| Nombre, dirección, teléfono, ubicación y horarios de la sucursal | Panel `/sucursales/nueva` o vars `NEW_BRANCH_*` del seed | ☐ |
| Usuario y contraseña del operador | `/usuarios/nuevo` | ☐ |
| Precios de venta de bebidas sueltas y postres | Panel `/productos` tras la carga | ☐ (22 ítems nacen inactivos a propósito) |
| Stock físico inicial por ítem (en la unidad mínima: salchichas por **unidad**, aderezos por sachet, etc.) | Archivo de datos del script (campo `initialStock`) o ajustes en `/stock` | ☐ |
| Monto inicial de caja | `/caja` al abrir | ☐ |
| Base descartable configurada en `.env.e2e` para el ensayo | `entornos.md` | ☐ |

Migraciones: si el repo tiene `drizzle/` con migraciones pendientes, la base
destino debe estar migrada (`npx drizzle-kit migrate` — convención en
`entornos.md`; producción con backup previo).

---

## 1. Alta de la sucursal

Dos caminos, elegir uno:

- **Panel** (recomendado, auditable): admin → `/sucursales/nueva` → nombre,
  dirección, teléfono de contacto principal, ubicación (URL de mapa), redes y
  **horarios de apertura**. Sin horarios la sucursal se considera abierta
  siempre que haya caja abierta.
- **Seed**: definir `NEW_BRANCH_NAME`, `NEW_BRANCH_USERNAME`,
  `NEW_BRANCH_PASSWORD` y opcionales `NEW_BRANCH_ADDRESS`, `NEW_BRANCH_PHONE`,
  `NEW_BRANCH_LOCATION`, `NEW_BRANCH_SOCIAL_LINKS`,
  `NEW_BRANCH_OPENING_HOURS` en `.env` y correr `npx tsx src/db/seeds.ts`.

Verificación: la sucursal aparece en `/sucursales` con sus horarios.

## 2. Alta del operador

Admin → `/usuarios/nuevo` → usuario, contraseña y sucursal asignada. Verificar
login con ese usuario y que el panel quede scoped a la sucursal nueva.

## 3. Carga del catálogo (script PR-1)

El script es idempotente y corre en una transacción única (todo o nada).

```bash
# 1) Dry-run: imprime el plan (crea / omite / recetas) sin escribir nada
npx tsx scripts/cargar-catalogo.ts --branch "<id o nombre de la sucursal>"

# 2) Revisar el plan: productos a crear, omitidos por nombre, recetas,
#    y la lista de productos que quedarán INACTIVOS por precio pendiente.

# 3) Aplicar
npx tsx scripts/cargar-catalogo.ts --branch "<id o nombre>" --apply
```

Qué hace:

- Crea los **76 productos** del catálogo versionado
  (`scripts/data/catalogo-pancheria-popular.ts`): 59 de inventario, 4 propios
  del menú (Pritty 500 cc, Doble Cola 2,25 L, Jugo Tutti 200 cc, Mayonesa
  provenzal), 2 extras (Vaso de gaseosa $500, Agregado de toppings $200) y las
  11 promos compuestas.
- Escribe las **11 recetas** respetando `isOptional`/`selectedByDefault` y el
  tope `maxOptionalSelections=4` de los compuestos del pancho común.
- Aplica `initialStock` del archivo de datos solo a productos **nuevos**
  (vía `adjustStock` tipo `restock`, `performedBy='Script'`).
- Dedup por `(branchId, nombre)` case-insensitive: un existente se omite y se
  reporta el diff — nunca pisa precio, tipo ni tope de un producto ya cargado.

> Si se corre con las variables de `.env.e2e` (o un `.env` cargado en la
> consola), escribe en la base que `DATABASE_URL` indique — verificar a qué
> base apunta antes de `--apply` (`entornos.md` §"Cómo identificar a qué
> entorno apunta una URL").

## 4. Precios pendientes (bloqueo de publicación)

Las **bebidas sueltas y postres** (22 ítems) se crean `isActive=false` +
`price=0` a propósito: el inventario no define su precio de venta y publicarlos
a `$0` sería un error real.

Operador → `/productos` → editar cada uno → cargar precio + activar.
En recetas ya funcionan igual (`isActive` no afecta el consumo como insumo).

## 5. Stock inicial

- Si se definió `initialStock` en el archivo de datos, ya quedó aplicado a los
  productos nuevos (paso 3).
- Ajustes posteriores: `/stock` → ajuste por producto (tipo `restock`),
  recordando que salchichas cuentan por **unidad** (6 × paquetes) y el resto
  por su unidad mínima (sachet, unidad, litro...).
- Los compuestos (promos) no tienen stock: su disponibilidad se calcula de la
  receta. El campo `stock` queda en 0 a propósito.

## 6. Apertura de caja

Operador → `/caja` → abrir con monto inicial. Sin caja abierta no hay ventas
ni pedidos (requisito del sistema).

## 7. Verificación de punta a punta

En **descartable** primero, luego en producción:

- [ ] `/pedido?branchId=N` muestra el catálogo público de la sucursal
  (promos, extras, bebidas/postres activos).
- [ ] Un pedido público completo: promo del común con **4 aderezos a elección**
  (el diálogo permite sustituir los clásicos y bloquea al superar el tope),
  llega a `/pedidos`, se confirma y descuenta stock de pan/salchichas/aderezos.
- [ ] Una venta del operador en `/ventas` con promo completa (13 aderezos +
  5 toppings por defecto).
- [ ] Cancelación de un pedido/devolución → reintegro de stock verificable en
  `/stock/movimientos` y en `suppliesSummary` de la caja.
- [ ] Cierre de caja: resumen con consumo total por insumo fusionado y
  diferencia de arqueo correcta.
- [ ] En la base de datos: `stock_movements` con `performedBy` coherente y
  `sale_items.recipe_snapshot` registrando los aderezos elegidos.

## 8. Caché del catálogo público

Las escrituras directas del script **no invalidan** el caché de servidor
(`public-catalog`, `branches`). Tras el `--apply`:

- esperar `DATA_CACHE_REVALIDATE_S` segundos (default 60 s), o
- redeploy para verlo inmediatamente en `/pedido`.

## 9. Fallbacks y reintentos

- **Script interrumpido / error a mitad:** la transacción hace rollback
  completo; corregir el dato y re-correr (es idempotente).
- **Re-ejecución tras carga parcial manual:** los productos ya existentes se
  omiten por nombre y se reportan; las recetas se reescriben.
- **Nombre duplicado bloqueado:** desde PR-2 hay índice único
  `(branch_id, lower(btrim(name)))` sobre productos activos; un duplicado en
  papelera no bloquea, pero restaurarlo exige que ningún activo use el nombre.

---

**Última actualización:** 2026-10-04 (PR-6 implementado; validado contra
`scripts/cargar-catalogo.ts` en base descartable E2E).
