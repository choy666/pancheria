# Reporte de estado — Auditoría y depuración de documentación

**Fecha:** 2026-08-23
**Proyecto:** `pancheria`

---

## 1. Resumen ejecutivo

Se completó la auditoría integral de la documentación vigente y la implementación de las recomendaciones priorizadas. Se corrigieron discrepancias en la descripción del proxy/middleware, se alinearon redirecciones, se endureció la seguridad, se hicieron atómicos el rate limiting y la idempotencia, se estandarizó la validación de IDs y se instaló `knip` para detectar código muerto. Todos los comandos de verificación (lint, TypeScript, tests unitarios, build, `knip` y tests E2E) pasan con éxito.

## 2. Alcance verificado

| Área | Estado | Evidencia |
|------|--------|-----------|
| Stack y dependencias | Actualizado | `package.json`: Next.js 16.3.2, React 19.2.8, Drizzle ORM 0.45.2, Zod 4.4.3, Tailwind CSS v4. |
| Tests unitarios | Actualizado | 92 suites, 890 tests pasan. |
| Tests E2E | Corregido | 84 tests pasan con `npm run test:e2e` usando el servidor de desarrollo con `.env.e2e`. |
| Build de producción | Exitoso | 43 páginas, funciones serverless (`ƒ`). |
| Proxy/middleware de autenticación | Alineado | `src/proxy.ts` es el proxy activo de Next.js 16. `src/lib/route-guard.ts` redirige `/` sin sesión a `/login` y `/login` con sesión a `/`. Los layouts y página de login fueron ajustados para no contradecir al proxy. |
| Rate limiting | Atómico | `public-order-rate-limit-store.ts` usa `INSERT ... ON CONFLICT DO UPDATE` en DB y una sola operación en memoria. `rate-limit-store.ts` (login) usa `INSERT ... ON CONFLICT DO UPDATE` en DB y operaciones atómicas en memoria. |
| Idempotencia | Atómica | `saleService.ts` y `orderService.ts` verifican dentro de la transacción mediante `idempotencyService.findExistingByIdempotencyKey` e insertan con `ON CONFLICT DO NOTHING`. |
| Headers de seguridad | Añadidos | `next.config.ts` define `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `X-DNS-Prefetch-Control` y HSTS en producción. |
| Validación de IDs | Estandarizada | Los endpoints de pedidos y chat usan `parseId()` de `src/lib/id.ts`. |
| Cache de adjuntos | Reducido | `GET /api/chat/attachment/[key]` usa `max-age=86400, must-revalidate`. |
| Knip | Configurado | `knip` en `devDependencies`, script `npm run knip` y `knip.json` limpio. |

## 3. Hallazgos y acciones correctivas

| Gravedad | Hallazgo | Acción |
|----------|----------|--------|
| Mayor / Arquitectura | El proxy redirigía `/` sin sesión a `/pedido` mientras el layout lo hacía a `/login`. | Se cambió `src/lib/route-guard.ts` para redirigir a `/login`, se ajustaron `src/app/(panel)/layout.tsx` y `src/app/(auth)/login/page.tsx`, y se actualizó la documentación. |
| Medio / Seguridad | `POST /api/public/pedido/[id]/chat/leido` no tenía rate limit. | Se agregó `createRateLimiter` con scope `'chat'`, usando `getChatRateLimitWindowMs` y `getChatRateLimitMaxRequests`, y se responde `429` cuando se excede el límite. |
| Medio / Calidad | Los endpoints de chat aceptaban `?content=` como fallback. | Se eliminó el fallback de query param en los endpoints público y privado de chat y se actualizaron los tests. |
| Medio / Concurrencia | Rate limiting e idempotencia usaban `get` seguido de `set`. | Se reemplazaron por operaciones atómicas SQL (`INSERT ... ON CONFLICT DO UPDATE` / `DO NOTHING`) y métodos atómicos en memoria. |
| Medio / Seguridad | `next.config.ts` no definía headers de seguridad. | Se añadieron headers de seguridad compatibles con el catálogo, autenticación, Cast, uploads y recursos externos. |
| Bajo / Calidad | `knip` no estaba instalado. | Se instaló `knip`, se agregó el script y la configuración, y se limpiaron exports no usados. |
| Bajo / Calidad | Varios endpoints usaban `Number(id)` y `Number.isNaN` manualmente. | Se estandarizó el uso de `parseId()`. |
| Bajo / Seguridad | El cache de adjuntos de chat era de un año (`max-age=31536000, immutable`). | Se redujo a 24 horas con `must-revalidate` para evitar servir archivos eliminados durante un año. |
| Mayor / Tests E2E | `playwright.config.ts` levantaba `npm run dev` sin `.env.e2e` y esperaba solo `http://localhost:3000`; Turbopack devolvía HTML/404 mientras compilaba rutas API bajo demanda. | Se creó `scripts/dev-e2e.ts` con `dotenv` para `.env.e2e`, se agregó el script `dev:e2e`, se cambió el `webServer` a `npm run dev:e2e` y se apuntó la URL de espera a `/api/caja/resumen` para forzar compilación de una ruta API antes de iniciar tests. |
| Medio / Tests E2E | `tests/e2e/caja-cierre-vacios.spec.ts` usaba locators que coincidían parcialmente (`filter({ hasText: supply.name })`), fallando cuando existían productos como `Pan E2E` o `Pan sin auto`. | Se cambió el locator a `filter({ hasText: supply.name }).first()` dentro del listado de insumos críticos, y se agregó manejo defensivo en `tests/e2e/helpers.ts` para diagnosticar status y body cuando una respuesta no es JSON. |

## 4. Comandos ejecutados y resultados

| Paso | Comando | Resultado |
|------|---------|-----------|
| 1 | `npm run lint` | Pasa (exit 0) |
| 2 | `npx tsc --noEmit` | Pasa |
| 3 | `npm test` | 92 suites, 890 tests pasan |
| 4 | `npm run build` | Build de producción exitoso (43 páginas) |
| 5 | `npm run knip` | Sin problemas (exit 0) |
| 6 | `npm run test:e2e` | 84 tests E2E pasan |

## 5. Recomendaciones y pendientes

1. **Tests E2E.** Correr `npm run test:e2e` en una base de datos descartable para validar flujos críticos de pedidos, chat, cambio de sucursal y cierre de caja.
2. **Revisión de headers de seguridad.** Verificar en el despliegue real que el catálogo público, el upload de adjuntos, Google Cast y recursos externos no sean bloqueados.
3. **Knip en CI.** Agregar `npm run knip` al flujo de integración continua para detectar código muerto en cada PR.
4. **Auditoría periódica.** Repetir este proceso cada vez que cambie una variable de entorno, ruta o comportamiento arquitectónico.
5. **Mantener documentación sincronizada.** Con cada cambio, actualizar `AGENTS.md`, `README.md`, `.env.example`, `.devin/environment.yaml`, `guia-funcionamiento-pancheria.md`, `lecciones-aprendidas.md`, prompts y el reporte vigente.

## 6. Enlaces relevantes

- `.devin/informes/archivados/reporte-estado-2026-08-21.md` — informe anterior (2026-08-21).
- `.devin/informes/archivados/reporte-estado-2026-08-19.md` — informe anterior (2026-08-19).
- `.devin/informes/lecciones-aprendidas.md` — lecciones transversales.
- `.devin/informes/guia-funcionamiento-pancheria.md` — guía de negocio actualizada.
- `AGENTS.md` — notas para agentes.
- `README.md` — README del proyecto.
