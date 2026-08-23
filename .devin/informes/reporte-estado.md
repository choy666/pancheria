# Reporte de estado — Auditoría y depuración de documentación

**Fecha:** 2026-08-23  
**Proyecto:** `pancheria`

---

## 1. Resumen ejecutivo

Se realizó una auditoría integral de toda la documentación vigente: `AGENTS.md`, `README.md`, `.env.example`, `.devin/environment.yaml`, `.devin/prompts/*.md`, `.devin/informes/guia-funcionamiento-pancheria.md` y el presente informe. Se encontró la documentación mayormente alineada, con discrepancias en la descripción del middleware de autenticación, versiones del stack, valores por defecto de variables de entorno y el flujo de pedidos. Se corrigieron los archivos documentales y se actualizaron los conteos de tests. El build, lint, verificación de tipos y tests unitarios pasan. El informe anterior (2026-08-21) se archivó en `.devin/informes/archivados/reporte-estado-2026-08-21.md`.

## 2. Alcance verificado

| Área | Estado | Evidencia |
|------|--------|-----------|
| Stack y dependencias | Actualizado | `package.json`: Next.js 16.3.2, React 19.2.8, Drizzle ORM 0.45.2, Zod 4.4.3, Tailwind CSS v4. |
| Tests unitarios | Actualizado | 92 suites, 892 tests pasan. |
| Build de producción | Exitoso | 43 páginas, funciones serverless (`ƒ`). |
| Variables de entorno | Parcialmente sincronizado | `.env.example` faltaba la entrada para `NEXT_PUBLIC_VIDEO_MAX_SIZE_MB` consistente con el default de `src/config/videos.ts`; corregido. Faltan `NEXT_PUBLIC_CHAT_PAGE_SIZE` en `README.md` y `.devin/environment.yaml`; añadido. |
| Middleware de autenticación | Documentación obsoleta | `src/proxy.ts` no es reconocido por Next.js como middleware. Las redirecciones actuales se implementan en `src/app/(panel)/layout.tsx` y `src/app/(auth)/login/page.tsx`. Se corrigió `AGENTS.md` y `README.md`. |
| Flujo de pedidos | Documentación parcialmente obsoleta | `guia-funcionamiento-pancheria.md` seguía describiendo WhatsApp como canal principal. Se corrigió para reflejar el catálogo `/pedido` y el chat como canal principal, con WhatsApp como fallback. |

## 3. Hallazgos y acciones correctivas

| Gravedad | Hallazgo | Acción |
|----------|----------|--------|
| Mayor / Documentación | `AGENTS.md`, `README.md` y `reporte-estado.md` anteriores afirmaban que `src/proxy.ts` era el middleware NextAuth que ejecutaba `src/lib/route-guard.ts`. `src/proxy.ts` no se importa ni es reconocido por Next.js como middleware (`src/middleware.ts` o `middleware.ts`). | Se reescribieron las secciones de autenticación/redirecciones en `AGENTS.md` (Troubleshooting) y `README.md` (Notas) para indicar que las redirecciones actuales se hacen en `src/app/(panel)/layout.tsx` y `src/app/(auth)/login/page.tsx`, y se documentó la opción de crear `src/middleware.ts`. |
| Menor / Documentación | `package.json` indica Next.js 16.3.2, pero `reporte-estado.md`, `pancheria.prompt.md`, `auditoria-y-documentacion.md` y `auditoria-chat-workaround-y-mejoras.md` indicaban 16.3.0. | Se actualizaron a 16.3.2 en todos los prompts e informes. |
| Menor / Documentación | `.env.example` dejaba `NEXT_PUBLIC_VIDEO_MAX_SIZE_MB=250` descomentado, mientras que `src/config/videos.ts` y la documentación indican un default de 100 MB. | Se cambió `.env.example` a `# NEXT_PUBLIC_VIDEO_MAX_SIZE_MB=100` (comentado y consistente). |
| Menor / Configuración | `.env.example` descomentaba `STORAGE_PROVIDER=vercel-blob` y `BLOB_READ_WRITE_TOKEN=` vacío, lo que haría fallar el almacenamiento local en desarrollo si no se configura el token. | Se comentaron ambas entradas para que el default sea `local` (como indica `src/config/videos.ts`). |
| Menor / Documentación | `AGENTS.md`, `README.md`, `.devin/environment.yaml` y `guia-funcionamiento-pancheria.md` no documentaban `NEXT_PUBLIC_CHAT_PAGE_SIZE`; `README.md` y `guia-funcionamiento-pancheria.md` tampoco mencionaban `NEXT_PUBLIC_API_TIMEOUT_MS`. | Se añadieron ambas variables a `AGENTS.md`, `README.md`, `.devin/environment.yaml` y a la tabla de configuración de `guia-funcionamiento-pancheria.md`. |
| Menor / Documentación | `guia-funcionamiento-pancheria.md` sección 15.3 y conclusión describían pedidos "por WhatsApp" como flujo principal. | Se reescribieron para describir el catálogo `/pedido` y el chat como canal principal, con WhatsApp como fallback. |
| Informativo | `reporte-estado.md` anterior reportaba 86 suites / 841 tests; la base actual tiene 92 suites / 892 tests. | Se actualizaron los conteos en el nuevo informe. |

## 4. Comandos ejecutados y resultados

| Paso | Comando | Resultado |
|------|---------|-----------|
| 1 | `npm run lint` | Pasa (exit 0) |
| 2 | `npx tsc --noEmit` | Pasa |
| 3 | `npm test` | 92 suites, 892 tests pasan |
| 4 | `npm run build` | Build de producción exitoso (43 páginas) |

## 5. Recomendaciones y pendientes

1. **Middleware de autenticación.** Decidir si se crea `src/middleware.ts` que exporte `auth` desde `src/auth.ts` para activar `src/lib/route-guard.ts`, o si se elimina `src/proxy.ts` y `src/lib/route-guard.ts` si no se usarán. Actualmente las redirecciones están en los Server Components y no hay middleware.
2. **Verificar `NEXT_PUBLIC_VIDEO_MAX_SIZE_MB` en producción.** Asegurarse de que el valor en Vercel sea intencional (100 MB por defecto; comentar/descomentar en `.env.example` para ajustarlo).
3. **Tests E2E.** Correr `npm run test:e2e` en base de datos descartable para validar flujos críticos de pedidos, chat, cambio de sucursal y cierre de caja.
4. **Auditoría periódica.** Repetir este proceso cada vez que cambie una variable de entorno, ruta o comportamiento arquitectónico.
5. **Mantener documentación sincronizada.** Con cada cambio, actualizar `AGENTS.md`, `README.md`, `.env.example`, `.devin/environment.yaml`, `guia-funcionamiento-pancheria.md`, prompts y reporte vigente.

## 6. Enlaces relevantes

- `.devin/informes/archivados/reporte-estado-2026-08-21.md` — informe anterior (2026-08-21).
- `.devin/informes/archivados/reporte-estado-2026-08-19.md` — informe anterior (2026-08-19).
- `.devin/informes/lecciones-aprendidas.md` — lecciones transversales.
- `.devin/informes/guia-funcionamiento-pancheria.md` — guía de negocio actualizada.
- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" /> — notas para agentes.
- <ref_file file="C:/developer/paginas/pancheria/README.md" /> — README del proyecto.
