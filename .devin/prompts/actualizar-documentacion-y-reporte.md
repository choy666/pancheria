# Prompt: Actualizar documentación existente y generar informe de estado del proyecto

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja, cierre diario y multi-sucursal.

Stack y arquitectura:

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- Drizzle ORM con PostgreSQL (Neon)
- NextAuth v5
- Jest y Playwright
- Arquitectura: repositorios + servicios de aplicación + dominio

Documentación existente a mantener vigente:

- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/README.md" />
- <ref_file file="C:/developer/paginas/pancheria/.env.example" />
- <ref_file file="C:/developer/paginas/pancheria/package.json" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/environment.yaml" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/README.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/README.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />

Informes previos que sirven de línea base (revisar los más recientes en `.devin/informes/`):

- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-auditoria-2026-08-12.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-pruebas-2026-08-12.md" />

## Objetivo

Actualizar la documentación del proyecto para que refleje fielmente el estado actual del código, el stack, las variables de entorno, los comandos y los flujos de negocio; y generar un informe de estado que constate el resultado de las verificaciones, los cambios aplicados a la documentación y los riesgos o discrepancias pendientes.

## Reglas de negocio y consideraciones

1. No hardcodear credenciales, URLs de API, secretos ni valores sensibles en documentos, prompts o reportes.
2. No exponer el contenido de `.env.local` en el reporte. Solo referenciar nombres de variables.
3. No ejecutar `npx tsx src/db/seeds.ts`, `npx drizzle-kit push`, `npx drizzle-kit generate` ni `npm run test:e2e` sin confirmación explícita del usuario, porque truncan o modifican la base de datos.
4. Si un comando de verificación falla, detenerse, investigar la causa raíz y documentarla antes de seguir.
5. Cualquier cambio en documentación debe estar respaldado por evidencia del código o de los resultados de comandos.
6. Preferir ediciones menoras y precisas; para cambios estructurales grandes en documentos, presentar una propuesta y esperar confirmación.
7. Mantener todo el contenido en español.

## Implementación detallada

### 1. Revisión inicial de documentos y lecciones aprendidas

Leer la documentación listada en "Contexto" y extraer las afirmaciones que deben contrastarse con la realidad del código:

- Comandos principales y scripts (`AGENTS.md`, `README.md`, `package.json`).
- Variables de entorno requeridas y opcionales (`AGENTS.md`, `.env.example`, `.env.local` si existe, `.devin/environment.yaml`).
- Estructura de carpetas y capas (`AGENTS.md`, `README.md`, `.devin/environment.yaml`).
- Tecnologías y versiones (`AGENTS.md`, `README.md`, `package.json`).
- Flujos de negocio documentados (multi-sucursal, tour, recetas, stock, caja, cierre, usuarios, sucursales).
- Estado de prompts históricos: verificar si están resueltos, obsoletos o vigentes (por ejemplo `multi-sucursal.md`).
- Lecciones aprendidas aplicables y pendientes.

### 2. Inspección del código y del entorno

Explorar el código fuente para confirmar el alcance funcional y las funciones principales:

- <ref_file file="C:/developer/paginas/pancheria/src/app" />
- <ref_file file="C:/developer/paginas/pancheria/src/application" />
- <ref_file file="C:/developer/paginas/pancheria/src/repositories" />
- <ref_file file="C:/developer/paginas/pancheria/src/db" />
- <ref_file file="C:/developer/paginas/pancheria/src/domain" />
- <ref_file file="C:/developer/paginas/pancheria/src/components" />
- <ref_file file="C:/developer/paginas/pancheria/src/config" />
- <ref_file file="C:/developer/paginas/pancheria/src/hooks" />
- <ref_file file="C:/developer/paginas/pancheria/src/lib" />
- <ref_file file="C:/developer/paginas/pancheria/tests" />
- <ref_file file="C:/developer/paginas/pancheria/.devin" />

### 3. Verificaciones seguras del estado actual

Ejecutar los comandos seguros en orden. Detenerse si alguno falla:

| Paso | Comando | Propósito |
| ---- | ------- | --------- |
| 1 | `npm run lint` | Calidad de código y estilo. |
| 2 | `npx tsc --noEmit` | Verificación de tipos. |
| 3 | `npm test` | Tests unitarios y de repositorio. |
| 4 | `npm run build` | Build de producción. |
| 5 | `npx drizzle-kit check` | Consistencia del esquema (solo si el usuario autoriza conexión a la base). |

Comandos que requieren confirmación explícita:

| Comando | Propósito | Restricción |
| ------- | --------- | ----------- |
| `npx tsx src/db/seeds.ts` | Verificar idempotencia del seed | Solo base de prueba. |
| `npm run test:e2e` o `npx playwright test` | Tests end-to-end | Trunca tablas de negocio. |
| `npx drizzle-kit push` / `npx drizzle-kit generate` | Migraciones de base de datos | Puede modificar esquema. |

### 4. Detección de discrepancias y oportunidades de mejora

Cruzar los hallazgos con la documentación y clasificar las discrepancias:

- **Comandos**: ¿existen en `package.json`? ¿Son correctos y están en `AGENTS.md` y `README.md`?
- **Variables de entorno**: ¿`.env.example` y `AGENTS.md` cubren todas las variables usadas en `src/db/index.ts`, `drizzle.config.ts`, `src/db/seeds.ts`, `src/config/*` y `.devin/environment.yaml`?
- **Estructura de carpetas**: ¿la estructura real de `src/` coincide con la documentada?
- **Tecnologías y versiones**: ¿`package.json` refleja Next.js 16, React 19, Tailwind v4, Drizzle, NextAuth, etc.?
- **Flujos de negocio**: ¿los flujos documentados tienen implementación y tests?
- **Prompts históricos**: ¿alguno describe un estado ya resuelto u obsoleto? Marcarlo como tal.
- **Informes**: ¿`lecciones-aprendidas.md` sigue siendo aplicable? ¿hay lecciones resueltas que deberían marcarse como resueltas?

### 5. Actualización de documentación

Aplicar actualizaciones puntuales a los documentos, priorizando los siguientes archivos:

- <ref_file file="C:/developer/paginas/pancheria/README.md" />
  - Agregar o corregir secciones de multi-sucursal, tour, comandos y variables de entorno según el estado real.
- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
  - Actualizar tabla de comandos, variables de entorno, estructura y troubleshooting.
- <ref_file file="C:/developer/paginas/pancheria/.devin/environment.yaml" />
  - Incluir variables faltantes (`DEFAULT_BRANCH_NAME`, `NEW_BRANCH_NAME`, `NEW_BRANCH_USERNAME`, `NEW_BRANCH_PASSWORD`, `NEXT_PUBLIC_CAJA_REFRESH_INTERVAL_MS`).
- <ref_file file="C:/developer/paginas/pancheria/.env.example" />
  - Verificar que todas las variables requeridas estén documentadas.
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/README.md" />
  - Agregar enlaces a prompts nuevos o marcar prompts obsoletos como resueltos/archivados.
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/README.md" />
  - Actualizar el índice de informes si se genera un nuevo reporte.
- Archivos de prompts obsoletos (por ejemplo `multi-sucursal.md`):
  - Agregar una advertencia inicial clara que indique que el prompt está resuelto o archivado.

Para cada cambio documental, registrar:

- Archivo afectado.
- Afirmación anterior (si aplica).
- Evidencia del código o del comando.
- Texto nuevo o ajuste aplicado.

### 6. Generación del informe de estado

Crear un archivo en `.devin/informes/reporte-estado-YYYY-MM-DD.md` con la siguiente estructura:

1. **Resumen ejecutivo**: estado general (consistente / con advertencias / con bloqueos).
2. **Comandos ejecutados**: lista de cada comando con su resultado.
3. **Alcance funcional vigente**: dominios y flujos implementados, con rutas y servicios clave.
4. **Discrepancias documentales detectadas**: documento, afirmación, realidad, evidencia y gravedad.
5. **Cambios aplicados a la documentación**: archivos editados y motivo de cada cambio.
6. **Lecciones aprendidas aplicables**: cuáles siguen vigentes y cuáles parecen resueltas.
7. **Riesgos y acciones pendientes**: tareas que requieren confirmación o intervención del usuario.
8. **Recomendaciones**: próximos pasos, incluyendo nuevos prompts, refactors o tests.

## Archivos y áreas relevantes

- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/README.md" />
- <ref_file file="C:/developer/paginas/pancheria/package.json" />
- <ref_file file="C:/developer/paginas/pancheria/.env.example" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/environment.yaml" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/README.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/README.md" />
- Directorios `src/app`, `src/application`, `src/repositories`, `src/db`, `src/domain`, `src/components`, `src/config`, `src/hooks`, `src/lib`, `tests`, `.devin/prompts`, `.devin/informes`.

## Consideraciones de seguridad y entorno

- `.env.local` no debe commitearse ni incluirse en el reporte.
- No exponer `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `NEXTAUTH_SECRET`, URLs de base de datos ni tokens.
- No ejecutar operaciones destructivas en la base de datos sin confirmación y backup.
- Ejecutar tests E2E y seed solo en una base de datos de prueba dedicada.

## Verificaciones

| Comando | Propósito |
| ------- | --------- |
| `npm run lint` | Estilo y calidad de código |
| `npx tsc --noEmit` | Verificación de tipos |
| `npm test` | Tests unitarios |
| `npm run build` | Build de producción |
| `npx drizzle-kit check` | Consistencia del esquema (con confirmación) |
| `npx tsx src/db/seeds.ts` | Seed idempotente (con confirmación) |
| `npm run test:e2e` | Tests end-to-end (con confirmación) |
