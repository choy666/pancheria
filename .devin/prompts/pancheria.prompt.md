# Prompt maestro — Proyecto Panchería

## Contexto

Proyecto: `panchería` — Sistema de gestión de stock, ventas, productos, recetas, caja, cierre diario y multi-sucursal.

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM 0.45.2 con PostgreSQL (Neon), NextAuth v5, Jest, Playwright.

Arquitectura: <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />, <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />.

Documentación de referencia obligatoria:
- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-estado.md" />
- <ref_file file="C:/developer/paginas/pancheria/.env.example" />

## Reglas de oro

1. Idioma español en todo: explicaciones, comentarios y documentación.
2. Nunca hardcodear credenciales, URLs de API, secretos ni parámetros sensibles. Todo viene de variables de entorno o configuraciones dinámicas.
3. Antes de tocar código, leer `AGENTS.md` y `.devin/informes/lecciones-aprendidas.md`.
4. Server actions con `useActionState` devuelven `{ error: string } | null` para errores controlados; no lanzar `throw`.
5. `NotFoundError` → 404; `DomainError` genérico → 400.
6. Soft delete: validar que el registro padre no esté eliminado; cuidado con `findFirst` sin orden entre activos/inactivos.
7. Hooks asíncronos deben usar `cancelled` o `isMountedRef` para no llamar `setState` tras desmontaje.
8. Tests E2E (`npm run test:e2e`) y seed (`npx tsx src/db/seeds.ts`) truncan/modifican la base; solo con confirmación explícita del usuario y en base de prueba.
9. `DATABASE_URL` debe apuntar a la misma base de Neon en dev y prod. No usar `localhost` sin PostgreSQL local.
10. No exponer `.env.local`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `NEXTAUTH_SECRET` ni URLs de base de datos en prompts, documentos o reportes.

## Verificaciones antes de declarar terminada una tarea

| Paso | Comando | Propósito |
| ---- | ------- | --------- |
| 1 | `npm run lint` | Estilo y calidad |
| 2 | `npx tsc --noEmit` | Verificación de tipos |
| 3 | `npm test` | Tests unitarios |
| 4 | `npm run build` | Build de producción |
| 5 | `npx drizzle-kit check` | Consistencia del esquema (con base de prueba) |
| 6 | `npm run test:e2e` | Tests E2E (solo con confirmación / base de prueba) |

## Tareas pendientes identificadas

- **Catálogo público y pedidos por WhatsApp (`/pedido`)** — resuelto. Ver <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/archivados/catalogo-whatsapp.md" /> para contexto histórico.
- **Sincronizar stock de pedidos públicos con reserva transaccional** — resuelto. Ver <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/archivados/pedido-stock-centralizado.md" /> para contexto histórico.
- Considerar expiración automática de pedidos `pending` (fase 8 del prompt archivado).
- Migrar `RateLimitStore` a base de datos compartida si se escala horizontalmente.
- Monitorear logs del endpoint `/api/videos/[id]/stream` en producción.
- Confirmar variables de producción (`NEXTAUTH_URL`, `DATABASE_URL`) en Vercel.

## Instrucciones de trabajo

1. Leer `AGENTS.md` y `.devin/informes/lecciones-aprendidas.md`.
2. Confirmar el estado actual del código con búsquedas antes de asumir que algo existe.
3. Si la tarea es una auditoría o actualización de documentación, seguir <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/auditoria-y-documentacion.md" />.
4. Los prompts de catálogo y pedidos con reserva transaccional están resueltos y archivados. Antes de retomarlos, verificar su contexto en `archivados/`.
5. Antes de terminar, ejecutar las verificaciones de la tabla y documentar discrepancias en un informe `.devin/informes/reporte-estado-YYYY-MM-DD.md` cuando corresponda.
