# Reporte de estado — Sincronización de documentación del chat de pedidos

**Fecha:** 2026-08-21  
**Proyecto:** `pancheria`

---

## 1. Resumen ejecutivo

Se realizó una auditoría y sincronización de documentación centrada en el flujo de pedidos y chat, y una limpieza de código muerto detectado con `npx knip`. Se actualizaron `AGENTS.md`, `README.md`, `.env.example`, `.devin/environment.yaml`, `.devin/prompts/README.md`, `.devin/README.md`, `guia-funcionamiento-pancheria.md` y `reporte-estado.md`. El `plan-mitigacion-riesgos-chat-pedido.md` se archivó porque todas sus fases (A, B y C) están implementadas. Los comandos de verificación (`lint`, `tsc`, `test`, `build`) pasan sin errores. El informe anterior (2026-08-19) se archivó en `.devin/informes/archivados/reporte-estado-2026-08-19.md`.

## 2. Alcance verificado

| Área | Estado | Evidencia |
|------|--------|-----------|
| Stack y dependencias | Actualizado | `package.json`: Next.js 16.3.0, React 19.2.8, Drizzle ORM 0.45.2, Zod 4.4.3, Tailwind CSS v4. |
| Estructura del proyecto | Actualizada | `src/app/` con `(panel)`, `(public)`, `(auth)`; `src/config/` incluye chat, pedidos, rutas; `src/lib/` incluye `chat-storage`, `rate-limit`, `public-order-rate-limit-store`, `rate-limit-store`, `route-guard`, `branch-resolver`, `fetch`, `whatsapp`, `auth`, `db-errors` y helpers de dominio. |
| Chat de pedidos | Implementado | `order_messages` con `attachmentKey`; `GET /api/public/pedido/[id]/chat` devuelve `{ messages, status }`; `OrderChat` sincroniza `readOnly` desde el `status` y pausa el polling durante el envío (`isSendingRef`); `POST /api/public/pedido/[id]/chat/upload` soporta imágenes. |
| Flujo de pedidos | Vigente | `createOrder` valida disponibilidad pero **no reserva ni descuenta stock**; `convertOrderToSale` descuenta al confirmar; `cancelOrder` y `expirePendingOrders` no tocan stock; `PedidosList` hace polling y muestra `unreadCount`; `whatsappUrl` es fallback si `NEXT_PUBLIC_WHATSAPP_NUMBER` está configurado. |
| Multi-sucursal y autenticación | Funcional | `src/lib/route-guard.ts` maneja redirecciones (`/` → `/pedido` sin sesión, `/login` → `/` con sesión) y `src/proxy.ts` (middleware NextAuth) las ejecuta. Server Components del panel usan `getCurrentBranchIdOrRedirect`; rutas API y server actions usan `getCurrentBranchId` para devolver `403`. |
| Storage | Configurable | `src/lib/storage.ts` (videos) y `src/lib/chat-storage.ts` soportan `local`, `vercel-blob`, `s3` y `r2`. `LOCAL_STORAGE_PATH` es la ruta base; `CHAT_LOCAL_STORAGE_PATH` permite separar adjuntos de chat. |
| Limpieza de código | Parcial | `npx knip` redujo de 48 exports no usados a 14. Se eliminaron exports muertos en `saleService.ts`, `authService.ts`, `cashRegisterService.ts`, `chatService.ts`, `videoService.ts` (actions), `zod-schemas.ts`, `config/*`, `lib/storage.ts`, `lib/rate-limit-store.ts`, `lib/pagination.ts`, `lib/money.ts`, `lib/whatsapp.ts`, `lib/chat.ts`, `summaryService.ts` y `domain/types.ts`. Quedan sólo falsos positivos de `shadcn/ui` y el script `src/db/seeds.ts`. |
| Cron jobs | Configurados | `vercel.json` define `GET /api/cron/rate-limit-cleanup` y `GET /api/cron/chat-attachments-cleanup`, ambos protegidos por `CRON_SECRET`. |
| Variables de entorno | Sincronizadas | `.env.example`, `AGENTS.md`, `README.md`, `.devin/environment.yaml` y `guia-funcionamiento-pancheria.md` cubren las variables de catálogo, pedidos, chat, videos, caja y rate limit. Se agregó `NEXT_PUBLIC_API_TIMEOUT_MS` y se corrigió el default de `PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER`. |

## 3. Hallazgos y acciones correctivas

| Gravedad | Hallazgo | Acción |
|----------|----------|--------|
| Menor / Documentación | `README.md` no documentaba el chat de pedidos, el polling del listado, la limpieza de adjuntos, los cron jobs ni todas las variables de entorno relacionadas. | Reescritas las secciones de **Catálogo público, pedidos y chat**, **Videos**, **Cron jobs** y **Notas**. |
| Menor / Documentación | `AGENTS.md`: faltaba `NEXT_PUBLIC_API_TIMEOUT_MS`; la descripción de `PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER` decía `memory` por defecto; la sección de chat no detallaba `status`, `unreadCount`, carrera de envío/polling, `attachmentKey` ni cleanup; el troubleshooting seguía mencionando un redirect estático en `next.config.ts`. | Se agregó la variable, se corrigió el default del rate limit store, se amplió la sección de chat y se actualizó el troubleshooting a `src/lib/route-guard.ts` + `src/proxy.ts`. |
| Menor / Documentación | `.env.example` indicaba que `PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER` tenía default `memory`. | Se corrigió el comentario: en producción con `DATABASE_URL`/`POSTGRES_URL` definidas el default es `db`; `memory` en desarrollo/test. |
| Menor / Documentación | `.devin/prompts/README.md` listaba `chat-pedido-opcion-a.md` como activo (está en `archivados/`) y no incluía `plan-mitigacion-riesgos-chat-pedido.md`. | Se actualizaron activos y archivados. |
| Menor / Documentación | `.devin/environment.yaml` tenía numeración rota en `database`, faltaban variables de chat/pedidos y describía el flujo como "enviar pedido por WhatsApp". | Se reescribieron los conocimientos `database`, `pedidos`, `videos` y `deploy`. |
| Menor / Documentación | `.devin/README.md` no reflejaba todos los prompts e informes actuales. | Se actualizó el árbol de `prompts/`. |
| Menor / Documentación | `guia-funcionamiento-pancheria.md` describía a WhatsApp como canal principal, omitía el chat y tenía el default de rate limit incorrecto. | Se actualizaron las secciones 7.1, 7.2, 7.3, 13 y 14. |
| Menor / Documentación | Informe anterior (2026-08-19) indicaba que `next.config.ts` redirige `/` a `/pedido`; actualmente la redirección la realiza `src/lib/route-guard.ts` en el middleware de NextAuth (`src/proxy.ts`). | Se corrigió en este informe y en `AGENTS.md` / `README.md`. |
| Menor / Documentación | `plan-mitigacion-riesgos-chat-pedido.md` seguía activo pese a que todas sus fases estaban implementadas. | Se archivó en `.devin/prompts/archivados/` y se actualizaron los índices de prompts. |
| Menor | `npx knip` reportaba 48 exports y 1 archivo sin usar, la mayoría falsos positivos de `shadcn/ui` y exports de constantes internas. | Se eliminaron 34 exports/archivos muertos reales y se dejaron los falsos positivos. |

## 4. Comandos ejecutados y resultados

| Paso | Comando | Resultado |
|------|---------|-----------|
| 1 | `npm run lint` | Pasa (exit 0) |
| 2 | `npx tsc --noEmit` | Pasa |
| 3 | `npm test` | 86 suites, 841 tests pasan |
| 4 | `npm run build` | Build de producción exitoso (41 páginas) |
| 5 | `npx knip` | Inicialmente 48 exports no usados; tras la limpieza quedan 14 falsos positivos de `shadcn/ui` y el script `src/db/seeds.ts`. |

## 5. Recomendaciones y pendientes

1. **~~Archivar el plan de mitigación~~** (hecho). `plan-mitigacion-riesgos-chat-pedido.md` se movió a `.devin/prompts/archivados/` y se actualizaron `.devin/prompts/README.md` y `.devin/README.md`.
2. **Tests E2E del flujo de pedidos y chat.** Correr `npm run test:e2e` en una base de datos descartable para validar el flujo completo de creación de pedido, chat con adjuntos, confirmación desde el panel y expiración.
3. **Verificar el blueprint de Devin.** Ejecutar `devin.exe cloud drs build` con `.devin/environment.yaml` para confirmar que el snapshot se genera correctamente tras los cambios.
4. **Rate limit en producción.** Configurar `PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER=db` y `RATE_LIMIT_STORE_PROVIDER=db` en Vercel si se escala horizontalmente.
5. **Configuración de producción.** Completar variables en Vercel (`NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXTAUTH_URL`/`AUTH_URL`, `NEXTAUTH_SECRET`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `STORAGE_PROVIDER`, `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`, etc.), ejecutar `npx drizzle-kit push` y `npx tsx src/db/seeds.ts`.
6. **Auditoría periódica con `npx knip`.** Ejecutar periódicamente para detectar código muerto real; los restantes 14 exports son falsos positivos de `shadcn/ui` y el script `src/db/seeds.ts` (usado por `npx tsx` y E2E).
7. **Mantener la documentación sincronizada.** Con cada nueva feature, variable de entorno o cambio arquitectónico, actualizar `AGENTS.md`, `README.md`, `.env.example`, `.devin/environment.yaml`, `guia-funcionamiento-pancheria.md` y el reporte vigente.

## 6. Enlaces relevantes

- `.devin/informes/archivados/reporte-estado-2026-08-19.md` — informe anterior (2026-08-19).
- `.devin/informes/archivados/reporte-estado-historico-2026-08-19.md` — reportes históricos anteriores.
- `.devin/prompts/archivados/plan-mitigacion-riesgos-chat-pedido.md` — plan cuyas fases están implementadas.
- `.devin/prompts/cobertura-auditoria-flujo-pedidos.md` — cobertura del flujo de pedidos.
- `.devin/informes/lecciones-aprendidas.md` — lecciones transversales.
- `.devin/informes/guia-funcionamiento-pancheria.md` — guía de negocio actualizada.
- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" /> — notas para agentes.
- <ref_file file="C:/developer/paginas/pancheria/README.md" /> — README del proyecto.
