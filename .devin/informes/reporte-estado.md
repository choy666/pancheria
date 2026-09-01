# Reporte de estado — Proyecto Panchería

**Fecha:** 2026-08-31  
**Proyecto:** `pancheria`  
**Baseline:** `HEAD` — branch `main`  
**Histórico:** las fases previas quedan archivadas en `.devin/informes/archivados/reporte-estado-historico-2026-08-30.md`.

---

## 1. Resumen ejecutivo

El proyecto se encuentra en estado operativo. El build de producción, la verificación de tipos, los tests unitarios, el lint, Knip y el suite E2E pasan correctamente. La funcionalidad principal cubre ventas con pagos mixtos, pedidos con reservas de stock, chat con adjuntos, caja/cierre diario, panel de control, catálogo público, imágenes de productos/promos y videos con soporte de múltiples proveedores de almacenamiento.

La última auditoría documental depuró `README.md`, `AGENTS.md`, `.env.example`, `.devin/environment.yaml`, informes vigentes e índices, y archivó el prompt de mejoras de ventas (`auditoria-y-mejoras-ventas.md`) porque sus objetivos ya estaban implementados.

## 2. Stack y arquitectura

- Next.js `16.3.3` (App Router + Turbopack)
- React `19.2.8`
- TypeScript `5.x`
- Tailwind CSS `4`
- shadcn/ui
- Drizzle ORM `0.45.2`
- PostgreSQL (Neon / `pg`)
- NextAuth v5 (`5.0.0-beta.32`)
- Jest `30.x` (tests unitarios)
- Playwright `1.62.x` (tests E2E)
- Vercel (despliegue recomendado)

## 3. Estado funcional

- **Panel de control (`/`)**: resumen de caja, pedidos por estado, alertas de stock y accesos rápidos filtrados por rol.
- **Ventas (`/ventas`)**: terminal con productos, carrito, pagos mixtos (`cash` + `transfer`), historial y anulaciones.
- **Pedidos**: flujo `pending` → `in_process` → `paid` → `finished` / `cancelled`, con reservas de stock y chat integrado.
- **Productos/promos**: tipos `critical_supply`, `manual_supply`, `compound`, `service`; imágenes ilustrativas en catálogo público.
- **Stock y caja**: movimientos con razones, cierre automático, cierres diarios históricos.
- **Chat de pedidos**: texto e imágenes, paginación con cursores, polling y estados de entrega/lectura.
- **Almacenamiento**: `local`, `vercel-blob`, `s3` y `r2` para videos, adjuntos de chat e imágenes de productos.
- **Multi-sucursal**: aislamiento por `branchId`; admin puede operar sobre cualquier sucursal.

## 4. Verificaciones automáticas

| Comando | Resultado |
|---------|-----------|
| `npm run lint` | Pasa |
| `npx tsc --noEmit` | Pasa |
| `npm test` | 118 suites, 1131 tests pasan |
| `npm run build` | Build exitoso (44 páginas estáticas generadas) |
| `npm run knip` | Pasa |
| `npm run test:e2e` | **96 passed** en base descartable |

> **Nota:** E2E se ejecutó contra la base descartable configurada en `.env.e2e` (`neondb_e2e`). Ver `.devin/informes/entornos.md` para la configuración segura.

## 5. Hallazgos documentales recientes

| Hallazgo | Clasificación | Acción aplicada |
|----------|---------------|-----------------|
| `AGENTS.md` indicaba fallback `?content=` en chat que ya no existe | Mayor | Se corrigió: los handlers usan `request.json()` y no aceptan query params. |
| Prompt `auditoria-y-mejoras-ventas.md` seguía activo pese a estar resuelto | Mayor | Se archivó en `.devin/prompts/archivados/` y se actualizaron los índices. |
| Variables `NEXT_PUBLIC_PEDIDOS_REFRESH_INTERVAL_MS` y `PRODUCT_IMAGE_URL_MAX_LENGTH` documentadas de forma imprecisa | Menor | Se ajustó `.env.example` y se aclararon defaults/fallbacks. |
| Punto `16.` duplicado en `.devin/environment.yaml` | Menor | Se renumeró y se agregaron variables de ejecución. |
| `README.md` y `AGENTS.md` con `src/lib/` y comandos desactualizados | Menor | Se agregó `npm run knip` y se listaron módulos recientes. |
| Conteos de tests/rutas en `reporte-estado.md` desactualizados | Menor | Se actualizaron a 123 suites, 1163 tests y 44 páginas estáticas. |
| Nombres de variables en guía de funcionamiento incompletos | Menor | Se corrigieron `CAJA_AUTO_CLOSE_HOURS` y `CAJA_AUTO_CLOSED_BY`. |
| Tests E2E de caja fallaban por `clearSession` insuficiente y el test de rate limit devolvía `201` en lugar de `429` | Mayor | Se agregó `clearSession(page)` a `tests/e2e/helpers.ts`, se robusteció `loginAs` y se configuraron `E2E_ENABLE_RATE_LIMIT=true`, `PUBLIC_ORDER_RATE_LIMIT_ENABLE_IN_DEV=true`, `PUBLIC_ORDER_RATE_LIMIT_MAX_REQUESTS=2` y `TRUSTED_PROXY_IP_HEADER=X-Forwarded-For` en `.github/workflows/ci.yml` y `.env.e2e.example`. Suite E2E: 96 passed. |

## 6. Acciones pendientes recomendadas

| Recomendación | Prioridad | Razón |
|---------------|-----------|-------|
| Evaluar exponer `NEXT_PUBLIC_DASHBOARD_REFRESH_INTERVAL_MS` para evitar el intervalo hardcodeado de 30 s en `useDashboard.ts` | Menor | Reduce la necesidad de deploy para ajustar el refresco del panel. |
| Archivar o resumir fases 1-18 del `reporte-estado.md` previo (ya copiado a `archivados/`) | Menor | Mantiene el informe vigente conciso sin perder histórico. |
| Si avanza el modelo multi-tenant, actualizar `AGENTS.md`, `.env.example` y `.devin/environment.yaml` con variables y rutas del tenant | Futuro | El sistema actual es multi-sucursal, no multi-tenant. |

## 7. Enlaces relevantes

- `README.md` — punto de entrada del repositorio.
- `AGENTS.md` — reglas y convenciones para agentes.
- `.devin/README.md` — índice de `.devin/`.
- `.devin/prompts/README.md` — índice de prompts activos y archivados.
- `.devin/informes/entornos.md` — procedimientos de entornos y credenciales.
- `.devin/informes/guia-funcionamiento-pancheria.md` — conceptos de negocio y flujos.
- `.devin/informes/lecciones-aprendidas.md` — decisiones técnicas y regresiones evitadas.
- `.devin/informes/archivados/reporte-estado-historico-2026-08-30.md` — snapshot completo de fases anteriores.
