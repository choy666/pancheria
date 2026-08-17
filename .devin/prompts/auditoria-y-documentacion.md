# Prompt: Auditoría y sincronización de documentación

## Contexto

Proyecto: `panchería` — Sistema de gestión de stock, ventas, productos, recetas, caja, cierre diario, multi-sucursal, catálogo público de pedidos y gestión de videos con reproducción y Cast.

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM 0.45.2 con PostgreSQL (Neon), NextAuth v5, Jest, Playwright.

Documentación de referencia obligatoria:
- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/README.md" />
- <ref_file file="C:/developer/paginas/pancheria/.env.example" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/environment.yaml" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/README.md" />
- <ref_file file="C:/developer/paginas/pancheria/package.json" />

## Objetivo

Auditar, depurar y determinar si la documentación actual (`AGENTS.md`, `README.md`, `.env.example`, `.devin/environment.yaml`, prompts e informes) coincide con el código implementado. Generar un informe con recomendaciones, consejos y, cuando corresponda, aplicar correcciones documentales respaldadas por evidencia.

## Áreas de auditoría

1. **Alcance funcional**: rutas del App Router, endpoints de API, server actions, tablas de Drizzle, flujos críticos (ventas, pedidos, caja, cierre, videos, multi-sucursal).
2. **Variables de entorno**: toda variable leída por el código (`process.env.*`) debe estar en `.env.example` y documentada, con su valor por defecto real y su propósito.
3. **Arquitectura y convenciones**: separación de responsabilidades, hooks asíncronos con flag de montaje, manejo de errores (`NotFoundError` → 404, `DomainError` → 400, conexión a base de datos → 503), soft delete, transacciones.
4. **Seguridad**: ausencia de credenciales/URLs hardcodeadas, protección por rol, aislamiento por `branchId`, validación de entradas.
5. **Tests y verificaciones**: ejecutar `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`. `npm run test:e2e`, `npx tsx src/db/seeds.ts`, `npx drizzle-kit push` o `npx drizzle-kit generate` solo con confirmación explícita.
6. **Blueprints y prompts**: `.devin/environment.yaml` y los prompts deben reflejar el estado real del proyecto.

## Reglas

1. No modificar archivos de negocio salvo para corregir documentación. Cualquier cambio documental debe estar respaldado por evidencia del código (`<ref_file .../>`, `<ref_snippet .../>`).
2. No hardcodear credenciales, URLs de APIs ni secretos.
3. No exponer `.env.local` ni valores sensibles en prompts, documentos o reportes.
4. No ejecutar `npx tsx src/db/seeds.ts`, `npx drizzle-kit push`, `npx drizzle-kit generate`, `npm run test:e2e` ni `npx playwright test` sin confirmación explícita del usuario.
5. Todo el informe en español.
6. Clasificar hallazgos en **crítico**, **mayor**, **menor** o **informativo**, con referencias concretas.

## Metodología

1. Leer la documentación de referencia y los informes vigentes.
2. Cruzar con el código fuente: `src/db/schema.ts`, `src/config/*`, `src/lib/*`, `src/app/**/route.ts`, `src/app/(panel)/**/actions.ts`, `src/application/services/*`, `src/repositories/*`, `src/hooks/*`.
3. Verificar que toda variable de entorno consumida por el código aparezca en `.env.example` y en la documentación.
4. Verificar que los valores por defecto documentados coincidan con los del código.
5. Ejecutar `npm run lint`, `npx tsc --noEmit`, `npm test` y `npm run build`.
6. Documentar discrepancias, corregirlas cuando sean documentales y emitir un informe.
7. Actualizar `.devin/informes/reporte-estado-YYYY-MM-DD.md` con los resultados.

## Entregables

1. Prompt mejorado y actualizado (este archivo).
2. Correcciones documentales en `AGENTS.md`, `README.md`, `.env.example` y/o `.devin/environment.yaml` si aplica.
3. Informe en `.devin/informes/reporte-estado-YYYY-MM-DD.md` que incluya:
   - Resumen ejecutivo.
   - Alcance funcional verificado (tabla).
   - Hallazgos clasificados.
   - Acciones correctivas aplicadas.
   - Recomendaciones y consejos.
   - Comandos ejecutados y resultados.

## Verificaciones antes de declarar terminada la tarea

| Paso | Comando | Propósito |
| ---- | ------- | --------- |
| 1 | `npm run lint` | Estilo y calidad |
| 2 | `npx tsc --noEmit` | Verificación de tipos |
| 3 | `npm test` | Tests unitarios |
| 4 | `npm run build` | Build de producción |
