# Prompt: Auditoría del estado actual y sincronización de documentación

> Antes de ejecutar este prompt, leer `AGENTS.md`, `.devin/informes/lecciones-aprendidas.md`, `.devin/prompts/auditoria-masiva-resumen.md` y `.devin/prompts/auditoria-y-documentacion.md`.

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, pedidos, caja, cierre diario, multi-sucursal, catálogo público, chat de pedidos, imágenes de productos/promos y gestión de videos con reproducción y Google Cast.

Stack: Next.js 16.3.3 (App Router), React 19.2.8, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM 0.45.2 con PostgreSQL (Neon), NextAuth v5, Jest, Playwright.

Documentación de referencia obligatoria:

- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/README.md" />
- <ref_file file="C:/developer/paginas/pancheria/.env.example" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/environment.yaml" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/auditoria-masiva.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/auditoria-masiva-resumen.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/auditoria-y-documentacion.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-estado.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/checklist-pre-push.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/entornos.md" />
- <ref_file file="C:/developer/paginas/pancheria/package.json" />

## Objetivo

Auditar y determinar el estado actual del proyecto, corroborando que la documentación refleje de forma correcta el estado real del código y de la configuración.

Este prompt prioriza el material que describe el estado del proyecto y la metodología de auditoría; luego extiende la revisión a todo el contenido de `.devin` y al cruzado con el código.

## Material a auditar prioritario

1. <ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-estado.md" /> — informe de estado vigente.
2. <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/auditoria-masiva-resumen.md" /> — guía de uso rápido de la auditoría masiva.
3. <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/auditoria-masiva.md" /> — prompt de auditoría masiva integral.

## Material a auditar general

- Todo el directorio <ref_file file="C:/developer/paginas/pancheria/.devin" />.
- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />.
- <ref_file file="C:/developer/paginas/pancheria/README.md" />.
- <ref_file file="C:/developer/paginas/pancheria/.env.example" />.
- <ref_file file="C:/developer/paginas/pancheria/package.json" />.
- <ref_file file="C:/developer/paginas/pancheria/next.config.ts" />.
- <ref_file file="C:/developer/paginas/pancheria/playwright.config.ts" />.
- <ref_file file="C:/developer/paginas/pancheria/.github/workflows/ci.yml" />.
- <ref_file file="C:/developer/paginas/pancheria/vercel.json" />.

## Material de ayuda

- <ref_file file="C:/developer/paginas/pancheria/.env.e2e" /> — solo verificar estructura y variables definidas; **no exponer valores sensibles**.
- <ref_file file="C:/developer/paginas/pancheria/.env.local" /> — solo verificar estructura y variables definidas; **no exponer valores sensibles**.

## Reglas de oro

1. Idioma español en todo: explicaciones, comentarios, documentación e informes.
2. Nunca hardcodear credenciales, URLs de APIs, secretos ni parámetros sensibles.
3. No exponer `.env.local`, `.env.e2e`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `NEXTAUTH_SECRET`, `AUTH_SECRET`, URLs de base de datos ni tokens en prompts, documentos o reportes.
4. No ejecutar `npx tsx src/db/seeds.ts`, `npx drizzle-kit push`, `npx drizzle-kit generate`, `npm run test:e2e`, `npx playwright test` ni `npx vercel env pull` sin confirmación explícita del usuario y una base de datos de prueba.
5. No modificar archivos de negocio salvo correcciones documentales o de configuración respaldadas por evidencia del código (`<ref_file .../>` o `<ref_snippet .../>`).
6. Clasificar hallazgos en **crítico**, **mayor**, **menor** o **informativo**, con referencias concretas.
7. Preferir `<ref_file .../>` o nombres de función/exportación sobre `<ref_snippet ... lines="..."/>`, salvo que el rango de líneas sea estable y esté verificado.
8. Todo cambio debe pasar `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` y `npm run knip`.
9. Antes de tocar código, leer `AGENTS.md`, `lecciones-aprendidas.md` y, si aplica, `guia-funcionamiento-pancheria.md`.

## Metodología

### 1. Preparación

- Trabajar en una rama separada, por ejemplo `auditoria/estado-YYYY-MM-DD`.
- Confirmar que `.env.local` existe y apunta a un entorno de desarrollo o pruebas, nunca a producción.
- Ejecutar `git status`, `git log --oneline -20` y `git rev-parse HEAD` para establecer el baseline.
- Instalar dependencias si es necesario con `npm install`.
- Leer el material prioritario y la documentación de referencia obligatoria.

### 2. Verificaciones base

Ejecutar en este orden y guardar la salida:

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
npm run knip
```

> **Comandos opcionales/condicionales:**
>
> ```bash
> npm run analyze           # identificar chunks grandes y dependencias innecesarias
> npm run analyze:webpack   # generar reportes HTML del bundle bajo webpack
> npx drizzle-kit check     # consistencia del esquema; requiere base de datos de prueba
> ```

> **Nota:** no ejecutar `npx tsx src/db/seeds.ts`, `npx drizzle-kit push`, `npx drizzle-kit generate`, `npm run test:e2e`, `npx playwright test` ni `npx vercel env pull` sin confirmación explícita del usuario y una base de datos descartable.

### 3. Auditoría del material prioritario

Revisar los tres archivos prioritarios y verificar:

- `reporte-estado.md`:
  - El resumen ejecutivo coincide con el baseline (`git rev-parse HEAD`) y con el working tree.
  - Las secciones de verificaciones base (`npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`, `npm run knip`) reportan los valores obtenidos en el paso 2.
  - El conteo de suites/tests, rutas/páginas, specs E2E y migraciones coincide con el estado actual.
  - Los hallazgos marcados como resueltos efectivamente están implementados en el código.
  - El plan de acción refleja las tareas abiertas y su prioridad.
  - No contiene referencias a features o variables eliminadas (por ejemplo, `NEXT_PUBLIC_WHATSAPP_*`).

- `auditoria-masiva-resumen.md`:
  - Las 9 áreas de auditoría siguen vigentes.
  - El flujo de ejecución y la checklist son reproducibles con el estado actual.
  - Los comandos, archivos y notas coinciden con `AGENTS.md` y `package.json`.
  - Las reglas de oro no contradigen a `AGENTS.md` ni al informe de estado.

- `auditoria-masiva.md`:
  - Las 9 áreas siguen siendo las dimensiones críticas del proyecto.
  - Los ejemplos de búsqueda (`process.env`, `throw new Error`, `findFirst`, etc.) siguen siendo válidos.
  - Las reglas y la metodología no están desactualizadas.
  - Los entregables y criterios de aceptación son alcanzables.

### 4. Auditoría general de `.devin`

Recorrer todo el directorio `.devin` y verificar:

- **Índices y READMEs**:
  - `.devin/README.md`, `.devin/prompts/README.md` e `.devin/informes/README.md` listan todos los prompts e informes activos.
  - No hay prompts o informes resueltos que deban archivarse.
  - Los archivos archivados no se mencionan como activos.

- **Prompts activos**:
  - Reflejan el estado actual del proyecto.
  - No duplican la guía de `auditoria-masiva.md` ni de `auditoria-y-documentacion.md` sin justificación.
  - Los prompts resueltos están en `.devin/prompts/archivados/` y se indica su estado.

- **Informes**:
  - `reporte-estado.md` es el único informe de estado vigente.
  - Los informes históricos están en `.devin/informes/archivados/`.
  - `lecciones-aprendidas.md` contiene lecciones vigentes y no incluye workarounds ya resueltos.

- **Environment.yaml**:
  - Coincide con `package.json`, `AGENTS.md` y `README.md` en versiones, scripts y variables.
  - Incluye los conocimientos más recientes del proyecto (catálogo paginado, imágenes de productos, pagos mixtos, eliminación de WhatsApp, etc.).
  - No contiene secretos ni URLs de bases de datos reales.

### 5. Cruzado documentación-código

- **Variables de entorno**:
  - Buscar todo `process.env.*` y `process.env.NEXT_PUBLIC_*` en `src/` y en archivos de configuración.
  - Comparar con `.env.example`, `AGENTS.md`, `README.md` y `.devin/environment.yaml`.
  - Detectar variables usadas en el código pero no documentadas, y viceversa.
  - Verificar que los valores por defecto documentados coincidan con los getters de `src/config/*`.
  - Confirmar que variables eliminadas (por ejemplo, `NEXT_PUBLIC_WHATSAPP_*`) no aparezcan en el código.

- **Comandos y scripts**:
  - Comparar los scripts de `package.json` con los comandos documentados en `AGENTS.md`, `README.md` y `.devin/environment.yaml`.
  - Verificar que `analyze:webpack`, `test:accessibility`, `start`, etc. estén documentados.

- **Arquitectura y convenciones**:
  - Verificar que `src/lib/utils.ts` solo contenga `cn`.
  - Confirmar que el manejo de errores usa `NotFoundError` → 404, `DomainError` → 400, `ForbiddenError` → 403, errores de conexión → 503.
  - Revisar que `process.env` se lea principalmente desde `src/config/*` y no directamente en runtime.
  - Buscar `throw new Error` genéricos y evaluar si deben convertirse a errores de dominio.

- **Seguridad**:
  - Buscar valores hardcodeados: `ADMIN_`, `SECRET`, `TOKEN`, `PASSWORD`, `localhost`, `http://`, `https://`.
  - Verificar que los endpoints del panel usen `withAuth` y aislamiento por `branchId`.
  - Confirmar que los endpoints públicos de escritura tengan rate limit.
  - Revisar CSP, headers y CORS en `next.config.ts` y `src/proxy.ts`.

- **Tests y cobertura**:
  - Inventariar tests unitarios (`*.test.ts`, `*.test.tsx`) y E2E (`tests/e2e/*.spec.ts`).
  - Cruzar rutas API, servicios, repositorios, helpers y componentes con su cobertura.
  - Detectar flujos críticos sin cobertura.

### 6. Síntesis y acciones correctivas

- Clasificar hallazgos en `crítico`, `mayor`, `menor` o `informativo`.
- Redactar o actualizar `.devin/informes/reporte-estado.md` con evidencia concreta (`<ref_file .../>`, `<ref_snippet .../>` cuando el rango sea estable).
- Aplicar correcciones documentales respaldadas por evidencia (no modificar archivos de negocio sin justificación).
- Archivar prompts o informes resueltos, actualizando los índices.
- Proponer un plan de acción ordenado por impacto y esfuerzo.

### 7. Cierre

- Re-ejecutar `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` y `npm run knip` si se aplicaron cambios.
- Actualizar `.devin/README.md`, `.devin/prompts/README.md` e `.devin/informes/README.md` si se creó o modificó un prompt o informe.
- Archivar informes históricos si se genera uno nuevo.
- Confirmar que `.env.local` y `.env.e2e` no se commitean.

## Entregables

1. Informe de auditoría actualizado en `.devin/informes/reporte-estado.md` con:
   - Resumen ejecutivo y baseline (`git rev-parse HEAD`).
   - Tabla de áreas auditadas con estado (ok, advertencia, crítico).
   - Hallazgos clasificados con referencias concretas (`<ref_file .../>`, `<ref_snippet .../>`).
   - Plan de acción priorizado.
   - Comandos ejecutados y resultados.

2. Correcciones documentales aplicadas en `AGENTS.md`, `README.md`, `.env.example` y/o `.devin/environment.yaml` si aplica.

3. Prompts e informes archivados si están resueltos, con índices actualizados.

4. Checklist de sincronización de `.devin` completado:
   - <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/auditoria-y-documentacion.md" />.

## Verificaciones antes de declarar terminada la tarea

| Paso | Comando | Propósito |
| ---- | ------- | --------- |
| 1 | `npm run lint` | Estilo y calidad |
| 2 | `npx tsc --noEmit` | Verificación de tipos |
| 3 | `npm test` | Tests unitarios |
| 4 | `npm run build` | Build de producción |
| 5 | `npm run knip` | Detección de código muerto |
| 6 | `npx drizzle-kit check` | Consistencia del esquema (con base de prueba, opcional) |
| 7 | `npm run test:e2e` | Tests E2E (solo con confirmación / base de prueba) |

> **Nota:** para tests E2E y migraciones, usar solo entornos de prueba descartables. Nunca contra producción ni datos reales.

## Criterio de aceptación

- El informe cubre las áreas de auditoría definidas en `auditoria-masiva.md`.
- Los hallazgos están clasificados y referenciados con evidencia concreta.
- Las recomendaciones son accionables, priorizadas y realistas para el equipo.
- Los comandos de verificación pasan, salvo `npm run test:e2e` que requiere base de prueba.
- La documentación del proyecto (`AGENTS.md`, `README.md`, `.env.example`, `.devin/environment.yaml` e índices) refleja el estado auditado.
- No se exponen secretos ni valores sensibles.
