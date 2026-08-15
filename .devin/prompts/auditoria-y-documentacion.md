# Prompt: Auditoría y actualización de documentación

## Contexto

Proyecto: `panchería` — Sistema de gestión de stock, ventas, productos, recetas, caja, cierre diario y multi-sucursal.

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM 0.45.2 con PostgreSQL (Neon), NextAuth v5, Jest, Playwright.

Documentación de referencia:
- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/README.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/README.md" />
- <ref_file file="C:/developer/paginas/pancheria/package.json" />
- <ref_file file="C:/developer/paginas/pancheria/.env.example" />

## Objetivo

Auditar la documentación y el código para detectar discrepancias, deuda técnica, riesgos de seguridad/escalabilidad y actualizar `AGENTS.md`, `README.md`, `.env.example`, `.devin/environment.yaml`, `.devin/informes/` y `.devin/prompts/` para que reflejen el estado real del proyecto.

## Reglas

1. No modificar archivos de negocio salvo para verificaciones. Cualquier cambio en documentación debe estar respaldado por evidencia.
2. No hardcodear credenciales, URLs ni secretos.
3. No exponer `.env.local` en documentos.
4. No ejecutar `npx tsx src/db/seeds.ts`, `npx drizzle-kit push`, `npx drizzle-kit generate` ni `npm run test:e2e` sin confirmación explícita.
5. Clasificar hallazgos en crítico, mayor o menor, con referencias `<ref_file .../>` o `<ref_snippet .../>`.
6. Todo el informe en español.

## Áreas a auditar

1. **Alcance funcional**: rutas del App Router, APIs, server actions (autenticación, productos, ventas, stock, caja, cierre, sucursales, usuarios, videos, catálogo).
2. **Arquitectura y calidad**: separación de responsabilidades, duplicaciones, imports obsoletos, manejo de errores, uso de `useActionState`.
3. **Seguridad**: protección por rol, aislamiento por `branchId`, validación de entradas, manejo de cookies, ausencia de hardcodeos.
4. **Integridad de datos**: soft delete, relaciones, transacciones, `findFirst`/`findMany` con registros inactivos.
5. **Tests**: unitarios, E2E, cobertura.
6. **Documentación**: vigencia de `AGENTS.md`, `README.md`, prompts e informes.

## Archivos de referencia

- <ref_file file="C:/developer/paginas/pancheria/package.json" />
- <ref_file file="C:/developer/paginas/pancheria/src/app" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/api" />
- <ref_file file="C:/developer/paginas/pancheria/src/application/services" />
- <ref_file file="C:/developer/paginas/pancheria/src/components" />
- <ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/lib/auth.ts" />
- <ref_file file="C:/developer/paginas/pancheria/tests" />

## Verificaciones

| Comando | Propósito |
| ------- | --------- |
| `npm run lint` | Estilo y calidad |
| `npx tsc --noEmit` | Verificación de tipos |
| `npm test` | Tests unitarios |
| `npm run build` | Build de producción |
| `npx drizzle-kit check` | Consistencia del esquema |
| `npm run test:e2e` | Tests E2E en base de prueba (con confirmación) |

## Entregable

Generar o actualizar:
1. Resumen ejecutivo con estado general.
2. Tabla de alcance funcional por dominio.
3. Hallazgos críticos, mayores y menores con referencias.
4. Recomendaciones priorizadas.
5. Cambios aplicados a documentos.
6. Informe en `.devin/informes/reporte-estado-YYYY-MM-DD.md`.
