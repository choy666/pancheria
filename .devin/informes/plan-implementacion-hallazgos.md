# Plan de implementación — Hallazgos de auditoría y requerimientos adicionales

**Proyecto:** `pancheria`  
**Basado en:** <ref_file file="C:/developer/paginas/pancheria/.devin/informes/informe-auditoria-general.md" />  
**Decisiones de alcance confirmadas por el usuario:**

- Eliminación de sucursal: confirmación fuerte en UI (escribir nombre + resumen de datos afectados).
- Gestión de usuarios: admin puede editar, resetear contraseña y eliminar usuarios.
- Migraciones de base de datos: incluir `onDelete` en FK y migrar `productsSummary` / `criticalSuppliesSummary` de `text` a `jsonb`.
- Tour: corroborar manualmente que el tour funciona para el admin en distintas sucursales.

---

## 1. Objetivo

Implementar las mejoras identificadas en la auditoría general y cubrir los requerimientos adicionales, garantizando que todas las verificaciones (`lint`, `typecheck`, `tests`, `build`, `drizzle-kit check`) sigan pasando.

---

## 2. Fases y tareas

### Fase 0 — Migraciones de base de datos (fundamento para el resto)

Estas tareas requieren ejecutarse sobre una **base de datos de prueba** y, solo después de validar, aplicarse en producción con backup previo.

#### 2.0.1 Agregar `onDelete` en claves foráneas

**Propósito:** evitar errores de integridad referencial y definir políticas de eliminación explícitas.

**Archivo:** <ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" />

**Cambios propuestos (reglas de negocio):**

- `users.branchId`, `products.branchId`, `cashRegisters.branchId`, `sales.branchId`, `stockMovements.branchId`, `dailyClosures.branchId` → `onDelete: 'restrict'` (no se elimina una sucursal si aún tiene datos; la operación de borrar sucursal seguirá siendo explícita y controlada por la app).
- `recipes.compoundProductId` y `recipes.supplyId` → `onDelete: 'cascade'` (las recetas dependen del producto).
- `saleItems.saleId` → `onDelete: 'cascade'`.
- `saleItems.productId` → `onDelete: 'restrict'` (no se elimina un producto con ventas).
- `stockMovements.productId` → `onDelete: 'restrict'` (no se elimina un producto con movimientos).
- `stockMovements.saleId` → `onDelete: 'set null'` (se conserva el movimiento aunque se elimine la venta).
- `sales.cashRegisterId` → `onDelete: 'set null'` (las ventas permanecen aunque se elimine la caja).

**Verificación:** `npx drizzle-kit generate` y `npx drizzle-kit push` en base de prueba.

#### 2.0.2 Migrar columnas JSON de `text` a `jsonb`

**Propósito:** aprovechar validación y consulta nativa de PostgreSQL, eliminar parseos manuales.

**Archivos a tocar:**

- <ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" /> — cambiar `text('products_summary')` y `text('critical_supplies_summary')` por `jsonb` con default `'{}'` (o función SQL `to_jsonb('{}'::text)` según soporte de Drizzle).
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/cashRegisterService.ts" /> — ajustar `calculateCashRegisterSummary`, `saveCashRegisterSummary` y funciones afines para trabajar con objetos en lugar de strings JSON.
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/closureService.ts" /> — ajustar resúmenes de cierres diarios.
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" /> — ajustar `updateCashRegisterSummary`.
- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/cierre/[id]/page.tsx" /> y <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/ventas/historial/[id]/page.tsx" /> — eliminar `safeJsonParse` y usar directamente los objetos.

**Nota:** Drizzle ORM con `jsonb` devuelve el objeto parseado automáticamente. Hay que revisar que las inserciones usen objetos, no strings.

**Verificación:** `npx drizzle-kit check`, `npm run build`, `npm test`.

---

### Fase 1 — Críticos de seguridad y funcionalidad

#### 1.1 Confirmación fuerte antes de eliminar una sucursal

**Propósito:** reducir el riesgo de pérdida masiva de datos por error humano.

**Archivos a tocar:**

- <ref_file file="C:/developer/paginas/pancheria/src/components/sucursales/branch-actions.tsx" /> — agregar un flujo de dos pasos:
  1. Al hacer clic en Eliminar, mostrar un diálogo con el resumen de datos afectados (cantidad de productos, ventas, cajas, usuarios, etc.) obtenido desde una server action `getBranchDeletionSummaryAction`.
  2. El admin debe escribir exactamente el nombre de la sucursal para habilitar el botón de confirmación.
  3. Recién ahí se envía `deleteBranchAction`.
- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/sucursales/actions.ts" /> — agregar `getBranchDeletionSummaryAction` que, dado un `id`, cuente de forma segura los registros asociados.

**Regla de seguridad:** la acción sigue requiriendo `requireAdmin()`.

**Verificación:** manual con `npm run dev` y un test E2E que simule el flujo de confirmación.

#### 1.2 CRUD de usuarios para el administrador

**Propósito:** permitir gestionar usuarios (editar, resetear contraseña, eliminar).

**Backend:**

- <ref_file file="C:/developer/paginas/pancheria/src/application/services/userService.ts" />
  - `updateUser(id, { username?, branchId?, role? })`.
  - `resetUserPassword(id, newPassword)`.
  - `deleteUser(id)`.
  - Validaciones: username único, branchId existente, no eliminar el último admin, no auto-asignar admin.
- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/usuarios/actions.ts" />
  - `updateUserAction`, `resetPasswordAction`, `deleteUserAction`.

**Frontend:**

- <ref_file file="C:/developer/paginas/pancheria/src/components/usuarios/user-form.tsx" />
  - Soportar modo edición (precargar datos, ocultar contraseña, mostrar selector de sucursal).
- Crear `UserActions.tsx` con botones Editar, Resetear contraseña y Eliminar.
- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/usuarios/page.tsx" />
  - Mostrar acciones por fila. Listar **todos los usuarios** (no solo los de la sucursal activa) para facilitar la administración, mostrando la sucursal asignada.

**Tests:**

- Ampliar <ref_file file="C:/developer/paginas/pancheria/src/application/services/userService.test.ts" /> con edición, reset y eliminación.
- Agregar tests de server actions si se considera necesario.

**Verificación:** `npm test`, `npm run build`.

---

### Fase 2 — Tests

#### 2.1 Tests unitarios para rutas API

**Propósito:** cubrir los endpoints críticos con tests unitarios siguiendo el patrón de <ref_file file="C:/developer/paginas/pancheria/src/app/api/caja/historial/route.test.ts" />.

**Rutas a testear (prioridad):**

- `GET/POST /api/productos`
- `GET/PUT/DELETE /api/productos/[id]`
- `GET/POST /api/recetas`
- `GET/POST /api/ventas`
- `POST /api/ventas/[id]/anular`
- `POST /api/stock/ajustar`
- `GET /api/stock/movimientos`
- `GET/POST /api/cierre`
- `GET /api/cierre/historial`
- `GET/POST /api/caja` y subrutas críticas
- `GET /api/sucursales` y `GET/POST /api/usuarios` (o server actions si no hay API pública)

**Enfoque:** mockear servicios y `lib/auth`, verificar 401, 403, 200/201, 400, 404, 503.

#### 2.2 Tests E2E de roles y aislamiento multi-sucursal

**Propósito:** garantizar que un operador no accede a páginas ni datos de otra sucursal.

**Archivos a crear:**

- `tests/e2e/helpers.ts` — agregar `createOperatorViaApi(page, data)` y `loginAs(page, username, password)`.
- `tests/e2e/roles-y-aislamiento.spec.ts` — escenarios:
  - Login como operator: verificar redirección o 403 al acceder a `/productos`, `/sucursales`, `/usuarios`.
  - Login como admin, crear operator en sucursal A, loguearse como ese operator, verificar que no ve datos de sucursal B.
  - Verificar que operator no puede invocar APIs administrativas.

**Entorno:** base de datos de prueba (el global setup trunca y re-seedea).

#### 2.3 Corroborar tour interactivo por sucursal

**Propósito:** validar que el tour funciona cuando el admin cambia entre sucursales activas.

**Pasos de verificación manual:**

1. Login como admin con al menos dos sucursales.
2. Iniciar el tour en la sucursal principal.
3. Completar o avanzar los pasos (panel, ventas, productos, stock, cierre, historial).
4. Cambiar a la segunda sucursal activa.
5. Reiniciar el tour y validar que los pasos no se rompen (aunque la sucursal esté vacía, `skipMissingElement` debe evitar errores).
6. Registrar resultados en `.devin/informes/reporte-pruebas-tour.md` si se detectan problemas.

**Posible automatización:** si se detecta un problema, agregar un test E2E del tour por sucursal.

---

### Fase 3 — Hallazgos mayores

#### 3.1 Corregir `README.md`

**Tarea:** quitar la frase que indica que se pueden crear más usuarios `admin` desde `/usuarios`, ya que el sistema solo permite crear `operator`.

**Archivo:** <ref_file file="C:/developer/paginas/pancheria/README.md" />

**Verificación:** lectura cruzada con <ref_snippet file="C:/developer/paginas/pancheria/src/application/services/userService.ts" lines="34-36" />.

#### 3.2 Eliminar o consolidar `recipeRepository.replaceRecipe`

**Tarea:** la función no se usa en producción (<ref_snippet file="C:/developer/paginas/pancheria/src/repositories/recipeRepository.ts" lines="33-54" />) y el servicio maneja su propia transacción. Eliminarla y limpiar los tests asociados.

**Archivos:**

- <ref_file file="C:/developer/paginas/pancheria/src/repositories/recipeRepository.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/repositories/recipeRepository.test.ts" />

**Verificación:** `npm test`.

#### 3.3 Extraer hook `useClockInterval`

**Tarea:** eliminar la duplicación del intervalo del reloj en `CajaPanel` y `CajaStatus`.

**Archivos a crear/tocar:**

- `src/hooks/useClockInterval.ts` (nuevo).
- <ref_file file="C:/developer/paginas/pancheria/src/components/caja/caja-panel.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/caja/caja-status.tsx" />

**Verificación:** `npm run lint`, `npm run build`, tests de componentes si existen.

---

### Fase 4 — Hallazgos menores

#### 4.1 Ocultar botones destructivos de caja a operadores

**Tarea:** los componentes `CashRegisterActions` y `CashRegisterDetailActions` deben recibir el `role` y no mostrar Eliminar/Restaurar/Eliminar definitivamente si el usuario no es admin.

**Archivos a tocar:**

- <ref_file file="C:/developer/paginas/pancheria/src/components/caja/cash-register-actions.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/caja/cash-register-detail-actions.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/caja/caja-history.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/ventas/historial/page.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/ventas/historial/[id]/page.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/cierre/[id]/page.tsx" />

**Verificación:** `npm run build`, `npm run lint`, tests E2E de papelera.

#### 4.2 Mejorar `authenticatedFetch`

**Tarea:** agregar `AbortController` con timeout configurable y manejo básico de errores de red.

**Archivo:** <ref_file file="C:/developer/paginas/pancheria/src/lib/fetch.ts" />

**Cambio propuesto:**

```ts
export async function authenticatedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = 10000
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(input, { ...init, credentials: 'include', signal: controller.signal });
    return response;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('La solicitud tardó demasiado.');
    }
    throw new Error('No se pudo conectar con el servidor.');
  } finally {
    clearTimeout(timeout);
  }
}
```

**Verificación:** `npm run lint`, `npm run build`, tests si existen.

#### 4.3 Limpiar imports de React en componentes UI

**Tarea:** reemplazar `import * as React from "react"` por imports explícitos donde sean necesarios (por ejemplo, `forwardRef`, `ReactNode`) o eliminarlos si no se usan.

**Archivos afectados:**

- <ref_file file="C:/developer/paginas/pancheria/src/components/ui/input.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/ui/dialog.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/ui/select.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/ui/table.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/ui/textarea.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/ui/label.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/ui/card.tsx" />

**Verificación:** `npx tsc --noEmit`, `npm run build`.

---

## 3. Verificaciones finales

Al finalizar cada fase se debe ejecutar, según corresponda:

| Comando | Cuándo ejecutar |
| ------- | --------------- |
| `npx tsc --noEmit` | Después de cada cambio de tipos |
| `npm run lint` | Después de cada fase |
| `npm test` | Después de cambios en servicios, repositorios, APIs o componentes testeados |
| `npm run build` | Antes de finalizar cualquier fase |
| `npx drizzle-kit check` | Después de tocar el esquema |
| `npx drizzle-kit push` | Solo en base de datos de prueba, después de generar migraciones |
| `npm run test:e2e` | Solo al final, en base de datos de prueba |

---

## 4. Riesgos y consideraciones

- **Migraciones de base de datos:** modificar `onDelete` y `jsonb` puede alterar datos. Ejecutar primero en una base de prueba y respaldar producción antes de aplicar.
- **`deleteBranch` sigue siendo destructivo:** aunque se agregue confirmación fuerte, la operación aún borra datos. A futuro se recomienda evaluar soft delete de sucursal.
- **Cambios en `jsonb`:** pueden requerir ajustar tipos en servicios, tests y componentes para que Drizzle serialice/deserialice correctamente.
- **Tests E2E:** el global setup trunca tablas; no ejecutar en base de datos de producción.

---

## 5. Orden de ejecución recomendado

1. **Fase 0** → Migraciones de schema (onDelete y jsonb).
2. **Fase 1** → Confirmación de eliminación de sucursal y CRUD de usuarios.
3. **Fase 2** → Tests unitarios de API y E2E de roles/aislamiento + verificación manual del tour.
4. **Fase 3** → README, `recipeRepository.replaceRecipe`, `useClockInterval`.
5. **Fase 4** → Menores: botones UI, `authenticatedFetch`, imports de React.

---

## 6. Archivos que se modificarán (resumen)

- `src/db/schema.ts`
- `src/application/services/cashRegisterService.ts`
- `src/application/services/closureService.ts`
- `src/application/services/saleService.ts`
- `src/app/(panel)/cierre/[id]/page.tsx`
- `src/app/(panel)/ventas/historial/[id]/page.tsx`
- `src/app/(panel)/sucursales/actions.ts`
- `src/components/sucursales/branch-actions.tsx`
- `src/application/services/userService.ts`
- `src/app/(panel)/usuarios/actions.ts`
- `src/components/usuarios/user-form.tsx`
- `src/app/(panel)/usuarios/page.tsx`
- `src/components/usuarios/user-actions.tsx` (nuevo)
- `src/app/api/*/route.test.ts` (nuevos)
- `tests/e2e/helpers.ts`
- `tests/e2e/roles-y-aislamiento.spec.ts` (nuevo)
- `src/repositories/recipeRepository.ts`
- `src/repositories/recipeRepository.test.ts`
- `src/hooks/useClockInterval.ts` (nuevo)
- `src/components/caja/caja-panel.tsx`
- `src/components/caja/caja-status.tsx`
- `src/components/caja/cash-register-actions.tsx`
- `src/components/caja/cash-register-detail-actions.tsx`
- `src/components/caja/caja-history.tsx`
- `src/app/(panel)/ventas/historial/page.tsx`
- `src/app/(panel)/ventas/historial/[id]/page.tsx`
- `src/app/(panel)/cierre/[id]/page.tsx`
- `src/lib/fetch.ts`
- `src/components/ui/*.tsx`
- `README.md`

---

## 7. Entregables

- Esquema migrado y base de datos sincronizada.
- Código corregido y mejorado.
- Tests unitarios y E2E ampliados.
- Informe de verificación del tour por sucursal.
- `README.md` actualizado.
- Verificaciones (`lint`, `typecheck`, `tests`, `build`, `drizzle-kit check`) pasando.
