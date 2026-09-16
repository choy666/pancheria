# Prompt: Auditoría masiva integral del proyecto

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja, cierre diario, multi-sucursal, catálogo público de pedidos, chat de pedidos, imágenes de productos/promos y gestión de videos con reproducción y Google Cast.

Stack: Next.js 16.3.3 (App Router), React 19.2.8, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM 0.45.2 con PostgreSQL (Neon), NextAuth v5, Jest, Playwright.

Documentación de referencia obligatoria:

- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/README.md" />
- <ref_file file="C:/developer/paginas/pancheria/.env.example" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/environment.yaml" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-estado.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/checklist-pre-push.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/entornos.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/auditoria-y-documentacion.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/auditoria-cobertura-de-pruebas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/pancheria.prompt.md" />
- <ref_file file="C:/developer/paginas/pancheria/package.json" />

## Objetivo

Realizar una auditoría masiva, sistemática y reproducible del proyecto `pancheria` en su estado actual (`HEAD` de `main`), cubriendo las dimensiones críticas de calidad de código, seguridad, arquitectura, cobertura de pruebas, documentación, variables de entorno, rendimiento, accesibilidad, integridad de datos y configuración de despliegue/CI.

La auditoría debe:

1. Detectar regresiones, inconsistencias, deuda técnica y riesgos potenciales.
2. Cruzar el código fuente con la documentación vigente y las lecciones aprendidas.
3. Clasificar hallazgos por impacto y proponer un plan de acción priorizado.
4. Emitir un informe estructurado sin modificar archivos de negocio, salvo correcciones documentales o de configuración respaldadas por evidencia.

## Áreas de auditoría

### 1. Calidad de código y consistencia

- Ejecutar y verificar `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` y `npm run knip`.
- Revisar estilo, convenciones de nomenclatura, imports ordenados y ausencia de códigos muertos.
- Identificar archivos duplicados, funciones excesivamente largas, anidación profunda y mezcla de responsabilidades.
- Verificar que `src/lib/utils.ts` contenga solo `cn` y que utilidades generales estén en archivos específicos (`json.ts`, `money.ts`, `date.ts`, etc.).
- Revisar manejo de errores: `NotFoundError` → 404, `DomainError` → 400, `ForbiddenError` → 403, errores de conexión a DB → 503.

### 2. Seguridad

- Buscar valores hardcodeados: URLs de API, credenciales, secretos, tokens, contraseñas, IPs, dominios, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `NEXTAUTH_SECRET`.
- Verificar protección de endpoints: autenticación en rutas del panel, autorización por rol (`admin`/`operator`), aislamiento por `branchId`.
- Revisar endpoints públicos de escritura (`POST /api/public/pedido`, chat, upload) para confirmar rate limit y validación de inputs.
- Verificar que `CRON_SECRET` proteja los cron jobs y que `TRUSTED_PROXY_IP_HEADER` sea configurable.
- Confirmar que `STORAGE_PROVIDER`, credenciales de Blob/S3/R2 y `NEXTAUTH_URL`/`AUTH_URL` se lean desde variables de entorno.
- Revisar validación de archivos subidos (tamaño, MIME, extensión) y prevención de path traversal en `local`.
- Verificar headers de seguridad, CSP y configuración de CORS en `next.config.ts`.

### 3. Arquitectura y deuda técnica

- Evaluar separación de capas: `src/app/` (UI/API), `src/application/` (casos de uso), `src/repositories/` (acceso a datos), `src/lib/` (utilidades), `src/domain/` (tipos/errores).
- Identificar lógica de negocio en componentes, páginas o helpers de UI que debería estar en servicios.
- Revisar patrones de soft delete vs hard delete: consistencia en productos, videos, cajas, sucursales.
- Verificar uso de `findFirst` con orden explícito cuando coexisten activos e inactivos.
- Detectar duplicación de lógica entre `createSale`, `confirmSale`, `convertOrderToSale`, `createOrder`.
- Revisar acoplamiento a `process.env` directo; preferir `src/config/*` con getters.
- Evaluar complejidad ciclomática de funciones críticas (`buildSaleItemValues`, `createOrder`, `confirmSale`, `deleteBranch`).

### 4. Cobertura de pruebas

- Inventariar tests unitarios (`*.test.ts`, `*.test.tsx`) y E2E (`tests/e2e/*.spec.ts`).
- Cruzar rutas API (`src/app/api/**/route.ts`) con `route.test.ts`.
- Cruzar servicios (`src/application/services/*.ts`) con `*.test.ts`.
- Cruzar repositorios (`src/repositories/*.ts`) con `*.test.ts`.
- Cruzar helpers de `src/lib/*.ts` con `*.test.ts`.
- Identificar componentes críticos de UI sin test unitario o E2E.
- Revisar calidad de tests: mocks de base de datos, uso de `data-testid`, dependencia de datos del seed, selectores frágiles.
- Verificar flujos E2E críticos no cubiertos: rate limit, expiración de pedidos, cierre automático de caja, edición/eliminación de recetas, anulación de pedidos, pagos mixtos, cambio de contraseña, eliminación de sucursal.

### 5. Documentación y variables de entorno

- Cruzar `process.env.*` y `process.env.NEXT_PUBLIC_*` en `src/` con `.env.example`, `AGENTS.md`, `README.md` y `.devin/environment.yaml`.
- Verificar que cada variable tenga valor por defecto documentado y que coincida con el código.
- Detectar variables leídas por el código pero no documentadas, y viceversa.
- Revisar que `AGENTS.md`, `README.md` y `.devin/environment.yaml` estén sincronizados con el código.
- Verificar que prompts resueltos estén archivados en `.devin/prompts/archivados/` y reflejados en índices.

### 6. Rendimiento y bundle

- Ejecutar `npm run analyze` para identificar chunks grandes y dependencias innecesarias.
- Revisar uso de `dynamic = 'force-dynamic'` en páginas públicas críticas.
- Evaluar consultas a base de datos: N+1, carga de colecciones completas en memoria, paginación.
- Verificar intervalos de polling y configuración de refresco (`NEXT_PUBLIC_CAJA_REFRESH_INTERVAL_MS`, `NEXT_PUBLIC_CHAT_REFRESH_INTERVAL_MS`, etc.).
- Revisar imágenes y videos: optimización, lazy loading, tamaños, formatos.
- Detectar renders innecesarios, uso de `useEffect` para sincronizar props y hydration mismatch.

### 7. Accesibilidad y UX

- Revisar uso de `aria-*`, roles, labels, `aria-pressed`, navegación por teclado.
- Verificar que componentes de formularios tengan errores asociados y mensajes descriptivos.
- Evaluar estados de carga, error y vacío en listados y formularios.
- Revisar responsive design y comportamiento en móviles (`responsive.spec.ts`).
- Verificar consistencia visual: uso de `cn`, `class-variance-authority`, Tailwind v4.
- Revisar tour interactivo: adaptación por rol, `data-tour`, `skipMissingElement`.

### 8. Integridad de datos y flujos de negocio

- Validar flujos de ventas, pedidos, reservas, pagos mixtos, anulaciones y cierre de caja.
- Verificar snapshots de recetas en `sale_item_recipes` y `order_item_recipes`.
- Confirmar que el soft delete no libere archivos asociados y que el hard delete sí lo haga.
- Revisar integridad referencial: `products` con `sale_items`/`order_items`, `recipes`, `stock_movements`.
- Verificar lógica de stock: descuentos, reintegros, reservas, ajustes manuales.
- Revisar expiración de pedidos `pending` y limpieza de adjuntos huérfanos.
- Validar cálculo de disponibilidad de promos (`calculateCompoundAvailability`).

### 9. Configuración de despliegue, CI/CD y entornos

- Revisar `.github/workflows/ci.yml` y `playwright.config.ts`.
- Verificar que las variables de E2E estén correctamente propagadas (`E2E_ENABLE_RATE_LIMIT`, `PUBLIC_ORDER_RATE_LIMIT_ENABLE_IN_DEV`, etc.).
- Confirmar que `vercel.json` incluya cron jobs y headers/CSP adecuados.
- Revisar `next.config.ts` para compresión en test, headers de seguridad y configuración de imágenes.
- Verificar que no se commiteen `.env.local`, `.env.e2e` ni secretos.
- Revisar `package.json` por dependencias sin uso o duplicadas.

## Reglas de oro

1. Idioma español en todo: explicaciones, comentarios, documentación e informes.
2. Nunca hardcodear credenciales, URLs de APIs, secretos ni parámetros sensibles. Todo debe provenir de variables de entorno o configuraciones dinámicas.
3. No exponer `.env.local`, `.env.e2e`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `NEXTAUTH_SECRET` ni URLs de base de datos en prompts, documentos o reportes.
4. No ejecutar `npx tsx src/db/seeds.ts`, `npx drizzle-kit push`, `npx drizzle-kit generate`, `npm run test:e2e`, `npx playwright test` ni `npx vercel env pull` sin confirmación explícita del usuario y una base de datos de prueba.
5. No modificar archivos de negocio salvo para corregir documentación o configuración respaldada por evidencia del código (`<ref_file .../>`, `<ref_snippet .../>`).
6. Clasificar hallazgos en **crítico**, **mayor**, **menor** o **informativo**, con referencias concretas.
7. Preferir `<ref_file .../>` o nombres de función/exportación sobre `<ref_snippet ... lines="..."/>`, salvo que el rango de líneas sea estable y esté verificado.
8. Todo cambio debe pasar las verificaciones mínimas: `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` y `npm run knip`.
9. Antes de tocar código, leer `AGENTS.md`, `lecciones-aprendidas.md` y, si aplica, `guia-funcionamiento-pancheria.md`.

## Metodología

1. **Preparación**:
   - Leer toda la documentación de referencia obligatoria.
   - Ejecutar `git status`, `git log --oneline -20` y `git rev-parse HEAD` para establecer baseline.
   - Confirmar que el entorno tenga `.env.local` y dependencias instaladas.

2. **Verificaciones base**:
   - Ejecutar en orden: `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`, `npm run knip`.
   - Documentar resultados, errores y warnings.

3. **Análisis por áreas**:
   - Recorrer `src/`, `tests/`, `.github/`, `next.config.ts`, `vercel.json` y `package.json` según el área.
   - Usar `grep` para buscar `process.env`, `throw new Error`, `findFirst`, `localhost`, `http://`, `https://`, `ADMIN_`, `SECRET`, `TOKEN`, `PASSWORD`.
   - Identificar duplicaciones, código muerto, inconsistencias y patrones riesgosos.

4. **Cruzado documentación-código**:
   - Comparar `.env.example` con variables usadas en `src/`.
   - Comparar `AGENTS.md` y `README.md` con estructura y comandos actuales.
   - Verificar que prompts e informes estén actualizados y archivados si corresponde.

5. **Evaluación de tests**:
   - Contar tests unitarios y E2E.
   - Mapear cobertura por sector según `auditoria-cobertura-de-pruebas.md`.
   - Detectar rutas API, servicios, repositorios, helpers y componentes sin cobertura.

6. **Síntesis**:
   - Clasificar hallazgos y asignar prioridad.
   - Proponer plan de acción ordenado por impacto/esfuerzo.
   - Redactar informe en `.devin/informes/reporte-estado.md` o en archivo derivado si la auditoría es puntual.

7. **Cierre**:
   - Re-ejecutar verificaciones base si se aplicaron cambios.
   - Actualizar índices `.devin/README.md` y `.devin/prompts/README.md` si se crea o modifica un prompt.
   - Archivar informes históricos si se genera uno nuevo.

## Entregables

1. **Informe de auditoría** en `.devin/informes/reporte-estado.md` (actualizar el vigente) con:
   - Resumen ejecutivo y baseline (`git rev-parse HEAD`).
   - Tabla de áreas auditadas con estado (ok, advertencia, crítico).
   - Hallazgos clasificados con referencias concretas (`<ref_file .../>`, `<ref_snippet .../>`).
   - Plan de acción priorizado.
   - Comandos ejecutados y resultados.

2. **Prompt actualizado** (este archivo) si se detectan mejoras en la metodología.

3. **Correcciones aplicadas** (solo documentales o de configuración), con evidencia.

4. **Checklist de sincronización de `.devin`** completado si aplica:
   - <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/auditoria-y-documentacion.md" />

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

- El informe cubre las nueve áreas de auditoría.
- Los hallazgos están clasificados y referenciados con evidencia concreta.
- Las recomendaciones son accionables, priorizadas y realistas para el equipo.
- Los comandos de verificación pasan, salvo `npm run test:e2e` que requiere base de prueba.
- La documentación del proyecto (`AGENTS.md`, `README.md`, `.env.example`, `.devin/environment.yaml`, índices) refleja el estado auditado.
