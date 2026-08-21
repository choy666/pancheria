# Reporte de estado — Auditoría y sincronización de documentación

**Fecha:** 2026-08-19  
**Proyecto:** `pancheria`

---

## 1. Resumen ejecutivo

Se realizó una auditoría de la documentación del proyecto (`README.md`, `AGENTS.md`, `.env.example`, `.devin/environment.yaml`, prompts e informes) comparándola con el estado real del código. Los comandos de verificación (`lint`, `tsc`, `test`, `build`) pasan sin errores. Se detectaron y corrigieron inconsistencias documentales; los informes históricos se archivaron, los prompts resueltos se movieron a `prompts/archivados/`, se tipó `src/lib/storage.ts` y se limpió código muerto detectado por `knip`.

## 2. Alcance verificado

| Área | Estado | Evidencia |
|------|--------|-----------|
| Stack y dependencias | Actualizado | `package.json`: Next.js 16.3.0, React 19.2.8, Drizzle ORM 0.45.2, Zod 4.4.3, Tailwind CSS v4. |
| Estructura del proyecto | Actualizada | `src/app/`, `src/application/`, `src/repositories/`, `src/db/`, `src/components/`, `src/config/`, `src/domain/`, `src/hooks/`, `src/lib/`. |
| Esquema de base de datos | Sincronizado | `src/db/schema.ts` incluye `branches`, `users`, `products`, `recipes`, `sales`, `sale_items`, `orders`, `order_items`, `stock_movements`, `cash_registers`, `daily_closures`, `videos`, `login_attempts`, `public_order_rate_limits`. |
| Flujo de pedidos | Vigente | `createOrder` no descuenta stock; `convertOrderToSale` descuenta al confirmar; `cancelOrder` y `expirePendingOrders` no tocan stock. No quedan referencias a `sentAt` ni a `POST /api/public/pedido/[id]/enviar`. |
| Multi-sucursal y autenticación | Funcional | Todos los Server Components del panel usan `getCurrentBranchIdOrRedirect`. Las server actions y rutas API usan `getCurrentBranchId` para devolver `403`. |
| Videos y almacenamiento | Configurable | `src/lib/storage.ts` soporta `local`, `vercel-blob`, `s3`, `r2`; los imports dinámicos de S3/R2 están tipados. |
| Variables de entorno | Revisadas | `.env.example`, `AGENTS.md` y `.devin/environment.yaml` cubren las variables consumidas por el código. Se agregó `AUTH_URL` a `.env.example`. |
| Ruta raíz | Resuelto | `next.config.ts` redirige `/` a `/pedido`.
| Limpieza de knip | Parcial | Se eliminaron `isAllowedVideoMimeType` (no usada) y `ensureExists` (no usada). El resto de los "unused exports" reportados por knip son falsos positivos (componentes shadcn, helpers usados localmente, exports condicionales). |

## 3. Hallazgos y acciones correctivas

| Gravedad | Hallazgo | Acción |
|----------|----------|--------|
| Menor / Documentación | `.devin/prompts/errores-deploy-vercel-forbidden-react-441.md` seguía listado como activo aunque el problema estaba resuelto. | Se archivó el prompt y se actualizó `.devin/prompts/README.md`. |
| Menor / Documentación | `.devin/prompts/README.md` referenciaba `archivados/auditoria-deploy-pancheria-five.md`, que no existía. | Se eliminó la referencia inexistente; el contexto histórico del deploy queda en el informe archivado. |
| Menor / Documentación | `.devin/environment.yaml` tenía la numeración del knowledge `database` salteada (faltaba el punto 13). | Se corrigió la numeración. |
| Menor / Documentación | `.env.example` no incluía `AUTH_URL`, aunque `AGENTS.md` y `.env.e2e` la usan. | Se agregó `AUTH_URL` comentada en `.env.example`. |
| Menor / Documentación | `reporte-estado.md` acumulaba múltiples informes históricos, contraviniendo la regla de un único informe vigente. | Se creó `.devin/informes/archivados/reporte-estado-historico-2026-08-19.md` con el contenido histórico y se reescribió `reporte-estado.md` con el informe vigente. |
| Menor | No existe `src/app/page.tsx` ni un redirect de `/` a `/pedido` en `next.config.ts` o `middleware.ts`. | **Resuelto** — se agregó el redirect en `next.config.ts` y se actualizaron `README.md` y `AGENTS.md`. |
| Menor | `tests/e2e/global-setup.ts` no trunca `public_order_rate_limits`. | **Resuelto** — se agregó `public_order_rate_limits` al `TRUNCATE` y se actualizaron `AGENTS.md` y `.devin/environment.yaml`. |
| Menor | `src/lib/storage.ts` usaba `any` para los clientes S3/R2 importados dinámicamente. | **Resuelto** — se tiparon con `import type { S3Client }` y `import type { createPresignedPost }`. |
| Menor | `knip` reportó `isAllowedVideoMimeType` y `ensureExists` como no usados. | **Resuelto** — se eliminaron ambas funciones. |

## 4. Comandos ejecutados y resultados

| Paso | Comando | Resultado |
|------|---------|-----------|
| 1 | `npm run lint` | Pasa (exit 0) |
| 2 | `npx tsc --noEmit` | Pasa |
| 3 | `npm test` | 75 suites, 790 tests pasan |
| 4 | `npm run build` | Build de producción exitoso (40 páginas) |
| 5 | `npx knip` | Reporta falsos positivos de shadcn y exports condicionales; se limpió código muerto real. |

## 5. Recomendaciones

1. **Configuración de producción.** Completar variables en Vercel (`NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `STORAGE_PROVIDER`, `BLOB_READ_WRITE_TOKEN`, etc.), ejecutar `npx drizzle-kit push` y `npx tsx src/db/seeds.ts` en producción.
2. **Rate limit distribuido.** Configurar `PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER=db` y `RATE_LIMIT_STORE_PROVIDER=db` en Vercel si se escala horizontalmente.
3. **Verificar el blueprint de Devin.** Ejecutar `devin.exe cloud drs build` con `.devin/environment.yaml` para confirmar que el snapshot se genera correctamente.
4. **Tests E2E.** Correr `npm run test:e2e` en una base de datos descartable para detectar regresiones.
5. **Mantener la documentación sincronizada.** Con cada nueva feature, variable de entorno o cambio arquitectónico, actualizar `AGENTS.md`, `README.md`, `.env.example` y `.devin/environment.yaml`.
6. **Auditoría periódica con `npx knip`.** Revisar periódicamente para descartar falsos positivos y detectar código muerto real.

## 6. Enlaces relevantes

- `.devin/informes/archivados/reporte-estado-historico-2026-08-19.md` — informes anteriores.
- `.devin/prompts/archivados/errores-deploy-vercel-forbidden-react-441.md` — prompt resuelto.
- `.devin/prompts/cobertura-auditoria-flujo-pedidos.md` — flujo de pedidos vigente.
- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" /> — notas para agentes.
