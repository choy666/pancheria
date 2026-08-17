# Informe de auditoría — Pedidos, sucursal y cliente

**Fecha:** 2026-08-17  
**Proyecto:** `pancheria`  
**Prompt base:** <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/auditoria-pedidos-sucursal-cliente.md" /> y <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/recomendaciones-pedidos-sucursal-stock.md" />  
**Auditor:** Devin

---

## 1. Resumen ejecutivo

Se auditó el flujo de pedidos públicos (`/pedido`), el panel de pedidos (`/pedidos`) y la documentación asociada. La mayoría de los entregables del prompt <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/auditoria-pedidos-sucursal-cliente.md" /> ya están implementados: el cambio de sucursal invalida el carrito, `useCart` descarta productos de otra sucursal, `ProductCard` no presenta problemas de hidratación y los tests unitarios/E2E cubren el escenario.

Las verificaciones automatizadas pasan:

| Comando | Resultado |
| ------- | --------- |
| `npm run lint` | Pasa (exit 0) |
| `npx tsc --noEmit` | Pasa |
| `npm test` | 61 suites, 674 tests OK |

No se ejecutó `npm run test:e2e` porque `tests/e2e/global-setup.ts` trunca tablas de negocio y re-seedea la base de datos; requiere confirmación y una base de datos de prueba.

Se detectaron **inconsistencias documentación/código**, un **riesgo de negocio relevante** en la conversión de pedido a venta y algunos **puntos de deuda técnica** menores. Los hallazgos críticos se detallan a continuación.

---

## 2. Alcance

### Documentación auditada

- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/auditoria-pedidos-sucursal-cliente.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/recomendaciones-pedidos-sucursal-stock.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/auditoria-y-documentacion.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-estado.md" />
- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/README.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/environment.yaml" />

### Código auditado

- Ruta pública `/pedido` y sus componentes:
  - <ref_file file="C:/developer/paginas/pancheria/src/app/(public)/pedido/page.tsx" />
  - <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.tsx" />
  - <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/product-card.tsx" />
  - <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/cart-summary.tsx" />
  - <ref_file file="C:/developer/paginas/pancheria/src/hooks/useCart.ts" />
- APIs públicas:
  - <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/catalogo/route.ts" />
  - <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/disponibilidad/route.ts" />
  - <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/pedido/route.ts" />
  - <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/pedido/[id]/cancelar/route.ts" />
- Servicios de aplicación:
  - <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" />
  - <ref_file file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" />
  - <ref_file file="C:/developer/paginas/pancheria/src/application/services/catalogService.ts" />
- Panel de pedidos:
  - <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/pedidos/page.tsx" />
  - <ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/pedidos-list.tsx" />
  - <ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/pedido-detail.tsx" />
  - <ref_file file="C:/developer/paginas/pancheria/src/app/api/pedidos/route.ts" />
  - <ref_file file="C:/developer/paginas/pancheria/src/app/api/pedidos/[id]/route.ts" />
  - <ref_file file="C:/developer/paginas/pancheria/src/app/api/pedidos/[id]/confirmar/route.ts" />
  - <ref_file file="C:/developer/paginas/pancheria/src/app/api/pedidos/[id]/cancelar/route.ts" />
- Tests:
  - <ref_file file="C:/developer/paginas/pancheria/tests/e2e/pedido-sucursal-y-stock.spec.ts" />
  - <ref_file file="C:/developer/paginas/pancheria/tests/e2e/pedido.spec.ts" />
  - <ref_file file="C:/developer/paginas/pancheria/src/hooks/useCart.test.ts" />
  - <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.test.ts" />

---

## 3. Estado de los entregables del prompt de auditoría

| Entregable del prompt | Estado | Evidencia |
| ----------------------| ------ | --------- |
| Cambio de sucursal en `/pedido` con limpieza de carrito y recarga correcta del catálogo | Resuelto | `key={branchId}` en <ref_snippet file="C:/developer/paginas/pancheria/src/app/(public)/pedido/page.tsx" lines="42-49" />, `handleBranchChange` en <ref_snippet file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.tsx" lines="257-265" />, invalidación en <ref_snippet file="C:/developer/paginas/pancheria/src/hooks/useCart.ts" lines="105-114" /> |
| Corrección de duplicaciones/inconsistencias entre `orderService` y `saleService` | Parcialmente resuelto | `orderService` reutiliza `buildProductContext`, `validateProductsForOperation`, `validateCartAvailability`, `buildSaleItemValues`, `insertSaleAndUpdateCashRegister`, `deductStockForItems` y `reintegrateStockForItems` de `saleService`. Queda duplicación en cancelación de pedido vs. venta. |
| Corrección de hydration mismatch en `ProductCard` | Resuelto | <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/product-card.tsx" /> es puro, sin `useSyncExternalStore` ni `useState` de montaje. |
| Tests E2E actualizados y nuevos tests unitarios para el cambio de sucursal | Resuelto | <ref_file file="C:/developer/paginas/pancheria/tests/e2e/pedido-sucursal-y-stock.spec.ts" />, <ref_snippet file="C:/developer/paginas/pancheria/src/hooks/useCart.test.ts" lines="155-176" />, <ref_snippet file="C:/developer/paginas/pancheria/src/application/services/orderService.test.ts" lines="477-500" /> |
| Informe breve de hallazgos en `lecciones-aprendidas.md` | Resuelto | Sección **8. Pedidos públicos y panel de pedidos** en <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />. |

---

## 4. Hallazgos

### 4.1 Críticos / de negocio

#### H1. Riesgo de desfase de precio al convertir un pedido en venta

`convertOrderToSale` vuelve a calcular los valores de la venta a partir del precio **actual** del producto y la cantidad del pedido, ignorando el `unitPrice` y `subtotal` almacenados en `order_items`.

<ref_snippet file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" lines="284-289" />

`buildSaleItemValues` usa `product.price`:

<ref_snippet file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" lines="721-756" />

Si un administrador cambia el precio de un producto **después** de que el cliente hizo el pedido pero **antes** de que el operador lo confirme, la venta se generará con el precio nuevo, mientras que `order.total` conserva el precio viejo. Esto produce una inconsistencia contable entre el pedido y la venta (y potencialmente con el resumen de caja).

**Recomendación:** conservar los precios históricos. Permitir que `buildSaleItemValues` acepte un `unitPrice` opcional (priorizando `order.items.unitPrice`) o construir los `saleItemValues` directamente desde los `order_items` al convertir.

---

### 4.2 Mayores / documentación y arquitectura

#### H2. El prompt `auditoria-pedidos-sucursal-cliente.md` describe problemas que ya están resueltos

El prompt sigue catalogado como **activo** en <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/README.md" />, pero su sección **Estado actual relevante** presenta errores que ya no existen en el código:

- "El cambio de sucursal mediante el `<Select>` del encabezado no funciona correctamente" — actualmente `handleBranchChange` limpia el carrito y navega.
- "el carrito (`useCart`) no se invalida ni se reinicia" — `useCart` descarta items de otra sucursal.
- "ProductCard con `useSyncExternalStore` con subscribe vacío" — `ProductCard` no usa ese hook.

Esto puede confundir a futuros agentes y provocar refactorizaciones innecesarias.

**Recomendación:** mover el prompt a `.devin/prompts/archivados/` y actualizar el índice de prompts activos. Si parte del trabajo quedó pendiente, crear un prompt más pequeño y focalizado con el estado real.

---

#### H3. Contradicción entre documentación y código sobre `setState` dentro de `useEffect`

Tanto <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" /> como <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/recomendaciones-pedidos-sucursal-stock.md" /> afirman que se evitó `setState` dentro de `useEffect` y que se usa `key` para forzar el remonte.

Sin embargo:

- `PedidoClient` mantiene un `useEffect` que carga el catálogo y llama `setProducts`/`setLoading`:

  <ref_snippet file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.tsx" lines="148-173" />

- `useCart` usa `useEffect` para reinicializar el estado cuando cambia `branchId` y otro `useEffect` para persistir `items` en `localStorage`:

  <ref_snippet file="C:/developer/paginas/pancheria/src/hooks/useCart.ts" lines="105-132" />

- `eslint.config.mjs` no incluye una regla `react-hooks/set-state-in-effect` y además ignora todos los archivos de test.

  <ref_snippet file="C:/developer/paginas/pancheria/eslint.config.mjs" lines="1-23" />

**Recomendación:** decidir la postura real del proyecto:

1. Si se prohíbe `setState` en `useEffect`, migrar la carga inicial del catálogo a un Server Component o a una estrategia de `revalidateTag`/streaming, y ajustar `useCart` para que el cambio de `branchId` se resuelva exclusivamente por remonte (`key={branchId}`) sin efecto adicional.
2. Si el patrón está permitido, actualizar `lecciones-aprendidas.md` y `recomendaciones-pedidos-sucursal-stock.md` para no contradecir el código.

---

### 4.3 Menores / robustez y deuda técnica

#### H4. `PedidoPage` no valida que `branchId` sea un entero positivo

<ref_snippet file="C:/developer/paginas/pancheria/src/app/(public)/pedido/page.tsx" lines="17-23" />

`Number(params.branchId)` convierte `'1.5'` en `1.5`, que pasa la validación `parsed <= 0`. Ese valor no es un `branchId` válido y podría llegar a los repositorios. `z.coerce.number().int().positive()` de las APIs corrige el tipo, pero la página del Server Component debería rechazar valores no enteros desde el origen.

**Recomendación:** usar `Number.parseInt(params.branchId, 10)` o `Number.isInteger(parsed)` y redirigir a `/pedido` cuando no sea un entero positivo.

---

#### H5. Rate limiting de pedidos públicos vive en memoria

<ref_snippet file="C:/developer/paginas/pancheria/src/app/api/public/pedido/route.ts" lines="15-61" />

El `rateLimitMap` es un `Map` en el proceso de Node. En entornos serverless con múltiples instancias (Vercel), el límite no se comparte y un cliente puede distribuir requests para saltárselo.

**Recomendación:** documentar esta limitación en `AGENTS.md`/`.env.example` o, si el negocio lo requiere, implementar un rate limit compartido (Redis, Vercel KV, PostgreSQL) antes de escalar horizontalmente.

---

#### H6. Panel de pedidos depende de cookie implícita en lugar de `branchId` explícito

`PedidosList` recibe `branchId` como prop y refresca al cambiar, pero la función `load` no envía `branchId` en la URL:

<ref_snippet file="C:/developer/paginas/pancheria/src/components/pedidos/pedidos-list.tsx" lines="64-108" />

El backend `GET /api/pedidos` toma la sucursal de `getCurrentBranchId(session)`, que depende de la cookie `activeBranchId` para admins. Si la cookie y la prop se desfasan (por ejemplo, por un cambio de sucursal concurrente o por navegación con tabs), el listado puede mostrar pedidos de otra sucursal.

**Recomendación:** incluir `branchId` como query param en `PEDIDOS_API` y validarlo en el backend contra `getCurrentBranchId(session)`, de forma que la URL sea la fuente de verdad y se detecten desfases.

---

#### H7. Duplicación residual en la lógica de cancelación

`cancelOrder` y `cancelSale` reimplementan pasos similares: construir contexto de productos, reintegrar stock, actualizar estado y, en ventas, ajustar resumen de caja.

- `cancelOrder`: <ref_snippet file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" lines="167-226" />
- `cancelSale`: <ref_snippet file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" lines="909-1031" />

Esto aumenta la probabilidad de que una futura modificación (por ejemplo, cambio en el cálculo de resumen de caja) se aplique solo en un lado.

**Recomendación:** extraer una función interna `reintegrateStockAndUpdateCashRegister` (o similar) compartida por ambos servicios, dejando en cada uno solo la lógica específica de actualización del pedido/venta.

---

#### H8. Referencias a líneas exactas en prompts están desfasadas

`recomendaciones-pedidos-sucursal-stock.md` usa `<ref_snippet ... lines="200-260" />`, `360-420` y `700-780` para `saleService.ts`. Después de las refactorizaciones, esos rangos ya no apuntan a las funciones correctas.

**Recomendación:** preferir `<ref_file .../>` o nombres de funciones/exportaciones sobre números de línea, y revisar los prompts activos periódicamente.

---

#### H9. `PedidoClient` realiza una carga client-side duplicada del catálogo

El Server Component `PedidoPage` ya obtiene el catálogo con disponibilidad (`catalogService.listPublicCatalogWithAvailability(branchId)`), pero `PedidoClient` vuelve a fetchearlo inmediatamente al montar:

<ref_snippet file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.tsx" lines="148-173" />

Esto genera una petición extra y puede provocar parpadeo. El intervalo periódico posterior sí es necesario, pero la carga inicial podría omitirse.

**Recomendación:** usar los `initialProducts` del Server Component como estado inicial y dejar solo el `setInterval` para refresco periódico (o invalidar con `revalidateTag`/eventos de foco cuando sea apropiado).

---

#### H10. Numeración inconsistente en `lecciones-aprendidas.md`

La sección **7. Verificaciones estándar** aparece antes de **8. Pedidos públicos y panel de pedidos**, y luego se repite un **8. Tours interactivos y permisos de usuario**.

**Recomendación:** renumerar las secciones para mantener un índice coherente.

---

## 5. Recomendaciones priorizadas

1. **Corregir `convertOrderToSale` para respetar precios históricos** (crítico). Este es el único hallazgo que puede generar inconsistencia financiera inmediata.
2. **Actualizar el estado del prompt `auditoria-pedidos-sucursal-cliente.md`** (mayor). Moverlo a `archivados` o reescribirlo con el estado real para evitar confusiones.
3. **Resolver la contradicción sobre `useEffect`/`setState`** (mayor). Definir si la regla se aplica y ajustar el código o la documentación.
4. **Validar `branchId` como entero positivo en `PedidoPage`** (menor).
5. **Incluir `branchId` explícito en la API del panel de pedidos** (menor).
6. **Revisar rate limiting de pedidos públicos para producción** (menor/escalabilidad).
7. **Refactorizar lógica común de cancelación** (menor/deuda técnica).
8. **Eliminar la carga inicial duplicada del catálogo** (menor/performance).
9. **Actualizar referencias a líneas en prompts** (menor/documentación).
10. **Renumerar `lecciones-aprendidas.md`** (menor/documentación).

---

## 6. Verificaciones pendientes sugeridas

| Comando | Motivo |
| ------- | ------ |
| `npm run build` | Validar que el build de producción sigue pasando tras futuros cambios. |
| `npm run test:e2e` | Ejecutar solo contra una base de datos de prueba para validar los flujos de `/pedido` y `/pedidos`. |
| `npx drizzle-kit check` | Ejecutar si se modifican esquemas relacionados con pedidos. |

---

## 7. Conclusiones

El flujo de pedidos está funcional, cubierto por tests y alineado en lo esencial con la documentación. Sin embargo, hay una **deuda documental** importante: el prompt `auditoria-pedidos-sucursal-cliente.md` ya no refleja el estado real del código, y `lecciones-aprendidas.md`/`recomendaciones-pedidos-sucursal-stock.md` contradicen el uso real de `useEffect`/`setState`.

El único riesgo de negocio identificado es la **reconversión de precios en `convertOrderToSale`**, que debería corregirse antes de que haya cambios de precio concurrentes con pedidos pendientes.

El resto de los hallazgos son oportunidades de mejora en robustez, claridad documental y reducción de duplicación, sin impactar la operación actual del sistema.
