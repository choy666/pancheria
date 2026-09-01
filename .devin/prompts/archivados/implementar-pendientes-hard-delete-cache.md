# Prompt: cerrar pendientes de hard delete, papelera y limpieza de cachés

> **Estado:** resuelto y archivado.  
> **Resolución:** se implementaron `productService.permanentlyDeleteProduct`, `videoService.permanentlyDeleteVideo`, las páginas `/productos/eliminados` y `/videos/eliminados`, el diálogo de confirmación en `VideoList`, el renombre a `deletedProducts` y la limpieza del código muerto `deleteByCompoundProductId`. Se corrigió el entorno de E2E y la suite pasa con 98 tests. Se agregó `remove` a `RateLimitStore`, se expuso `getRateLimitStore()` como singleton y se limpian entradas expiradas en `InMemoryPublicOrderRateLimitStore`. El plan de implementación quedó archivado en `.devin/informes/archivados/plan-limpieza-hard-delete-cache-2026-09-01.md` y el estado final se reflejó en `.devin/informes/reporte-estado.md` y `.devin/informes/lecciones-aprendidas.md`.

## Contexto

Proyecto `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja, pedidos, videos y multi-sucursal.

Stack: Next.js 16.3.3 (App Router + Turbopack), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM con PostgreSQL (Neon), NextAuth v5, Jest, Playwright.

Documentación de referencia obligatoria:
- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/archivados/plan-limpieza-hard-delete-cache-2026-09-01.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-estado.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/entornos.md" />

## Estado actual relevante

La implementación principal de hard delete individual y limpieza de cachés ya está en el código: <ref_file file="C:/developer/paginas/pancheria/.devin/informes/archivados/plan-limpieza-hard-delete-cache-2026-09-01.md" /> describe el alcance. Las validaciones estáticas (`tsc`, `lint`, `npm test`, `npm run build`, `npm run knip`) pasan, pero `npm run test:e2e` aún no termina exitosamente y quedan detalles de UX y código muerto por pulir.

## Objetivo

1. Corregir el entorno/login de E2E para que `npm run test:e2e` ejecute los tests de papelera de productos y videos.
2. Alinear la UX de videos con la de productos: agregar diálogo de confirmación antes de eliminar, restaurar o eliminar permanentemente.
3. Eliminar o utilizar código muerto en la capa de recetas (`deleteByCompoundProductId`).
4. Usar nombres descriptivos en la página de papelera de productos (`deletedProducts` en lugar de `activeProducts`).
5. Actualizar `plan-limpieza-hard-delete-cache.md`, `reporte-estado.md` y otros informes relevantes para reflejar el estado final.

## Reglas de negocio

1. El soft delete de productos y videos solo cambia `deletedAt` e `isActive`; no libera archivos.
2. El hard delete individual solo aplica a registros que ya estén en la papelera (`deletedAt IS NOT NULL`).
3. El hard delete de productos primero elimina la fila y luego libera la imagen; si hay dependencias históricas, se bloquea con `ValidationError`.
4. El hard delete de videos primero elimina la fila y luego borra el archivo de video.
5. La UX debe pedir confirmación antes de acciones destructivas o de restauración.
6. No exponer credenciales, secretos ni URLs de bases de datos en documentos, prompts o logs.

## Implementación detallada

### E2E — login falla con `Usuario o contraseña incorrectos`

> Antes de modificar nada, leer <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" /> y <ref_file file="C:/developer/paginas/pancheria/.devin/informes/entornos.md" />.

Pasos de diagnóstico y corrección:

1. Verificar que `.env.e2e` y `.env.local` tengan las mismas credenciales de admin:
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
   - `NEXTAUTH_SECRET` (u `AUTH_SECRET` si está definido)
   - `NEXTAUTH_URL` / `AUTH_URL` apuntando a `http://localhost:3000`
   - `DATABASE_URL` apuntando a una base descartable cuyo nombre termine en `test`, `e2e`, `testing`, `qa` o `staging`.
2. Confirmar que no haya un servidor de Next corriendo con `.env.local` en el puerto 3000. Si existe, matarlo antes de correr `npm run test:e2e`.
3. Revisar <ref_file file="C:/developer/paginas/pancheria/tests/e2e/global-setup.ts" />: el `execSync('npx tsx src/db/seeds.ts')` trunca y re-seedea la base. Asegurar que el proceso hijo herede `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `DATABASE_URL` y `NEXTAUTH_SECRET`.
4. Si persiste el fallo, agregar logs temporales (sin exponer contraseñas) para confirmar que `verifyCredentials` recibe el usuario y que `bcrypt.compare` devuelve `true`.
5. Opcional: ejecutar `npx tsx src/db/seeds.ts` con `.env.e2e` cargado y luego consultar la tabla `users` en la base E2E para validar que el hash se generó con la misma contraseña.
6. Ejecutar `npm run test:e2e` y asegurar que los tests de papelera de productos y videos pasen.

### UX de videos — confirmación antes de acciones destructivas

- <ref_file file="C:/developer/paginas/pancheria/src/components/videos/video-list.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/productos/product-trash-actions.tsx" />

Requisitos:
- Importar y usar `ConfirmDialog` de <ref_file file="C:/developer/paginas/pancheria/src/components/ui/confirm-dialog.tsx" />.
- Antes de ejecutar `deleteVideoAction`, `restoreVideoAction` o `permanentlyDeleteVideoAction`, abrir un diálogo con el título del video.
- Mantener los `data-testid` existentes: `delete-video-button`, `restore-video-button`, `permanently-delete-video-button`.
- Los botones deben ser `type="button"` y disparar el diálogo; la acción se ejecuta solo al confirmar.

### Código muerto en `recipeRepository`

- <ref_file file="C:/developer/paginas/pancheria/src/repositories/recipeRepository.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/repositories/recipeRepository.test.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/productService.ts" />

Decidir:
- Si `deleteByCompoundProductId` no se usa en producción (se borra directamente con `tx.delete(recipes)` en `productService.updateProduct`), eliminar la función y su test.
- Si se prefiere reutilizarla, adaptarla para recibir una transacción opcional y usarla desde `productService.updateProduct`.

### Nombres descriptivos en papelera de productos

- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/productos/eliminados/page.tsx" />

Renombrar `activeProducts` a `deletedProducts` y actualizar todas sus referencias en el JSX.

### Actualización de documentación

- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/archivados/plan-limpieza-hard-delete-cache-2026-09-01.md" /> — reflejar el cierre de pendientes de UX, código muerto y E2E.
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-estado.md" /> — actualizar la tabla de verificaciones y la sección de pendientes.
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" /> — si se aprende algo nuevo sobre E2E o bcrypt, agregarlo.

## Consideraciones de seguridad y entorno

- No commitear `.env.local`, `.env.e2e` ni credenciales.
- `npm run test:e2e` trunca tablas; solo ejecutarlo en bases de datos descartables.
- No exponer hashes, contraseñas ni URLs de base de datos en mensajes de error ni logs.
- `STORAGE_PROVIDER=local` en E2E escribe en `tmp/e2e`; asegurar que el directorio esté dentro del proyecto.

## Verificaciones obligatorias

| Comando | Propósito |
| ------- | --------- |
| `npx tsc --noEmit` | Tipos |
| `npm run lint` | Estilo |
| `npm test` | Tests unitarios |
| `npm run build` | Build de producción |
| `npm run knip` | Código muerto |
| `npm run test:e2e` | Tests E2E en base descartable |

## Notas de cierre

- Si `npm run test:e2e` sigue fallando por credenciales, detenerse y documentar la hipótesis más probable en `reporte-estado.md` sin aplicar workarounds en el código de autenticación.
- Una vez que todo pase, considerar archivar este prompt en `.devin/prompts/archivados/` y mover el estado a `lecciones-aprendidas.md`.
