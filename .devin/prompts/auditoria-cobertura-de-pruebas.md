# Prompt: Auditoría de cobertura de pruebas y tests

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja, cierre diario, multi-sucursal, catálogo público de pedidos, chat de pedidos y gestión de videos con reproducción y Cast.

Stack: Next.js 16.3.3 (App Router), React 19.2.8, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM 0.45.2 con PostgreSQL (Neon), NextAuth v5, Jest, Playwright.

Documentación de referencia obligatoria:

- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/README.md" />
- <ref_file file="C:/developer/paginas/pancheria/.env.example" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/environment.yaml" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-estado.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/plan-de-accion-pendientes.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/auditoria-y-documentacion.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/correccion-tests-e2e-caja-y-entorno.md" />
- <ref_file file="C:/developer/paginas/pancheria/package.json" />
- <ref_file file="C:/developer/paginas/pancheria/jest.config.ts" />
- <ref_file file="C:/developer/paginas/pancheria/playwright.config.ts" />

## Objetivo

Corroborar que las pruebas y los tests del proyecto cubran, en lo posible, la mayor parte de los sectores más relevantes del negocio. La auditoría debe cruzar la documentación vigente, las variables de entorno existentes y el código fuente, identificando brechas de cobertura y proponiendo tests faltantes priorizados.

## Sectores relevantes a evaluar

1. **Autenticación y autorización**: login, sesiones, roles (`admin`, `operator`), permisos, selector de sucursal, multi-sucursal.
2. **Catálogo público y pedidos**: catálogo, carrito, creación de pedidos, seguimiento, WhatsApp, expiración, confirmación, cancelación, chat e imágenes.
3. **Ventas y terminal de ventas**: disponibilidad, creación de ventas, anulación, precios históricos, promos e insumos compartidos.
4. **Productos y recetas**: CRUD de productos, recetas, insumos críticos y manuales, soft delete, disponibilidad, agrupación.
5. **Stock**: ajustes, movimientos, restock, descuento automático, stock negativo, historial.
6. **Caja y cierres**: apertura, cierre, resumen, historial, cierre diario, cajas eliminadas, cierre automático, aislamiento por sucursal.
7. **Sucursales y usuarios**: CRUD de sucursales, CRUD de usuarios `operator`, reseteo de contraseñas.
8. **Videos y almacenamiento**: subida, stream, listado, reproducción, Google Cast, proveedores de storage (`local`, `vercel-blob`, `s3`, `r2`).
9. **Rate limiting y seguridad**: pedidos públicos, chat, login attempts, headers de proxy (`TRUSTED_PROXY_IP_HEADER`).
10. **Cron jobs y limpieza**: `rate-limit-cleanup`, `chat-attachments-cleanup`, protección por `CRON_SECRET`.
11. **Utilidades transversales**: fechas, dinero, URLs públicas (`getPublicBaseUrl`), manejo de errores de DB, esquemas Zod, helpers de venta/pedido/stock/caja.
12. **Configuración y variables de entorno**: correcta lectura de `process.env.*`, defaults, aliases de Vercel Postgres, variables de caja/chat/videos.

## Metodología

1. **Inventario de tests existentes**:
   - Listar todos los archivos `*.test.ts` y `*.test.tsx` bajo `src/` (Jest).
   - Listar todos los archivos `*.spec.ts` bajo `tests/e2e/` (Playwright).
   - Contar suites y tests con `npx jest --listTests` y `npm test`.
   - Agrupar los tests por sector relevante.

2. **Inventario de código a cubrir**:
   - Recorrer `src/app/**/route.ts` y comparar con los tests unitarios de rutas API.
   - Recorrer `src/application/services/*.ts` y comparar con `src/application/services/*.test.ts`.
   - Recorrer `src/repositories/*.ts` y comparar con `src/repositories/*.test.ts`.
   - Recorrer `src/lib/*.ts` y comparar con `src/lib/*.test.ts`.
   - Recorrer `src/components/**/*.tsx` y comparar con `src/components/**/*.test.tsx`.
   - Recorrer `src/app/(panel)/**/page.tsx` y `src/app/(public)/**/page.tsx` y comparar con E2E.

3. **Cruce con variables de entorno**:
   - Leer `.env.example` y `AGENTS.md` para identificar variables relevantes.
   - Buscar en `src/` todo `process.env.*` y `process.env.NEXT_PUBLIC_*`.
   - Verificar que cada variable tenga test de comportamiento cuando sea configurable (por ejemplo, `CAJA_AUTO_CLOSE_HOURS`, `ORDER_EXPIRATION_MS`, `NEXT_PUBLIC_CHAT_REFRESH_INTERVAL_MS`, `RATE_LIMIT_STORE_PROVIDER`, `STORAGE_PROVIDER`).

4. **Identificación de brechas**:
   - Para cada sector, marcar si está cubierto por tests unitarios, E2E, ambos o ninguno.
   - Detectar rutas API sin `route.test.ts`.
   - Detectar servicios/repositorios/helpers sin test.
   - Detectar componentes críticos de UI sin test unitario ni cobertura E2E.
   - Detectar flujos E2E críticos ausentes (rate limit, expiración, cierre automático, cambio de contraseña, edición/eliminación de recetas, anulación de pedidos, etc.).
   - **Verificar que los flujos listados como no cubiertos realmente no estén en los specs**; si un flujo aparece en múltiples specs o con cobertura parcial (por ejemplo, vía API en lugar de UI), documentarlo como parcial en lugar de ausente.

5. **Evaluación de calidad de tests**:
   - Revisar selectores E2E frágiles (`data-slot`, `td:nth-child`, nombres hardcodeados del seed).
   - Revisar `data-testid` expuestos en componentes de producción pero no usados en E2E.
   - Revisar tests que dependan de datos del seed sin aislamiento.
   - Revisar tests unitarios que no mockeen correctamente la base de datos o que usen valores hardcodeados.

## Reglas

1. No modificar archivos de negocio salvo que sea estrictamente necesario para auditar (por ejemplo, agregar un `data-testid` para verificar cobertura de E2E). Cualquier cambio debe estar respaldado por evidencia.
2. No hardcodear credenciales, URLs de APIs, secretos ni parámetros sensibles.
3. No exponer `.env.local`, `.env.e2e` ni valores sensibles en el informe.
4. No ejecutar `npm run test:e2e`, `npx playwright test`, `npx tsx src/db/seeds.ts`, `npx drizzle-kit push` ni `npx drizzle-kit generate` sin confirmación explícita del usuario y una base de datos de prueba.
5. Todo el informe y las recomendaciones deben estar en español.
6. Preferir `<ref_file .../>` o nombres de función/exportación sobre `<ref_snippet ... lines="..."/>`, salvo que el rango de líneas sea estable y esté verificado.
7. Clasificar los hallazgos en **crítico**, **mayor**, **menor** o **informativo**.

## Entregables

1. **Informe de cobertura** en `.devin/informes/reporte-estado.md` (actualizarlo) o en un archivo derivado si la tarea es puntual. El encabezado debe incluir la fecha y el `HEAD` de git (`git rev-parse HEAD`) como baseline. Debe incluir:
   - Resumen ejecutivo con conteos de tests.
   - Tabla de sectores vs cobertura (unitarios/E2E/ambos/ninguno).
   - Lista de archivos de producción sin test, agrupados por capa (API, servicios, repositorios, lib, componentes).
   - Lista de flujos E2E no cubiertos.
   - Hallazgos de calidad de tests (selectores frágiles, dependencia de seed, hardcodeos).
   - Recomendaciones priorizadas (alta/media/baja) para nuevos tests.

2. **Prompt actualizado** (este archivo) si se detectan mejoras en la metodología.

3. **Checklist de sincronización de `.devin`** si se aplican cambios documentales:
   - <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/auditoria-y-documentacion.md" />

## Verificaciones antes de declarar terminada la tarea

| Paso | Comando | Propósito |
| ---- | ------- | --------- |
| 1 | `npm run lint` | Estilo y calidad |
| 2 | `npx tsc --noEmit` | Verificación de tipos |
| 3 | `npm test` | Tests unitarios |
| 4 | `npm run build` | Build de producción |
| 5 | `npm run knip` | Detección de código muerto |
| 6 | `npm run test:e2e` | Tests E2E (solo con confirmación / base de prueba) |

## Criterio de aceptación

- El informe cubre todos los sectores relevantes listados en este prompt.
- Las brechas de cobertura están documentadas con referencias concretas a archivos y funciones.
- Las recomendaciones son accionables y priorizadas.
- Los comandos de verificación pasan, salvo `npm run test:e2e` que requiere base de prueba.
