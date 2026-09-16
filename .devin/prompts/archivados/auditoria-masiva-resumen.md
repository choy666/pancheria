# Resumen ejecutivo — Auditoría masiva integral

> Guía de uso rápida y acompañamiento para ejecutar <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/auditoria-masiva.md" />.
> Leer en conjunto con <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />, <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" /> y <ref_file file="C:/developer/paginas/pancheria/.devin/informes/checklist-pre-push.md" />.

## Cuándo usar esta auditoría

- Antes de un release importante o deploy a producción.
- Al finalizar un ciclo de desarrollo con múltiples cambios (ventas, pedidos, stock, caja, sucursales, chat, videos).
- Cuando se detectan regresiones, fallos intermitentes o deuda técnica acumulada.
- Como preparación para actualizar `.devin/informes/reporte-estado.md`.
- Después de cambios en arquitectura, variables de entorno, CI/CD o dependencias.

## Objetivo en una oración

Revisar de forma sistemática y reproducible las nueve dimensiones críticas del proyecto (código, seguridad, arquitectura, tests, documentación, rendimiento, accesibilidad, integridad de datos y despliegue) para detectar riesgos y proponer un plan de acción priorizado.

## Las 9 áreas de auditoría

1. **Calidad de código y consistencia** — `lint`, tipos, tests, build, estilo, imports ordenados, código muerto, manejo de errores (`NotFoundError` → 404, `DomainError` → 400, `ForbiddenError` → 403, errores de DB → 503).
2. **Seguridad** — valores hardcodeados, autenticación y autorización (`admin`/`operator`), aislamiento por `branchId`, rate limit en endpoints públicos, validación de archivos, headers y CSP/CORS.
3. **Arquitectura y deuda técnica** — separación de capas (`app/`, `application/`, `repositories/`, `lib/`, `domain/`), soft vs hard delete, duplicación de lógica (`createSale`, `confirmSale`, `convertOrderToSale`, `createOrder`), acoplamiento a `process.env`, complejidad ciclomática.
4. **Cobertura de pruebas** — inventario de unitarios y E2E, mapeo por sector (rutas API, servicios, repositorios, helpers, componentes), flujos críticos sin cobertura.
5. **Documentación y variables de entorno** — sincronización de `process.env` en `src/` con `.env.example`, `AGENTS.md`, `README.md` y `.devin/environment.yaml`.
6. **Rendimiento y bundle** — `npm run analyze`, `dynamic = 'force-dynamic'`, consultas N+1, polling, imágenes/videos, hydration y renders innecesarios.
7. **Accesibilidad y UX** — `aria-*`, roles, labels, estados de carga/error/vacío, responsive, tour interactivo.
8. **Integridad de datos y flujos de negocio** — ventas, pedidos, pagos mixtos, anulaciones, cierre de caja, stock, expiración de pedidos, snapshots de recetas.
9. **Configuración de despliegue, CI/CD y entornos** — `.github/workflows/ci.yml`, `playwright.config.ts`, `vercel.json`, `next.config.ts`, `package.json`, `.env.local`/`env.e2e` no commiteados.

## Documentación de referencia obligatoria

- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/README.md" />
- <ref_file file="C:/developer/paginas/pancheria/.env.example" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/environment.yaml" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-estado.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/checklist-pre-push.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/auditoria-y-documentacion.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/auditoria-cobertura-de-pruebas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/pancheria.prompt.md" />
- <ref_file file="C:/developer/paginas/pancheria/package.json" />

## Flujo de ejecución

### 1. Preparación del entorno

- Trabajar en una rama separada, por ejemplo `auditoria/masiva-YYYY-MM-DD`.
- Confirmar que `.env.local` existe y apunta a un entorno de desarrollo o pruebas, nunca a producción.
- Ejecutar `git status`, `git log --oneline -20` y `git rev-parse HEAD` para establecer el baseline.
- Instalar dependencias si es necesario con `npm install`.

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
> npx drizzle-kit check     # consistencia del esquema; requiere base de datos de prueba
> ```

> **Nota:** no ejecutar `npx tsx src/db/seeds.ts`, `npx drizzle-kit push`, `npx drizzle-kit generate`, `npm run test:e2e`, `npx playwright test` ni `npx vercel env pull` sin confirmación explícita del usuario y una base de datos descartable.

### 3. Análisis por áreas

Recorrer `src/`, `tests/`, `.github/`, `next.config.ts`, `vercel.json` y `package.json` según las nueve áreas del prompt. Usar búsquedas dirigidas para detectar patrones críticos:

| Patrón | Propósito |
| ------ | --------- |
| `process.env` / `process.env.NEXT_PUBLIC_*` | Verificar variables documentadas y usadas. |
| `ADMIN_`, `SECRET`, `TOKEN`, `PASSWORD` | Detectar hardcodeos y exposición de credenciales. |
| `throw new Error` | Revisar manejo de errores y excepciones. |
| `findFirst` | Confirmar orden explícito cuando coexisten activos e inactivos. |
| `localhost`, `http://`, `https://` | Identificar URLs hardcodeadas. |

### 4. Cruzado documentación-código

- Comparar variables de entorno en `src/` con `.env.example`, `AGENTS.md` y `README.md`.
- Verificar que `AGENTS.md`, `README.md` y `.devin/environment.yaml` estén sincronizados.
- Confirmar que prompts resueltos estén archivados en `.devin/prompts/archivados/` y reflejados en los índices.

### 5. Evaluación de tests

- Inventariar tests unitarios y E2E.
- Cruzar rutas API, servicios, repositorios, helpers y componentes con su cobertura.
- Detectar flujos críticos sin cobertura: rate limit, expiración de pedidos, cierre automático de caja, edición/eliminación de recetas, anulación de pedidos, pagos mixtos, cambio de contraseña y eliminación de sucursal.

### 6. Síntesis y entrega

- Clasificar hallazgos en `crítico`, `mayor`, `menor` o `informativo`.
- Redactar o actualizar `.devin/informes/reporte-estado.md` con evidencia concreta (`<ref_file .../>`, `<ref_snippet .../>` cuando el rango sea estable).
- Proponer un plan de acción ordenado por impacto y esfuerzo.

### 7. Cierre

- Re-ejecutar verificaciones base si se aplicaron cambios.
- Actualizar índices `.devin/README.md` y `.devin/prompts/README.md` si se modifica o crea un prompt.
- Archivar informes históricos si se genera uno nuevo.

## Checklist de uso

- [ ] Leer `AGENTS.md`, `lecciones-aprendidas.md` y, si aplica, `guia-funcionamiento-pancheria.md`.
- [ ] Confirmar entorno seguro: `.env.local` apunta a desarrollo/pruebas.
- [ ] Crear rama de auditoría y registrar baseline (`git rev-parse HEAD`).
- [ ] Ejecutar `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`, `npm run knip`.
- [ ] Ejecutar opcionalmente `npm run analyze` y `npx drizzle-kit check` si aplica.
- [ ] Documentar resultados de los comandos base.
- [ ] Analizar las 9 áreas del prompt con búsquedas dirigidas.
- [ ] Cruzar variables de entorno y documentación.
- [ ] Mapear cobertura de tests y detectar brechas críticas.
- [ ] Clasificar hallazgos por impacto y referenciarlos con evidencia.
- [ ] Actualizar `.devin/informes/reporte-estado.md`.
- [ ] Actualizar índices si corresponde.
- [ ] Re-ejecutar verificaciones si se hicieron cambios.

## Criterios de aceptación de la auditoría

1. El informe cubre las nueve áreas de auditoría.
2. Los hallazgos están clasificados y referenciados con evidencia concreta.
3. Las recomendaciones son accionables, priorizadas y realistas para el equipo.
4. Los comandos de verificación pasan, salvo `npm run test:e2e` que requiere base de prueba.
5. La documentación del proyecto (`AGENTS.md`, `README.md`, `.env.example`, `.devin/environment.yaml`, índices) refleja el estado auditado.

## Reglas de oro (compendio)

- Todo en español: explicaciones, comentarios, documentación e informes.
- Nunca hardcodear credenciales, URLs de APIs, secretos ni parámetros sensibles.
- No exponer `.env.local`, `.env.e2e`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `NEXTAUTH_SECRET` ni URLs de base de datos en prompts, documentos o reportes.
- No modificar archivos de negocio salvo correcciones documentales o de configuración respaldadas por evidencia.
- Preferir `<ref_file .../>` o nombres de función/exportación sobre `<ref_snippet .../>`, salvo que el rango de líneas sea estable y esté verificado.
- Todo cambio debe pasar `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` y `npm run knip`.

## Entregables

1. Informe de auditoría actualizado en `.devin/informes/reporte-estado.md`.
2. Prompt actualizado si se detectan mejoras en la metodología (`auditoria-masiva.md`).
3. Correcciones aplicadas (solo documentales o de configuración), con evidencia.
4. Checklist de sincronización de `.devin` completado si aplica: <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/auditoria-y-documentacion.md" />.

## Véase también

- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/auditoria-masiva.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/auditoria-cobertura-de-pruebas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-estado.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/checklist-pre-push.md" />
