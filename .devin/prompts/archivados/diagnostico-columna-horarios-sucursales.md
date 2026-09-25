# Prompt: diagnóstico del contador de horarios en `/sucursales` ("10 días" en la sucursal ID 3)

> **Estado:** implementado.
> El "10 días" era el conteo de **franjas** (`openingHours.length`), no de días: la sucursal ID 3 ("Popular Av. Los Minerales", base `neondb_dev`) tiene 10 franjas válidas en 7 días únicos (Mié/Vie/Sáb con doble turno contiguo), confirmado con `validateOpeningHours` sobre el dato persistido. Fix en `branch-list.tsx`: la celda muestra `{días únicos} días` y agrega `· {franjas} franjas` solo cuando difieren. Verificaciones: lint, tsc, 1941 tests unitarios, knip, build y E2E de sucursales (9/9) en verde.

## Rol

Actuá como desarrollador senior del proyecto. Tu tarea es **diagnosticar y reportar**: primero explicar qué muestra la columna y verificar los datos reales de la base; recién después, si corresponde, proponer la corrección y **esperar mi aprobación antes de tocar código**.

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja, cierre diario, multi-sucursal, catálogo público de pedidos y gestión de videos.

Stack: Next.js 16 (App Router + Turbopack), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM con PostgreSQL (Neon), NextAuth v5, Jest, Playwright.

Documentación de referencia obligatoria:

- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/entornos.md" /> — si la verificación requiere apuntar a otra base (producción/staging).

Código relevante:

- Tabla de sucursales (columna "Horarios"): <ref_file file="C:/developer/paginas/pancheria/src/components/sucursales/branch-list.tsx" />
- Tipo de dominio `BranchOpeningHours` y `Branch`: <ref_file file="C:/developer/paginas/pancheria/src/domain/types.ts" />
- Columna `opening_hours` (jsonb): <ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" />
- Validación `validateOpeningHours` y parseo del FormData: <ref_file file="C:/developer/paginas/pancheria/src/lib/branch-helpers.ts" />
- Editor de horarios (multi-franja por día): <ref_file file="C:/developer/paginas/pancheria/src/components/sucursales/branch-form.tsx" />
- Servicio que persiste (`createBranch`/`updateBranch`): <ref_file file="C:/developer/paginas/pancheria/src/application/services/branchService.ts" />
- Datos seed (`DEFAULT_OPENING_HOURS`, 7 franjas): <ref_file file="C:/developer/paginas/pancheria/src/db/seeds.ts" />
- Specs del área: `tests/e2e/sucursal-contactos-y-turnos.spec.ts` y `tests/e2e/sucursal-form-ux.spec.ts`

## Observación reportada

En `/sucursales`, en la tabla al final de la página, la columna **Horarios** muestra **"10 días"** para la sucursal con **ID 3**. Se pide explicar el valor y determinar si es lo correcto y lo esperado.

## Estado actual relevante (ya verificado en código)

- La columna renderiza `{openingHoursCount} días`, donde `openingHoursCount = branch.openingHours.length`: **cuenta franjas horarias, no días** (`branch-list.tsx`).
- `openingHours` es un arreglo jsonb de `{ dayOfWeek: number; open: string; close: string }`. Un mismo `dayOfWeek` puede tener **varias franjas** (turnos cortados, p. ej. mañana y tarde): el formulario lo soporta con `addSlot`/`getSlotsForDay`/`toggleDay`, y `validateOpeningHours` solo rechaza duplicados exactos (`dayOfWeek-open-close`) y solapamientos (incluidos los overnight `close < open`, con cruce Dom→Lun).
- En consecuencia, "10 días" es imposible como cantidad de días (máximo 7): indica **10 franjas horarias** cargadas en `branches.opening_hours` de la sucursal 3.
- El seed crea 7 franjas (una por día); 10 sugiere días con doble turno o datos cargados por fuera del formulario.
- Ningún spec actual aserta sobre el literal "días" de esa celda, pero existe el `data-testid="branch-opening-hours"`: cualquier cambio de texto debe conservarlo.

## Objetivo

1. **Explicar** qué representa el número mostrado en la columna (franjas vs. días) y por qué puede superar 7.
2. **Verificar en la base real** qué contiene `opening_hours` de la sucursal ID 3: listar las franjas agrupadas por `dayOfWeek`, contar **días únicos** y correr `validateOpeningHours` sobre el dato tal cual está persistido.
3. **Determinar** en cuál de estos escenarios cae el caso y justificarlo con evidencia:
   - **(a) Correcto y esperado, label engañoso:** las 10 franjas son válidas (doble turno en algunos días); el problema es solo el texto "días" que subestima el modelo de datos.
   - **(b) Dato inválido/legacy:** hay franjas que `validateOpeningHours` rechazaría hoy (duplicados, solapamientos, formatos viejos) — cargadas antes de la validación o por vías externas al form.
   - **(c) Bug de conteo/render:** el array persistido no corresponde con lo que se renderiza (caché, mapeo, etc.).
4. **Proponer la corrección** según el escenario, con alternativas:
   - Si (a): cambiar el texto a algo fiel al modelo — p. ej. `"N días"` contando días únicos, `"M franjas"`, o combinado `"N días · M franjas"`; evaluar cuál comunica mejor al admin sin confundir.
   - Si (b): reportar el dato corrupto y proponer saneamiento (sin ejecutarlo sin aprobación).
   - Si (c): describir la causa raíz y el fix.
5. **Esperar mi aprobación** antes de modificar código o datos.

## Reglas

1. Todo en **español**.
2. La verificación contra la base es **solo lectura**: ningún `UPDATE`/`DELETE`/`INSERT`. Si el saneamiento llegara a ser necesario, proponerlo y esperar aprobación.
3. El script de consulta va en `.devin/tmp/` (gitignored) y debe correr con `npx tsx`. **Ojo:** `.devin/tmp/env.ts` carga `.env.local` y luego pisa todo con `.env.e2e` (que apunta a la base descartable) — **no** lo reuses para esta consulta si querés inspeccionar la base de desarrollo; cargá solo `.env.local` con `dotenv`.
4. **No imprimir `DATABASE_URL` ni credenciales.** Para confirmar a qué base apunta el script, loguear solo el nombre de la base y si el host es local/remoto, nunca la URL completa.
5. Si la sucursal 3 vive en otra base (producción), seguir `entornos.md` y pedir autorización antes de conectar; en ese caso el script sigue siendo solo lectura.
6. Reusar `db` de `src/db` y `validateOpeningHours` de `src/lib/branch-helpers` en el script — no duplicar la lógica de validación.
7. Si se aprueba un fix de UI: mantener el `data-testid="branch-opening-hours"` y los `data-tour` existentes; verificar con `grep` que ningún test dependa del literal "días" antes de cambiarlo.
8. Server actions con `useActionState` devuelven estado con `error` (no `throw` para errores controlados) — aplica solo si el fix toca `actions.ts`.

## Pasos sugeridos

1. Releer los archivos de la sección "Código relevante".
2. Crear `.devin/tmp/check-branch3-hours.ts` (solo lectura): obtener la sucursal 3, imprimir su nombre, las franjas ordenadas por `dayOfWeek`/`open`, cantidad de franjas, cantidad de días únicos, y el resultado de `validateOpeningHours` (acepta/rechaza + mensaje).
3. Correrlo contra la base correcta y registrar la salida como evidencia.
4. Cruzar el resultado con `guia-funcionamiento-pancheria.md` (¿los turnos cortados son un caso de negocio esperado?).
5. Reportar: explicación del valor, escenario (a/b/c) con evidencia, y propuesta de corrección concreta. Esperar aprobación.
6. Si se aprueba el fix: implementarlo, agregar/ajustar test unitario o E2E del texto si conviene, y correr las verificaciones.

## Consideraciones de seguridad y entorno

- Script de solo lectura; la base de `.env.local` puede tener datos reales — no modificar nada.
- No exponer URLs de base de datos, secretos ni `.env.local` en salidas, capturas ni informes.
- E2E solo contra la base descartable de `.env.e2e` (el `global-setup.ts` trunca tablas), y solo si hay fix aprobado que verificar.

## Verificaciones

| Comando | Propósito |
| ------- | --------- |
| `npx tsx .devin/tmp/check-branch3-hours.ts` | Evidencia del dato real en la sucursal 3 |
| `npm run lint` | Estilo y calidad (si hay fix) |
| `npx tsc --noEmit` | Verificación de tipos (si hay fix) |
| `npm test` | Tests unitarios (si hay fix) |
| `npm run build` | Build de producción (si hay fix) |
| `npm run knip` | Código muerto (si hay fix) |
| `NO_WEB_SERVER=1 npx playwright test tests/e2e/sucursal-contactos-y-turnos.spec.ts` | Regresión del área (si hay fix, con `.env.e2e`) |

## Entregable

Informe breve en la conversación (no hace falta archivo en `.devin/informes/` salvo que el caso escale): qué muestra la columna, qué tiene la sucursal 3 en la base, escenario determinado con evidencia, propuesta de corrección y, si aplica, diff del cambio aprobado.
