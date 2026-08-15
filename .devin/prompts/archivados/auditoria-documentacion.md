# Prompt: Auditoría general de alcance, funciones, herramientas y vigencia de la documentación

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos y cierre de caja.

Stack:

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui basado en `@base-ui/react`
- NextAuth v5 (sesión JWT)
- Drizzle ORM 0.45.2 con PostgreSQL/Neon
- Jest y Testing Library
- Playwright para E2E
- Zod v4
- Arquitectura: componentes de servidor/cliente, server actions, servicios de aplicación, repositorios, dominio y helpers de autorización.

Documentación de referencia:

- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/README.md" />


## Objetivo

Realizar una auditoría general que identifique:

1. El **alcance funcional actual** de la aplicación: qué flujos están implementados y operativos.
2. Las **carencias o deuda técnica** detectadas: funciones incompletas, omisiones, inconsistencias o riesgos.
3. La **consistencia** entre el código, los tests y la documentación del proyecto.
4. **Riesgos de seguridad, integridad de datos y escalabilidad** que deban atenderse.

## Reglas de auditoría

1. No modificar archivos de negocio salvo para ejecutar verificaciones o generar informes. Cualquier cambio debe ser justificado y comunicado.
2. Cada hallazgo debe estar respaldado con referencias concretas del código usando `<ref_file .../>` o `<ref_snippet .../>`.
3. Clasificar los hallazgos en **crítico**, **mayor** o **menor**, e indicar si afectan seguridad, funcionalidad, calidad o documentación.
4. Ejecutar los comandos de verificación pertinentes según el área auditada.
5. Respetar las reglas de seguridad: no exponer `.env.local`, credenciales, secretos ni URLs sensibles.
6. Ejecutar tests E2E únicamente contra bases de datos de prueba.
7. Todo el informe debe redactarse en español.

## Áreas a auditar

### 1. Alcance funcional

Revisar las rutas del App Router (`src/app/(panel)/*`), las APIs (`src/app/api/*`) y las server actions para determinar qué dominios están cubiertos:

- Autenticación y autorización.
- Gestión de productos, promos y recetas.
- Ventas y terminal de ventas.
- Stock y movimientos.
- Caja (apertura, cierre, historial, eliminación/restauración).
- Cierre de caja y resúmenes diarios.
- Sucursales.
- Usuarios y roles.

Para cada dominio indicar:

- Flujo principal implementado.
- Funciones secundarias o de soporte existentes.
- Lo que falta o está incompleto.

### 2. Arquitectura y calidad de código

Verificar:

- Separación de responsabilidades entre componentes, servicios, repositorios y dominio.
- Duplicación de lógica o componentes similares.
- Imports obsoletos, códigos muertos o archivos no utilizados.
- Manejo consistente de errores (`DomainError`, `NotFoundError`, `ValidationError`, etc.).
- Uso correcto de `useActionState`, server actions y APIs.
- Coherencia en el uso de `getCurrentBranchId` y helpers de autorización.

### 3. Seguridad

Verificar:

- Protección de páginas y rutas API por rol.
- Aislamiento de datos por `branchId`.
- Validación de entradas en server actions y APIs.
- Manejo seguro de cookies de sesión y preferencias.
- Ausencia de credenciales hardcodeadas o secretos en el código.
- Funciones destructivas restringidas a administradores.

### 4. Integridad de datos

Verificar:

- Uso de soft delete vs. hard delete, especialmente en entidades históricas.
- Validación de relaciones y consistencia entre tablas.
- Comportamiento de cascadas y transacciones.
- Manejo de estados eliminados en consultas (`findFirst`, `findMany`).

### 5. Tests

Verificar:

- Cobertura unitaria en servicios, repositorios y utilidades.
- Tests de componentes críticos.
- Tests E2E y su alcance.
- Tests de seguridad y autorización si existen.

### 6. Documentación y guías

Verificar:

- `AGENTS.md` refleja el stack, comandos y variables de entorno actuales.
- `README.md` del proyecto describe el proyecto y su uso.
- Los prompts de `.devin/prompts/` están actualizados y no duplicados.
- Los informes de `.devin/informes/` son vigentes.
- Se documentan lecciones aprendidas y decisiones arquitectónicas importantes.

## Archivos y áreas de referencia iniciales

- <ref_file file="C:/developer/paginas/pancheria/package.json" />
- <ref_file file="C:/developer/paginas/pancheria/src/app" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/api" />
- <ref_file file="C:/developer/paginas/pancheria/src/application/services" />
- <ref_file file="C:/developer/paginas/pancheria/src/components" />
- <ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/lib/auth.ts" />
- <ref_file file="C:/developer/paginas/pancheria/tests" />

## Consideraciones de seguridad y entorno

- No hardcodear credenciales, secretos ni URLs de API.
- `.env.local` no debe commitearse.
- Ejecutar `npm run test:e2e` y `npx playwright test` únicamente contra bases de datos de prueba porque truncan tablas.
- Incluir siempre una sección de seguridad y entorno en el informe si se tocan credenciales o bases de datos.

## Verificaciones

| Comando | Propósito |
| ------- | --------- |
| `npm run lint` | Detectar errores de estilo y hooks |
| `npm run build` | Verificar build de producción |
| `npm test` | Ejecutar tests unitarios |
| `npx tsc --noEmit` | Verificar tipos |
| `npm run test:e2e` | Ejecutar tests E2E en base de prueba |
| `npx drizzle-kit push` | Solo si se toca el esquema |

## Entregable esperado

Un informe en `.devin/informes/` o en la conversación con:

1. Resumen ejecutivo.
2. Estado del alcance funcional (tabla por dominio).
3. Hallazgos críticos, mayores y menores con referencias al código.
4. Recomendaciones priorizadas.
5. Verificaciones ejecutadas y resultados.
