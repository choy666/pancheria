# Auditoría de CI — fallo E2E + optimización del workflow

**Fecha:** 2026-10-05
**Estado:** implementado — commits `54a1b15` + `56bdaaa` en main; run `37366712355` **success** (9/9 jobs) y deploy Vercel `READY`. Nota: el run tardó ~30 min en arrancar y GitHub canceló 4 jobs sin ejecutarlos por un incidente de asignación de runners (degraded performance, 19:11–21:30Z); se recuperaron con `gh run rerun --failed`.

## 1. Hallazgo: fallo determinístico, no flake

Los runs `37323460235` (`docs: estado de is_active...`) y `37322424923` (`feat: is_active`) fallaron en el mismo test:

```
tests/e2e/sucursal-eliminacion.spec.ts:76
› rechaza crear pedidos en una sucursal eliminada
Error: expect(400).toBe(404)   (idéntico en los 3 reintentos)
```

### Causa raíz

El commit `f108ceb` (`is_active`) introdujo `resolvePublicBranchId` en `src/lib/branch-resolver.ts:84`: un `branchId` explícito que apunta a una sucursal **inexistente o inactiva** resuelve a `null` y las tres rutas públicas (`/api/public/pedido`, `/catalogo`, `/disponibilidad`) responden **`400` + `DEFAULT_BRANCH_ERROR`** — diseño deliberado del plan (`plan-sucursal-activa-2026-10-05.md` §2.3): una inactiva se comporta como inexistente y no se expone su estado.

Antes, el `branchId` explícito pasaba directo a `orderService.createOrder`, que lanzaba `NotFoundError` → `404`. El spec E2E conservó la expectativa vieja; los tests unitarios de la ruta sí se actualizaron en el mismo commit.

### Corrección aplicada

`tests/e2e/sucursal-eliminacion.spec.ts:108` — `toBe(404)` → `toBe(400)` + aserción del mensaje genérico (`'sucursal activa'`). Verificado localmente contra `.env.e2e`: **2 passed**.

> Contrato vigente de la API pública: `branchId` inválido/inexistente/inactivo → `400` "No se encontró la sucursal activa." (no `404`). Excepción: `GET /api/public/sucursal/estado` responde `isOpen:false` para degradar páginas ya abiertas.

### Flakies observados (no bloqueantes)

- `pedido-cancelacion-panel.spec.ts:53` — flaky en run 37323460235.
- `sucursal-activar-desactivar.spec.ts:11` — flaky en run 37323460235; `tour` mobile — flaky en 37322424923.

Vigilar; si se repiten, auditar aislamiento de datos entre specs.

## 2. Optimizaciones aplicadas a `ci.yml`

| Cambio | Motivo |
| --- | --- |
| Job `cambios` (gate `docs-only`) | El commit `docs:` quemó ~35 min de suite completa. Ahora un diff que solo toca `.md`/`.devin/`/`docs/`/`LICENSE` salta todos los jobs (skipped = éxito para checks requeridos). Default seguro: sin rango o diff vacío → corre todo |
| `concurrency` a nivel workflow (`cancel-in-progress: true`) por ref | Un push nuevo cancela el run obsoleto del mismo ref. La DB de E2E no corre riesgo: `global-setup` trunca+re-seedea cada corrida y el grupo `e2e-db-*` (sin cancel) sigue serializando |
| Actions `@v4` → `checkout@v7`, `setup-node@v7`, `upload-artifact@v7`, `download-artifact@v8`, `cache@v6` | Todas las v4 corrían forzadas sobre Node 24 con warning `Node.js 20 is deprecated`; los majors nuevos son nativos node24 |
| `actions/cache` sobre `~/.cache/ms-playwright` | Con hit, `playwright install` no descarga los browsers (la parte frágil: mirrors lentos agotaron el timeout de 10 min dos veces); `--with-deps` sigue ejecutando apt |
| `e2e-report` sin `npm ci` | `merge-reports` solo necesita el CLI de Playwright: `npx --package=@playwright/test@<versión del lockfile>` (~20 s menos por run) |

## 3. Cosas auditadas y dejadas igual

- `expire-orders.yml`: bash + curl sin actions, idempotente (`FOR UPDATE` por lotes) — sin cambios.
- Secrets/variables del job e2e: verificados contra `checklist-pre-push.md` — completos.
- Sharding `E2E_SHARDS`: sigue opt-in; la suite actual (~13-25 min) no lo justifica aún. Si supera ~10 min/shard de forma estable, activar con secrets por shard.
- Jobs rápidos (lint/tsc/jest/knip/audit) se mantienen paralelos: fusionarlos ahorra minutos facturables pero empeora el feedback y la granularidad de checks.
