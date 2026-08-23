# Reporte de estado — Auditoría y depuración de documentación

**Fecha:** 2026-08-23  
**Proyecto:** `pancheria`

---

## 1. Resumen ejecutivo

Se realizó una auditoría integral de toda la documentación vigente y se profundizó en la arquitectura, autenticación, calidad y seguridad. Se encontraron discrepancias en la descripción del proxy/middleware, versiones del stack, valores por defecto de variables de entorno y el flujo de pedidos. El hallazgo más relevante fue que `src/proxy.ts` sí es el proxy/middleware activo de Next.js 16 (renombrado desde `middleware.ts`), pero la documentación lo consideraba inactivo y las redirecciones están duplicadas con `src/app/(panel)/layout.tsx` y `src/app/(auth)/login/page.tsx`. Se corrigieron los archivos documentales, se actualizaron los conteos de tests y se completó el build, lint, verificación de tipos y tests unitarios. El informe anterior (2026-08-21) se archivó en `.devin/informes/archivados/reporte-estado-2026-08-21.md`.

## 2. Alcance verificado

| Área | Estado | Evidencia |
|------|--------|-----------|
| Stack y dependencias | Actualizado | `package.json`: Next.js 16.3.2, React 19.2.8, Drizzle ORM 0.45.2, Zod 4.4.3, Tailwind CSS v4. |
| Tests unitarios | Actualizado | 92 suites, 892 tests pasan. |
| Build de producción | Exitoso | 43 páginas, funciones serverless (`ƒ`). |
| Variables de entorno | Parcialmente sincronizado | `.env.example` faltaba la entrada para `NEXT_PUBLIC_VIDEO_MAX_SIZE_MB` consistente con el default de `src/config/videos.ts`; corregido. Faltan `NEXT_PUBLIC_CHAT_PAGE_SIZE` en `README.md` y `.devin/environment.yaml`; añadido. |
| Proxy/middleware de autenticación | Lógica duplicada | `src/proxy.ts` es el proxy de Next.js 16 (renombrado desde `middleware.ts`) y el build lo detecta como `ƒ Proxy (Middleware)`. `src/lib/route-guard.ts` se ejecuta desde `src/auth.config.ts` en el proxy. Las redirecciones están duplicadas en `src/app/(panel)/layout.tsx` y `src/app/(auth)/login/page.tsx`. Se corrigió la documentación y se recomienda alinear los destinos. |
| Flujo de pedidos | Documentación parcialmente obsoleta | `guia-funcionamiento-pancheria.md` seguía describiendo WhatsApp como canal principal. Se corrigió para reflejar el catálogo `/pedido` y el chat como canal principal, con WhatsApp como fallback. |

## 3. Hallazgos y acciones correctivas

| Gravedad | Hallazgo | Acción |
|----------|----------|--------|
| Mayor / Arquitectura | `AGENTS.md`, `README.md` y `reporte-estado.md` anteriores afirmaban (erróneamente) que `src/proxy.ts` no era middleware. Next.js 16 renombró `middleware.ts` a `proxy.ts` y `src/proxy.ts` es reconocido por el build como `ƒ Proxy (Middleware)`. Sin embargo, las redirecciones están duplicadas: el proxy redirige `/` sin sesión a `/pedido`, mientras que `src/app/(panel)/layout.tsx` redirige `/` sin sesión a `/login`. | Se corrigió la documentación para reflejar que `src/proxy.ts` sí es el proxy/middleware activo, que `src/lib/route-guard.ts` se ejecuta desde `src/auth.config.ts` y que las redirecciones defensivas de `layout.tsx` y `login/page.tsx` deben alinearse o eliminarse. |
| Menor / Documentación | `package.json` indica Next.js 16.3.2, pero `reporte-estado.md`, `pancheria.prompt.md`, `auditoria-y-documentacion.md` y `auditoria-chat-workaround-y-mejoras.md` indicaban 16.3.0. | Se actualizaron a 16.3.2 en todos los prompts e informes. |
| Menor / Documentación | `.env.example` dejaba `NEXT_PUBLIC_VIDEO_MAX_SIZE_MB=250` descomentado, mientras que `src/config/videos.ts` y la documentación indican un default de 100 MB. | Se cambió `.env.example` a `# NEXT_PUBLIC_VIDEO_MAX_SIZE_MB=100` (comentado y consistente). |
| Menor / Configuración | `.env.example` descomentaba `STORAGE_PROVIDER=vercel-blob` y `BLOB_READ_WRITE_TOKEN=` vacío, lo que haría fallar el almacenamiento local en desarrollo si no se configura el token. | Se comentaron ambas entradas para que el default sea `local` (como indica `src/config/videos.ts`). |
| Menor / Documentación | `AGENTS.md`, `README.md`, `.devin/environment.yaml` y `guia-funcionamiento-pancheria.md` no documentaban `NEXT_PUBLIC_CHAT_PAGE_SIZE`; `README.md` y `guia-funcionamiento-pancheria.md` tampoco mencionaban `NEXT_PUBLIC_API_TIMEOUT_MS`. | Se añadieron ambas variables a `AGENTS.md`, `README.md`, `.devin/environment.yaml` y a la tabla de configuración de `guia-funcionamiento-pancheria.md`. |
| Menor / Documentación | `guia-funcionamiento-pancheria.md` sección 15.3 y conclusión describían pedidos "por WhatsApp" como flujo principal. | Se reescribieron para describir el catálogo `/pedido` y el chat como canal principal, con WhatsApp como fallback. |
| Medio / Seguridad (recomendación) | `POST /api/public/pedido/[id]/chat/leido` modifica el estado de mensajes y no tiene rate limit. | Agregar `createRateLimiter` con el scope del chat, igual que los `POST` de mensajes. |
| Medio / Calidad (recomendación) | Los `POST` de chat mantienen un fallback `?content=` heredado de un bug de Next.js 16.3.0/Turbopack, ya resuelto en 16.3.2. | Verificar que E2E y el cliente envíen JSON body, luego eliminar el fallback. |
| Medio / Concurrencia (recomendación) | `InMemoryPublicOrderRateLimitStore`/`DbPublicOrderRateLimitStore` y `isIdempotencyKeyUsed` usan `get` seguido de `set`, lo que produce condiciones de carrera. | Implementar incremento atómico en la base de datos o `SELECT FOR UPDATE` dentro de la transacción. |
| Medio / Seguridad (recomendación) | `next.config.ts` no define headers de seguridad. | Evaluar agregar `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` y HSTS. |
| Bajo / Calidad (recomendación) | `knip` no está instalado como dependencia. | Agregarlo a `devDependencies` y al script `"knip": "knip"` para detectar código muerto en CI. |
| Informativo | `reporte-estado.md` anterior reportaba 86 suites / 841 tests; la base actual tiene 92 suites / 892 tests. | Se actualizaron los conteos en el nuevo informe. |

## 4. Comandos ejecutados y resultados

| Paso | Comando | Resultado |
|------|---------|-----------|
| 1 | `npm run lint` | Pasa (exit 0) |
| 2 | `npx tsc --noEmit` | Pasa |
| 3 | `npm test` | 92 suites, 892 tests pasan |
| 4 | `npm run build` | Build de producción exitoso (43 páginas) |

## 5. Recomendaciones y pendientes

1. **Alinear proxy/middleware con layouts.** `src/proxy.ts` es el proxy/middleware activo de Next.js 16 y `src/lib/route-guard.ts` redirige `/` sin sesión a `/pedido`. Decidir si ese es el destino correcto; si `/` debe ser el panel, cambiar `route-guard.ts:46-48` a `/login`. Una vez definido, eliminar o documentar las redirecciones defensivas en `src/app/(panel)/layout.tsx` y `src/app/(auth)/login/page.tsx`.
2. **Rate limit faltante.** Agregar rate limit a `POST /api/public/pedido/[id]/chat/leido`.
3. **Eliminar fallback `?content=` del chat.** Verificar que tests E2E y el cliente envíen JSON body, luego eliminar el fallback de query param en `src/app/api/public/pedido/[id]/chat/route.ts` y `src/app/api/pedidos/[id]/chat/route.ts`.
4. **Corregir condiciones de carrera.** Hacer atómico el rate limit y la idempotencia (`get`+`set`) con incremento atómico o `SELECT FOR UPDATE`.
5. **Headers de seguridad.** Evaluar agregar headers de seguridad en `next.config.ts`.
6. **Instalar `knip`.** Agregar `knip` a `devDependencies` y un script para detectar código muerto.
7. **Tests E2E.** Correr `npm run test:e2e` en base de datos descartable para validar flujos críticos de pedidos, chat, cambio de sucursal y cierre de caja.
8. **Auditoría periódica.** Repetir este proceso cada vez que cambie una variable de entorno, ruta o comportamiento arquitectónico.
9. **Mantener documentación sincronizada.** Con cada cambio, actualizar `AGENTS.md`, `README.md`, `.env.example`, `.devin/environment.yaml`, `guia-funcionamiento-pancheria.md`, `lecciones-aprendidas.md`, prompts y reporte vigente.

## 6. Enlaces relevantes

- `.devin/informes/archivados/reporte-estado-2026-08-21.md` — informe anterior (2026-08-21).
- `.devin/informes/archivados/reporte-estado-2026-08-19.md` — informe anterior (2026-08-19).
- `.devin/informes/lecciones-aprendidas.md` — lecciones transversales.
- `.devin/informes/guia-funcionamiento-pancheria.md` — guía de negocio actualizada.
- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" /> — notas para agentes.
- <ref_file file="C:/developer/paginas/pancheria/README.md" /> — README del proyecto.
