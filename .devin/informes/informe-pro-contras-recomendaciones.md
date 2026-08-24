# Informe de pros, contras, consejos y recomendaciones — Proyecto Panchería

**Fecha:** 2026-08-23  
**Proyecto:** `pancheria`  
**Contexto:** auditoría y corrección del suite E2E completados.

---

## 1. Resumen ejecutivo

Tras la auditoría y la corrección del suite E2E, el proyecto quedó en un estado sólido: todos los tests pasan, el build es estable y la documentación está alineada con el código. No obstante, persisten riesgos operativos y arquitectónicos que conviene atender para producción y CI/CD.

---

## 2. Pros

| Área | Evaluación |
|------|------------|
| **Stack tecnológico** | Next.js 16.3.2, React 19.2.8, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM 0.45.2, NextAuth v5. Stack moderno, bien mantenido y adecuado para la escala del proyecto. |
| **Arquitectura** | Separación clara en `src/app/`, `src/application/`, `src/repositories/`, `src/domain/`, `src/lib/`, `src/config/`. Facilita testing, mantenimiento y evolución. |
| **Cobertura de tests unitarios** | 92 suites y 890 tests pasan. Los tests mockean repositorios y cubren APIs, servicios, componentes y helpers. |
| **Tests E2E** | 84 tests pasan tras corregir el entorno. Cubren flujos críticos: caja, ventas, pedidos, chat, sucursales, productos, recetas, videos y responsive. |
| **Seguridad** | Headers de seguridad en `next.config.ts`, rate limit atómico, idempotencia atómica, manejo centralizado de errores de DB (`503`), soft delete, validación de IDs con `parseId()`. |
| **Documentación** | <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />, <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />, <ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-estado.md" />, prompts en `.devin/prompts/`. La base de conocimiento del proyecto es robusta. |
| **Multi-sucursal** | Implementación de aislamiento de datos por sucursal, branch selector, catálogo copiado entre sucursales. |
| **Variables de entorno** | No hay credenciales hardcodeadas en el código; todo se obtiene de `.env.local`, `.env.e2e` o variables de Vercel. |

---

## 3. Contras y riesgos

| Riesgo | Detalle | Severidad |
|--------|---------|-----------|
| **Tests E2E truncan datos** | <ref_snippet file="C:/developer/paginas/pancheria/tests/e2e/global-setup.ts" lines="16-34" /> hace `TRUNCATE ... RESTART IDENTITY CASCADE` y re-seedea. Si se ejecuta accidentalmente con `DATABASE_URL` de producción, borra datos reales. | Alto |
| **Configuración de Playwright es frágil** | El `webServer` requiere `npm run dev:e2e` y `url: '/api/caja/resumen'` para evitar HTML/404 por compilación bajo demanda de Turbopack. Si se olvida esto, E2E falla masivamente. | Medio |
| **`scripts/dev-e2e.ts` depende del binario interno de Next.js** | Importa dinámicamente `next/dist/bin/next` y muta `process.argv`. Una actualización de Next puede romper este script. | Medio |
| **Fallback a `localhost:3000` en producción** | `getLocalBaseUrl()` en `src/lib/storage.ts`, `chat-storage.ts` y `whatsapp.ts` usa `http://localhost:3000` si no hay `NEXT_PUBLIC_APP_URL`/`NEXTAUTH_URL`. En Vercel esto generaría URLs rotas. | Alto |
| **Almacenamiento local en producción** | `STORAGE_PROVIDER=local` por defecto. En Vercel el filesystem es efímero; videos y adjuntos se perderían. | Alto |
| **E2E es lento** | 84 tests tardan ~11 min en 1 worker. En CI puede ser un cuello de botella. | Medio |
| **Compresión deshabilitada en `NODE_ENV=test`** | `next.config.ts` puede tener `compress: process.env.NODE_ENV !== 'test'`. Es un workaround válido, pero agrega complejidad. | Bajo |
| **Credenciales en `.env.local`** | Aunque no se comitea, el archivo contiene secretos reales (`NEXTAUTH_SECRET`, contraseña de admin, token de Vercel Blob, URLs de Neon). Si se expuso, deben rotarse. | Medio |
| **Dependencia de Neon/Vercel** | PostgreSQL en Neon y Vercel Blob son servicios externos. Sin conexión estable o con límites de plan, el sistema falla. | Medio |
| **Warns de `The destination stream closed early`** | Aparecen en dev server durante E2E. Son abortos de cliente manejados con `499`, pero ensucian los logs. | Bajo |

---

## 4. Consejos y recomendaciones inmediatas

### 4.1. Entorno y seguridad

- **Aislar `DATABASE_URL` de E2E.** Agregar placeholders en <ref_file file="C:/developer/paginas/pancheria/.env.e2e" /> para `DATABASE_URL` y `DATABASE_URL_UNPOOLED` apuntando a una base descartable. Nunca correr `npm run test:e2e` con la base de producción.
- **Rotar secretos si se expuso `.env.local`.** Cambiar `NEXTAUTH_SECRET`, `ADMIN_PASSWORD`, token de Vercel Blob y credenciales de Neon si el archivo fue leído en logs o compartido.
- **Usar `STORAGE_PROVIDER=vercel-blob` en producción.** El filesystem local no persiste en Vercel. Configurar `BLOB_READ_WRITE_TOKEN` y validar URLs públicas.
- **Configurar `NEXT_PUBLIC_APP_URL` y `NEXTAUTH_URL` en Vercel.** Deben coincidir con el dominio de producción para evitar fallbacks a `http://localhost:3000`.

### 4.2. CI/CD

- **Agregar pipeline de GitHub Actions** con jobs separados:
  1. `lint` y `tsc`
  2. `npm test`
  3. `npm run build`
  4. `npm run knip`
  5. `npm run test:e2e` en una base de datos de prueba (Neon branch o PostgreSQL de servicio).
- **Para E2E en CI**, usar `npm run dev:e2e` en background y luego `npx playwright test --reporter=line`, o usar el `webServer` de <ref_file file="C:/developer/paginas/pancheria/playwright.config.ts" /> con `NODE_ENV=test`.
- **Paralelizar tests E2E** solo si la base de datos lo soporta; actualmente `workers: 1` evita conflictos de caja.

### 4.3. Robustez del entorno E2E

- **Revisar `scripts/dev-e2e.ts` periódicamente.** Si Next.js cambia la estructura interna, el import dinámico de `next/dist/bin/next` puede fallar. Considerar usar `cross-env` + `dotenv-cli` en lugar de un script propio.
- **Documentar el flujo de E2E en `README.md`.** Incluir: `npm run dev:e2e` en una terminal y `NO_WEB_SERVER=1 npx playwright test` en otra, o simplemente `npm run test:e2e`.
- **Mantener `playwright.config.ts` actualizado.** Si se agregan rutas API críticas, considerar un health check que compile varias rutas antes de iniciar.

### 4.4. Calidad de código

- **Eliminar `tests/e2e/debug.spec.ts` si quedó residual.** En el estado actual no debería existir en el repo.
- **Mantener locators robustos.** Usar `.first()` cuando un `filter` pueda coincidir con múltiples elementos, y preferir `getByRole` sobre selectores CSS frágiles.
- **Evitar top-level awaits en scripts `tsx`** si el target es CJS. El error `"Top-level await is currently not supported with the cjs output format"` ya se resolvió, pero es un patrón frágil.

### 4.5. Monitoreo y observabilidad

- **Reducir warns del dev server.** Investigar `The destination stream closed early` y `MaxListenersExceededWarning` de Gzip; si crecen, pueden ocultar errores reales.
- **Agregar logging estructurado** en rutas API críticas (caja, ventas, pedidos) para producción.
- **Configurar alertas** en Vercel/Neon para caídas de DB o límites de conexión.

---

## 5. Conclusión

El proyecto tiene una base técnica sólida, buena cobertura de tests y documentación madura. Los principales riesgos son **operativos** (base de datos real en E2E, credenciales locales, almacenamiento en Vercel) y **de entorno** (configuración de Playwright y dev server). Atender estos puntos lo dejará listo para producción con CI/CD confiable.

---

## 6. Enlaces relevantes

- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-estado.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/correccion-tests-e2e-caja-y-entorno.prompt.md" />
