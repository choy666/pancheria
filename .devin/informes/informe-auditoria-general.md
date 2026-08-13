# Informe de auditoría general — Proyecto Panchería

**Proyecto:** `pancheria`  
**Ruta:** `C:\developer\paginas\pancheria`  
**Propósito:** describir el alcance funcional que la aplicación entrega actualmente y las carencias o deuda técnica detectadas.  
**Prompt base:** <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/auditoria-documentacion.md" />

---

## 1. Resumen ejecutivo

La aplicación **Panchería** es un sistema de gestión de stock, ventas, caja y cierre diario multi-sucursal que, en su estado actual, cubre los flujos esenciales de un negocio de este tipo. La arquitectura es sólida y el código cuenta con tests unitarios de buena cobertura en servicios, repositorios y utilidades.

Sin embargo, se detectan **riesgos de integridad de datos** en la eliminación de sucursales, **brechas de cobertura de tests** en rutas API y roles, y **discrepancias documentales** menores. La mayoría de los hallazgos son controlables con mantenimiento y tests adicionales.

**Estado general:** funcional y estable, con deuda técnica y documental a atender.

---

## 2. Alcance funcional vigente

### 2.1 Funcionalidades entregadas

| Dominio | Funciones cubiertas | Referencias |
| ------- | ------------------- | ----------- |
| **Autenticación** | Login con credenciales, sesión JWT con rol, sucursal y rate limiting en memoria. | <ref_file file="C:/developer/paginas/pancheria/src/auth.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/application/services/authService.ts" /> |
| **Roles y autorización** | Diferenciación `admin`/`operator`. Los operadores solo acceden a Panel, Ventas, Historial, Stock y Caja. El administrador puede operar en cualquier sucursal y gestionar Productos, Sucursales y Usuarios. | <ref_file file="C:/developer/paginas/pancheria/src/lib/auth.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/components/panel/panel-header.tsx" /> |
| **Multi-sucursal** | Tabla `branches`, `branchId` en usuarios, productos, cajas, ventas, stock y cierres. Selector de sucursal activa para admin con cookie `activeBranchId`. | <ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/layout.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/actions.ts" /> |
| **Productos** | CRUD con soft delete, tipos (`critical_supply`, `compound`, `manual_supply`, `service`), recetas y validación de integridad. | <ref_file file="C:/developer/paginas/pancheria/src/application/services/productService.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/productos/page.tsx" /> |
| **Recetas** | Asociación de promos (`compound`) con insumos críticos, auto-descuento, validaciones. | <ref_file file="C:/developer/paginas/pancheria/src/application/services/recipeService.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/app/api/recetas/route.ts" /> |
| **Stock** | Ajustes manuales con motivo, historial de movimientos, alertas de stock bajo. | <ref_file file="C:/developer/paginas/pancheria/src/application/services/stockService.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/stock/page.tsx" /> |
| **Ventas** | Terminal táctil, validación de disponibilidad en tiempo real, medios de pago, anulación con reintegro de stock, idempotencia. | <ref_file file="C:/developer/paginas/pancheria/src/components/ventas/sales-terminal.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" /> |
| **Caja** | Apertura, cierre, auto-cierre, historial con filtros, papelera (soft delete, restauración, hard delete), resumen en vivo. | <ref_file file="C:/developer/paginas/pancheria/src/application/services/cashRegisterService.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/cierre/page.tsx" /> |
| **Cierre diario** | Generación por fecha, validación de duplicados, historial, exportación CSV. | <ref_file file="C:/developer/paginas/pancheria/src/application/services/closureService.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/cierre/historial/page.tsx" /> |
| **Sucursales** | CRUD de sucursales, validación de nombres duplicados, selector de sucursal activa. | <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/sucursales/page.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/application/services/branchService.ts" /> |
| **Usuarios** | Creación de usuarios `operator`, listado por sucursal, asignación de sucursal, hash de contraseña. | <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/usuarios/page.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/application/services/userService.ts" /> |
| **Tour interactivo** | Recorrido con `driver.js`, inicio desde navbar, persistencia en `localStorage`. | <ref_file file="C:/developer/paginas/pancheria/src/components/tour/tour-context.tsx" /> |

### 2.2 Funcionalidades que aún no entrega

| Área | Carencia | Impacto |
| ---- | -------- | ------- |
| **Arqueo de caja** | No hay conteo físico vs. esperado ni registro de diferencias. | Medio |
| **Extracciones/depósitos** | No se pueden registrar movimientos de efectivo durante el turno. | Medio |
| **Devoluciones** | Solo existe anulación de venta, no devolución parcial. | Medio |
| **Facturación / comprobantes** | No se generan comprobantes, tickets fiscales ni exportación PDF. | Alto (depende del mercado) |
| **Cierre de mes / consolidado** | Solo existe cierre diario. | Medio |
| **Transferencias entre sucursales** | No hay movimiento de stock entre sucursales. | Medio |
| **Reportes consolidados multi-sucursal** | Cada admin ve una sucursal a la vez; no hay vistas combinadas. | Medio |
| **Gestión de usuarios** | No hay edición, eliminación, cambio de contraseña ni desactivación de usuarios. | Medio |
| **Alertas proactivas** | No hay notificaciones por email, WhatsApp o push de stock bajo. | Bajo |
| **Reposición programada** | No hay pedidos de reposición automáticos. | Bajo |
| **Imágenes / variantes de productos** | No hay catálogo con imágenes, tamaños o sabores. | Bajo |

---

## 3. Hallazgos técnicos

### 3.1 Críticos

#### 1. Eliminación de sucursal con hard delete en cascada

`branchService.deleteBranch` elimina permanentemente recetas, items de venta, movimientos de stock, ventas, cajas, cierres, productos, usuarios y finalmente la sucursal. Esto rompe el historial y contradice la preferencia por soft delete en entidades históricas:

<ref_snippet file="C:/developer/paginas/pancheria/src/application/services/branchService.ts" lines="97-144" />

**Riesgo:** pérdida irreversible de datos si un admin elimina una sucursal por error.  
**Acción recomendada:** convertir `deleteBranch` en soft delete o restringir la operación hasta que exista un mecanismo de backup/archivado.

#### 2. Falta de `onDelete` en las claves foráneas del esquema

<ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" /> define todas las relaciones con `.references(() => ...)` sin `onDelete`. En PostgreSQL esto equivale a `NO ACTION`, lo que puede provocar errores de integridad si el código no maneja manualmente todos los casos.

**Riesgo:** errores 500 por violación de FK si se elimina un registro referenciado.  
**Acción recomendada:** definir explícitamente `onDelete` en cada relación (p. ej. `cascade` para items de venta y movimientos al eliminar una venta, `restrict` para sucursales con datos).

### 3. Mayores

#### 3. Discrepancia documental: README dice que se pueden crear más admins

El `README.md` indica:

> "se pueden crear más usuarios con rol `admin` desde `/usuarios`".

Eso contradice el código actual, donde `userService.createUser` rechaza explícitamente cualquier rol distinto a `operator`:

<ref_snippet file="C:/developer/paginas/pancheria/src/application/services/userService.ts" lines="34-36" />

**Acción recomendada:** corregir `README.md` para reflejar que solo el seed crea el administrador inicial y que `/usuarios` solo crea operadores.

#### 4. Cobertura de tests unitarios para rutas API es limitada

Solo existe `src/app/api/caja/historial/route.test.ts`. Las rutas de productos, ventas, stock, cierre, recetas, sucursales y usuarios no tienen tests unitarios.

**Riesgo:** regresiones en endpoints críticos sin detección automática.  
**Acción recomendada:** agregar tests de ruta siguiendo el patrón de `caja/historial/route.test.ts`.

#### 5. No hay tests E2E de roles ni de aislamiento entre sucursales

Los tests E2E existen (`tests/e2e/*.spec.ts`) pero el helper `login` siempre usa `ADMIN_USERNAME`/`ADMIN_PASSWORD`. No se valida que un operador no pueda acceder a `/productos`, `/sucursales` ni `/usuarios`, ni que no vea datos de otra sucursal.

**Riesgo:** brechas de autorización o de aislamiento de datos pueden pasar desapercibidas.  
**Acción recomendada:** agregar specs E2E de autorización y multi-sucursal.

#### 6. Lógica de intervalo del reloj duplicada en caja

`CajaPanel` y `CajaStatus` repiten el mismo `useEffect` de intervalo con manejo de visibilidad:

<ref_snippet file="C:/developer/paginas/pancheria/src/components/caja/caja-panel.tsx" lines="19-50" />  
<ref_snippet file="C:/developer/paginas/pancheria/src/components/caja/caja-status.tsx" lines="31-62" />

**Acción recomendada:** extraer a un hook `useClockInterval`.

#### 7. `recipeRepository.replaceRecipe` no se usa en producción y carece de transacción

La función existe y se testea, pero el servicio `recipeService.saveRecipe` implementa su propia transacción directamente. Si `replaceRecipe` se usa en el futuro, el delete+insert sin transacción es riesgoso.

<ref_snippet file="C:/developer/paginas/pancheria/src/repositories/recipeRepository.ts" lines="33-54" />

### 3.3 Menores

- **Columnas JSON como `text`:** `productsSummary` y `criticalSuppliesSummary` en `cashRegisters` y `dailyClosures` deberían migrar a `jsonb` (ya hay notas en el esquema).
- **`authenticatedFetch`:** es un wrapper mínimo que solo agrega `credentials: 'include'`. No maneja timeouts ni errores de red.
- **Código muerto/estilístico:** algunos componentes UI importan `* as React` de forma innecesaria en React 19; `Fragment` importado cuando `<></>` es suficiente.
- **Tests E2E `paso3.spec.ts` y `paso4.spec.ts`:** nombres genéricos que dificultan saber qué flujo cubren.
- **Botones de acción en historial de cajas:** aunque las APIs de eliminación/restauración ahora requieren admin, los componentes `CashRegisterActions` y `CashRegisterDetailActions` siguen mostrando los botones a cualquier usuario; la API devuelve 403, pero la UX es confusa.

---

## 4. Estado de seguridad

### 4.1 Controles implementados

- Páginas administrativas (`/productos`, `/productos/nuevo`, `/productos/[id]/editar`, `/sucursales`, `/usuarios`, `/ventas/historial/eliminadas`) redirigen a operadores.
- APIs de escritura de productos, recetas, sucursales, usuarios y operaciones destructivas de caja requieren `requireAdmin`.
- `getCurrentBranchId` ahora valida que la cookie de sucursal activa exista en la base de datos y vuelva a la sucursal de sesión si no.
- Creación de usuarios fuerza el rol `operator` y valida la sucursal.

### 4.2 Pendientes de seguridad / UX

- Ocultar botones de eliminar/restaurar cajas cuando el usuario no es admin (evita clicks que terminan en 403).
- Agregar tests automatizados de roles para prevenir regresiones.
- Revisar permisos de los endpoints `stock/ajustar` y `cierre` si se decide que solo admin puede ajustar stock o generar cierres.

---

## 5. Tests y verificaciones

### Tests unitarios

- **Total:** 34 suites, 373 tests passed (ejecución actual del informe).
- **Cobertura sólida en:** servicios de aplicación, repositorios, utilidades, `lib/auth` y componentes clave.
- **Ausente en:** la mayoría de las rutas API; componentes de formularios y modales; flujos de autorización.

### Tests E2E

- **Archivos:** 13 specs en `tests/e2e/`.
- **Alcance:** login, flujo diario, ventas, stock, cierre, papelera, productos, recetas, disponibilidad, tour, responsive.
- **No ejecutados en este informe** porque `tests/e2e/global-setup.ts` trunca tablas y re-seedea la base.

### Verificaciones ejecutadas

| Comando | Resultado |
| ------- | --------- |
| `npm run lint` | Pasa |
| `npx tsc --noEmit` | Pasa |
| `npm test` | 34 suites, 373 tests passed |
| `npm run build` | Build exitoso (30 páginas) |
| `npx drizzle-kit check` | `Everything's fine 🐶🔥` |

---

## 6. Documentación

### 6.1 Estado de archivos principales

| Archivo | Estado | Observaciones |
| ------- | ------ | --------------- |
| `README.md` | ⚠️ Desactualizado en un punto | Dice que se pueden crear admins desde `/usuarios`; el código no lo permite. |
| `AGENTS.md` | Actualizado | Comandos, variables de entorno, troubleshooting, deploy en Vercel. |
| `.devin/informes/lecciones-aprendidas.md` | Actualizado | Lecciones transversales consolidadas. |
| `.devin/prompts/auditoria-documentacion.md` | Nuevo | Prompt reutilizable para auditorías generales. |
| `.devin/prompts/README.md` | ⚠️ Corregido en este informe | El índice listaba `pruebas-y-reporte.md` (no existente) y no incluía los prompts resueltos de control de acceso ni navbar. |

### 6.2 Prompts resueltos y archivados

- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/control-de-acceso-y-sucursales.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/verificar-navbar-sucursal.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/multi-sucursal.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/tour-navbar.md" />

---

## 7. Recomendaciones priorizadas

### Inmediato

1. **Corregir `README.md`** para que no indique que se pueden crear usuarios `admin` desde `/usuarios`.
2. **Revisar `branchService.deleteBranch`**: evaluar soft delete o restringir la acción.
3. **Definir `onDelete`** en las relaciones del esquema para proteger la integridad referencial.

### Corto plazo

4. **Agregar tests unitarios para rutas API** de productos, ventas, stock, cierre, recetas, sucursales y usuarios.
5. **Agregar tests E2E de roles y aislamiento multi-sucursal**.
6. **Ocultar botones de acción destructiva** en historial y detalle de cajas cuando el usuario no es admin.

### Medio plazo

7. **Migrar columnas JSON de `text` a `jsonb`** en `cashRegisters` y `dailyClosures`.
8. **Extraer el intervalo del reloj a un hook compartido** (`useClockInterval`).
9. **Eliminar o consolidar código muerto** (`replaceRecipe` si no se usa, imports de React innecesarios).

---

## 8. Conclusión

Panchería entrega un conjunto funcional completo para la operación diaria de una panchería multi-sucursal: autenticación, productos, recetas, ventas, stock, caja y cierre diario. La base de código es sana, con buena separación de capas y tests unitarios sólidos.

Las principales carencias son:

- **Gestión documental:** discrepancia en `README.md` y mantenimiento del índice de prompts.
- **Integridad de datos:** eliminación en cascada de sucursales y ausencia de `onDelete` en FKs.
- **Cobertura de tests:** rutas API y escenarios de roles no están automatizados.
- **UX de seguridad:** botones de acciones destructivas visibles para operadores aunque las APIs ahora las bloquean.

Ejecutar las recomendaciones de corto plazo fortalecerá la confianza del sistema y reducirá el riesgo de regresiones en autorización y datos.
